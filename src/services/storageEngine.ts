import { supabase, getSupabaseConfigStatus } from '../lib/supabaseClient';
import type {
  Classroom,
  Floor,
  Profile,
  Reservation,
  TimetableEvent,
  AuditLog,
  AvailabilityResult,
  TimetableImportRow,
  MissingClassroomInfo,
} from '../types';

// Realtime sync channel for in-browser / cross-tab broadcast
const SYNC_CHANNEL_NAME = 'classroom_allocator_realtime_events';
const bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel(SYNC_CHANNEL_NAME)
  : null;

type ChangeListener = (payload: { event: string; table: string; record?: any }) => void;
const listeners: Set<ChangeListener> = new Set();

if (bc) {
  bc.onmessage = (event) => {
    listeners.forEach((fn) => fn(event.data));
  };
}

export function subscribeToRealtimeChanges(listener: ChangeListener) {
  listeners.add(listener);

  // If live Supabase is configured, also subscribe to postgres_changes
  const config = getSupabaseConfigStatus();
  let supabaseChannel: any = null;

  if (config.isConfigured) {
    try {
      supabaseChannel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reservations' },
          (payload) => {
            listener({ event: payload.eventType, table: 'reservations', record: payload.new });
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'timetable_events' },
          (payload) => {
            listener({ event: payload.eventType, table: 'timetable_events', record: payload.new });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Live realtime subscription error, using local channel:', e);
    }
  }

  return () => {
    listeners.delete(listener);
    if (supabaseChannel) {
      supabase.removeChannel(supabaseChannel);
    }
  };
}

function broadcastChange(table: string, event: string, record?: any) {
  const payload = { event, table, record };
  listeners.forEach((fn) => fn(payload));
  if (bc) {
    bc.postMessage(payload);
  }
}

// Local Database Storage Keys (when operating in local/demo mode or caching)
const STORAGE_PREFIX = 'allocator_db_';
const KEYS = {
  PROFILES: `${STORAGE_PREFIX}profiles`,
  FLOORS: `${STORAGE_PREFIX}floors`,
  CLASSROOMS: `${STORAGE_PREFIX}classrooms`,
  TIMETABLE: `${STORAGE_PREFIX}timetable_events`,
  RESERVATIONS: `${STORAGE_PREFIX}reservations`,
  AUDIT_LOGS: `${STORAGE_PREFIX}audit_logs`,
  PASSWORDS: `${STORAGE_PREFIX}passwords`, // Private mock auth hash/pass store for local mode
  BOOTSTRAPPED: `${STORAGE_PREFIX}admin_bootstrapped`,
};

function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage quota exceeded or storage unavailable', e);
  }
}

// Initial Database Seeding for Local Mode
export function initializeLocalDatabase(): void {
  // Ensure database stores exist dynamically without hardcoding any floors or classrooms
  if (localStorage.getItem(KEYS.FLOORS) === null) {
    setLocal(KEYS.FLOORS, []);
  }
  if (localStorage.getItem(KEYS.CLASSROOMS) === null) {
    setLocal(KEYS.CLASSROOMS, []);
  }
  if (localStorage.getItem(KEYS.TIMETABLE) === null) {
    setLocal(KEYS.TIMETABLE, []);
  }
  if (localStorage.getItem(KEYS.RESERVATIONS) === null) {
    setLocal(KEYS.RESERVATIONS, []);
  }
  if (localStorage.getItem(KEYS.PROFILES) === null) {
    setLocal(KEYS.PROFILES, []);
  }
  if (localStorage.getItem(KEYS.PASSWORDS) === null) {
    setLocal(KEYS.PASSWORDS, {});
  }

  // Sanitize any residual demo accounts from previous storage
  try {
    const existingProfiles = getLocal<Profile[]>(KEYS.PROFILES, []);
    const filteredProfiles = existingProfiles.filter(
      (p) => p.username !== 'prof.smith' && p.username !== 'dr.watson'
    );
    if (filteredProfiles.length !== existingProfiles.length) {
      setLocal(KEYS.PROFILES, filteredProfiles);
    }
    const existingPasswords = getLocal<Record<string, string>>(KEYS.PASSWORDS, {});
    if (existingPasswords['prof.smith'] || existingPasswords['dr.watson']) {
      delete existingPasswords['prof.smith'];
      delete existingPasswords['dr.watson'];
      setLocal(KEYS.PASSWORDS, existingPasswords);
    }
  } catch (e) {
    // ignore
  }
}

// --------------------------------------------------------------------------------
// 1. BOOTSTRAP ADMINISTRATOR ACCOUNT
// Initial admin credentials: Admin123 / Admin@123
// Must force change password before normal dashboard access!
// --------------------------------------------------------------------------------
export async function bootstrapAdminAccount(): Promise<{ success: boolean; message: string }> {
  const config = getSupabaseConfigStatus();

  if (config.isConfigured) {
    try {
      const response = await fetch(`${config.url}/functions/v1/bootstrap-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, message: data.error || 'Failed to bootstrap administrator.' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      console.warn('Edge function not reachable, proceeding with local bootstrap verification:', err);
    }
  }

  // Local bootstrap verification
  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const existingAdmin = profiles.find((p) => p.role === 'admin');

  if (existingAdmin) {
    return {
      success: false,
      message: 'Bootstrap disabled: Administrator account already exists.',
    };
  }

  const adminProfile: Profile = {
    id: 'admin-bootstrap-uid',
    username: 'Admin123',
    full_name: 'System Administrator',
    role: 'admin',
    status: 'active',
    must_change_password: true, // REQUIRED: must change password before accessing normal admin dashboard
    created_at: new Date().toISOString(),
  };

  profiles.push(adminProfile);
  setLocal(KEYS.PROFILES, profiles);

  const passwords = getLocal<Record<string, string>>(KEYS.PASSWORDS, {});
  passwords['admin123'] = 'Admin@123';
  setLocal(KEYS.PASSWORDS, passwords);

  setLocal(KEYS.BOOTSTRAPPED, true);

  logAudit({
    actor_id: adminProfile.id,
    action: 'BOOTSTRAP_ADMIN',
    entity_type: 'profile',
    entity_id: adminProfile.id,
    details: { username: 'Admin123' },
  });

  return {
    success: true,
    message: 'Initial administrator provisioned. You must change the default password upon initial login.',
  };
}

export function isAdministratorBootstrapped(): boolean {
  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  return profiles.some((p) => p.role === 'admin');
}

// --------------------------------------------------------------------------------
// 2. AUTHENTICATION & CREDENTIAL MANAGEMENT
// Login accepts Username & Password (not raw email)
// --------------------------------------------------------------------------------
export async function loginWithUsername(
  username: string,
  password: string
): Promise<{ profile: Profile; token: string }> {
  const cleanUsername = username.trim().toLowerCase();

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    try {
      const response = await fetch(`${config.url}/functions/v1/auth-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Invalid username or password');
      }

      // Set session on supabase client
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      return { profile: data.profile, token: data.session?.access_token || 'supabase-token' };
    } catch (err: any) {
      if (!err.message.includes('Invalid') && !err.message.includes('deactivated')) {
        console.warn('Remote auth failed, evaluating local simulation:', err);
      } else {
        throw err;
      }
    }
  }

  // Local Auth verification
  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const profile = profiles.find((p) => p.username.toLowerCase() === cleanUsername);

  if (!profile) {
    throw new Error('Invalid username or password.');
  }

  if (profile.status === 'disabled') {
    throw new Error('Your account has been deactivated. Please contact an administrator.');
  }

  const passwords = getLocal<Record<string, string>>(KEYS.PASSWORDS, {});
  const storedPassword = passwords[cleanUsername];

  if (!storedPassword || storedPassword !== password) {
    throw new Error('Invalid username or password.');
  }

  return {
    profile,
    token: `local-session-token-${profile.id}`,
  };
}

export async function changeOwnPassword(
  userId: string,
  currentPass: string,
  newPass: string
): Promise<void> {
  if (newPass.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { error: updateError } = await supabase.auth.updateUser({ password: newPass });
    if (updateError) {
      throw new Error(updateError.message);
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (profileError) {
      console.warn('Failed to update must_change_password flag', profileError);
    }
    return;
  }

  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const profile = profiles.find((p) => p.id === userId);
  if (!profile) throw new Error('User not found.');

  const passwords = getLocal<Record<string, string>>(KEYS.PASSWORDS, {});
  const existing = passwords[profile.username.toLowerCase()];

  if (existing && existing !== currentPass) {
    throw new Error('Current password does not match.');
  }

  passwords[profile.username.toLowerCase()] = newPass;
  setLocal(KEYS.PASSWORDS, passwords);

  // Clear must_change_password flag
  profile.must_change_password = false;
  setLocal(KEYS.PROFILES, profiles);

  logAudit({
    actor_id: userId,
    action: 'CHANGE_PASSWORD',
    entity_type: 'profile',
    entity_id: userId,
  });
}

export async function changeOwnUsername(userId: string, newUsername: string): Promise<string> {
  const clean = newUsername.trim();
  if (clean.length < 3 || clean.length > 32) {
    throw new Error('Username must be between 3 and 32 characters.');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
    throw new Error('Username can only contain letters, numbers, hyphens, and underscores.');
  }

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase.rpc('change_username', { p_new_username: clean });
    if (error) {
      throw new Error(error.message);
    }
    if (data && !data.success) {
      throw new Error(data.error || 'Failed to update username.');
    }
    return clean;
  }

  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const existing = profiles.find(
    (p) => p.username.toLowerCase() === clean.toLowerCase() && p.id !== userId
  );

  if (existing) {
    throw new Error('Username is already taken. Please choose another.');
  }

  const profile = profiles.find((p) => p.id === userId);
  if (!profile) throw new Error('User not found.');

  const oldUsername = profile.username.toLowerCase();
  profile.username = clean;
  setLocal(KEYS.PROFILES, profiles);

  // Update password key mapping
  const passwords = getLocal<Record<string, string>>(KEYS.PASSWORDS, {});
  if (passwords[oldUsername]) {
    passwords[clean.toLowerCase()] = passwords[oldUsername];
    delete passwords[oldUsername];
    setLocal(KEYS.PASSWORDS, passwords);
  }

  logAudit({
    actor_id: userId,
    action: 'CHANGE_USERNAME',
    entity_type: 'profile',
    entity_id: userId,
    details: { old: oldUsername, new: clean },
  });

  return clean;
}

// --------------------------------------------------------------------------------
// 3. FACULTY MANAGEMENT (Admin only)
// --------------------------------------------------------------------------------
export async function getFacultyProfiles(): Promise<Profile[]> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'faculty');
    if (!error && data) return data as Profile[];
  }
  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  return profiles.filter((p) => p.role === 'faculty');
}

export async function createFacultyAccount(
  fullName: string,
  username: string,
  tempPassword: string
): Promise<Profile> {
  const cleanUsername = username.trim();
  if (cleanUsername.length < 3 || cleanUsername.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
    throw new Error('Username must be 3-32 characters alphanumeric with hyphens/underscores.');
  }
  if (tempPassword.length < 8) {
    throw new Error('Temporary password must be at least 8 characters long.');
  }

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch(`${config.url}/functions/v1/admin-create-faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        username: cleanUsername,
        temp_password: tempPassword,
      }),
    });
    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error || 'Failed to create faculty account');
    }
    return resData.faculty;
  }

  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  if (profiles.some((p) => p.username.toLowerCase() === cleanUsername.toLowerCase())) {
    throw new Error('Username is already taken.');
  }

  const newFaculty: Profile = {
    id: `fac-${Date.now()}`,
    username: cleanUsername,
    full_name: fullName.trim(),
    role: 'faculty',
    status: 'active',
    must_change_password: true, // Forces password change on first login!
    created_at: new Date().toISOString(),
  };

  profiles.push(newFaculty);
  setLocal(KEYS.PROFILES, profiles);

  const passwords = getLocal<Record<string, string>>(KEYS.PASSWORDS, {});
  passwords[cleanUsername.toLowerCase()] = tempPassword;
  setLocal(KEYS.PASSWORDS, passwords);

  logAudit({
    action: 'CREATE_FACULTY',
    entity_type: 'profile',
    entity_id: newFaculty.id,
    details: { username: cleanUsername, full_name: fullName },
  });

  return newFaculty;
}

export async function resetFacultyPassword(
  facultyId: string,
  newTempPassword: string
): Promise<void> {
  if (newTempPassword.length < 8) {
    throw new Error('Temporary password must be at least 8 characters long.');
  }

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch(`${config.url}/functions/v1/admin-reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: facultyId, temp_password: newTempPassword }),
    });
    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.error || 'Failed to reset faculty password');
    }
    return;
  }

  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const faculty = profiles.find((p) => p.id === facultyId);
  if (!faculty) throw new Error('Faculty member not found.');

  const passwords = getLocal<Record<string, string>>(KEYS.PASSWORDS, {});
  passwords[faculty.username.toLowerCase()] = newTempPassword;
  setLocal(KEYS.PASSWORDS, passwords);

  faculty.must_change_password = true;
  setLocal(KEYS.PROFILES, profiles);

  logAudit({
    action: 'RESET_FACULTY_PASSWORD',
    entity_type: 'profile',
    entity_id: facultyId,
    details: { username: faculty.username },
  });
}

export async function toggleFacultyStatus(
  facultyId: string,
  newStatus: 'active' | 'disabled'
): Promise<void> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', facultyId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const faculty = profiles.find((p) => p.id === facultyId);
  if (!faculty) throw new Error('Faculty member not found.');

  faculty.status = newStatus;
  setLocal(KEYS.PROFILES, profiles);

  logAudit({
    action: 'TOGGLE_FACULTY_STATUS',
    entity_type: 'profile',
    entity_id: facultyId,
    details: { status: newStatus },
  });
}

export async function deleteFacultyAccount(facultyId: string): Promise<void> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    // 1. Remove reservations made by this faculty so foreign key restrictions are satisfied
    await supabase.from('reservations').delete().eq('faculty_id', facultyId);
    // 2. Delete the profile record
    const { error } = await supabase.from('profiles').delete().eq('id', facultyId);
    if (error) {
      throw new Error(error.message);
    }
    broadcastChange('profiles', 'DELETE', { id: facultyId });
    return;
  }

  let profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const faculty = profiles.find((p) => p.id === facultyId);
  if (!faculty) throw new Error('Faculty member not found.');

  // Remove profile
  profiles = profiles.filter((p) => p.id !== facultyId);
  setLocal(KEYS.PROFILES, profiles);

  // Remove any reservations made by this faculty
  let reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);
  reservations = reservations.filter((r) => r.faculty_id !== facultyId);
  setLocal(KEYS.RESERVATIONS, reservations);

  // Clean stored password
  const passwords = getLocal<Record<string, string>>(KEYS.PASSWORDS, {});
  delete passwords[faculty.username.toLowerCase()];
  setLocal(KEYS.PASSWORDS, passwords);

  logAudit({
    action: 'DELETE_FACULTY',
    entity_type: 'profile',
    entity_id: facultyId,
    details: { username: faculty.username, full_name: faculty.full_name },
  });
}

// --------------------------------------------------------------------------------
// 4. FLOORS & CLASSROOMS CRUD
// --------------------------------------------------------------------------------
export async function getFloors(): Promise<Floor[]> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase.from('floors').select('*').order('display_order');
    if (!error && data) return data as Floor[];
  }
  const floors = getLocal<Floor[]>(KEYS.FLOORS, []);
  return floors.sort((a, b) => a.display_order - b.display_order);
}

export async function createFloor(name: string, displayOrder: number): Promise<Floor> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Floor name is required.');

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase
      .from('floors')
      .insert({ name: cleanName, display_order: displayOrder })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const floors = getLocal<Floor[]>(KEYS.FLOORS, []);
    const idx = floors.findIndex((f) => f.id === data.id);
    if (idx >= 0) floors[idx] = data as Floor;
    else floors.push(data as Floor);
    setLocal(KEYS.FLOORS, floors);
    broadcastChange('floors', 'INSERT', data);
    return data as Floor;
  }

  const floors = getLocal<Floor[]>(KEYS.FLOORS, []);
  if (floors.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new Error('A floor with this name already exists.');
  }

  const newFloor: Floor = {
    id: `fl-${Date.now()}`,
    name: cleanName,
    display_order: displayOrder,
    created_at: new Date().toISOString(),
  };

  floors.push(newFloor);
  setLocal(KEYS.FLOORS, floors);
  broadcastChange('floors', 'INSERT', newFloor);
  return newFloor;
}

export async function updateFloor(id: string, name: string, displayOrder: number): Promise<Floor> {
  const cleanName = name.trim();
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase
      .from('floors')
      .update({ name: cleanName, display_order: displayOrder, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    broadcastChange('floors', 'UPDATE', data);
    return data as Floor;
  }

  const floors = getLocal<Floor[]>(KEYS.FLOORS, []);
  const floor = floors.find((f) => f.id === id);
  if (!floor) throw new Error('Floor not found.');

  if (
    floors.some(
      (f) => f.id !== id && f.name.toLowerCase() === cleanName.toLowerCase()
    )
  ) {
    throw new Error('A floor with this name already exists.');
  }

  floor.name = cleanName;
  floor.display_order = displayOrder;
  floor.updated_at = new Date().toISOString();
  setLocal(KEYS.FLOORS, floors);
  broadcastChange('floors', 'UPDATE', floor);
  return floor;
}

export async function deleteFloor(id: string): Promise<void> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    // Retrieve associated classrooms on this floor for cascade broadcast and robust cleanup
    const { data: roomRows } = await supabase
      .from('classrooms')
      .select('id')
      .eq('floor_id', id);
    const roomIds = (roomRows || []).map((r: { id: string }) => r.id);

    // Delete floor - PostgreSQL foreign keys (ON DELETE CASCADE) cascade to classrooms & schedules
    const { error } = await supabase.from('floors').delete().eq('id', id);
    if (error) {
      // In case database triggers or un-migrated tables require manual cascade fallback:
      if (
        error.code === '23503' ||
        error.message?.includes('classrooms_floor_id_fkey') ||
        error.message?.includes('violates foreign key constraint')
      ) {
        if (roomIds.length > 0) {
          await supabase.from('reservations').delete().in('classroom_id', roomIds);
          await supabase.from('timetable_events').delete().in('classroom_id', roomIds);
          await supabase.from('classrooms').delete().in('id', roomIds);
        }
        const { error: retryErr } = await supabase.from('floors').delete().eq('id', id);
        if (retryErr) throw new Error(retryErr.message);
      } else {
        throw new Error(error.message);
      }
    }

    broadcastChange('floors', 'DELETE', { id });
    roomIds.forEach((rid) => {
      broadcastChange('classrooms', 'DELETE', { id: rid });
      broadcastChange('timetable_events', 'DELETE', { classroom_id: rid });
      broadcastChange('reservations', 'DELETE', { classroom_id: rid });
    });
    return;
  }

  // Local storage mode: cascade delete all classrooms, timetable events, and reservations for this floor
  const classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
  const floorClassrooms = classrooms.filter((c) => c.floor_id === id);
  const roomIds = new Set(floorClassrooms.map((c) => c.id));

  let timetable = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  timetable = timetable.filter((t) => !roomIds.has(t.classroom_id));
  setLocal(KEYS.TIMETABLE, timetable);

  let reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);
  reservations = reservations.filter((r) => !roomIds.has(r.classroom_id));
  setLocal(KEYS.RESERVATIONS, reservations);

  const remainingClassrooms = classrooms.filter((c) => c.floor_id !== id);
  setLocal(KEYS.CLASSROOMS, remainingClassrooms);

  let floors = getLocal<Floor[]>(KEYS.FLOORS, []);
  floors = floors.filter((f) => f.id !== id);
  setLocal(KEYS.FLOORS, floors);

  broadcastChange('floors', 'DELETE', { id });
  roomIds.forEach((rid) => {
    broadcastChange('classrooms', 'DELETE', { id: rid });
    broadcastChange('timetable_events', 'DELETE', { classroom_id: rid });
    broadcastChange('reservations', 'DELETE', { classroom_id: rid });
  });
}

export async function getClassrooms(): Promise<Classroom[]> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase
      .from('classrooms')
      .select('*, floor:floors(*)')
      .order('room_number');
    if (!error && data) return data as Classroom[];
  }

  const classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
  const floors = await getFloors();
  const floorMap = new Map(floors.map((f) => [f.id, f]));

  return classrooms
    .map((c) => ({
      ...c,
      floor: floorMap.get(c.floor_id),
    }))
    .sort((a, b) => a.room_number.localeCompare(b.room_number));
}

export async function createClassroom(
  roomNumber: string,
  floorId: string,
  capacity: number = 40
): Promise<Classroom> {
  const cleanNumber = roomNumber.trim().toUpperCase();
  if (!cleanNumber) throw new Error('Room number is required.');

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase
      .from('classrooms')
      .insert({ room_number: cleanNumber, floor_id: floorId, capacity: capacity || 40, is_active: true })
      .select('*, floor:floors(*)')
      .single();
    if (error) throw new Error(error.message);
    const classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
    const idx = classrooms.findIndex((c) => c.id === data.id);
    if (idx >= 0) classrooms[idx] = data as Classroom;
    else classrooms.push(data as Classroom);
    setLocal(KEYS.CLASSROOMS, classrooms);
    broadcastChange('classrooms', 'INSERT', data);
    return data as Classroom;
  }

  const classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
  if (classrooms.some((c) => c.room_number.toUpperCase() === cleanNumber)) {
    throw new Error('A classroom with this room number already exists.');
  }

  const newRoom: Classroom = {
    id: `cr-${Date.now()}`,
    room_number: cleanNumber,
    floor_id: floorId,
    capacity: capacity || 40,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  classrooms.push(newRoom);
  setLocal(KEYS.CLASSROOMS, classrooms);
  broadcastChange('classrooms', 'INSERT', newRoom);
  return newRoom;
}

export async function updateClassroom(
  id: string,
  updates: Partial<Pick<Classroom, 'room_number' | 'floor_id' | 'capacity' | 'is_active'>>
): Promise<Classroom> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase
      .from('classrooms')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, floor:floors(*)')
      .single();
    if (error) throw new Error(error.message);
    broadcastChange('classrooms', 'UPDATE', data);
    return data as Classroom;
  }

  const classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
  const room = classrooms.find((c) => c.id === id);
  if (!room) throw new Error('Classroom not found.');

  if (updates.room_number) {
    const cleanNum = updates.room_number.trim().toUpperCase();
    if (classrooms.some((c) => c.id !== id && c.room_number.toUpperCase() === cleanNum)) {
      throw new Error('A classroom with this room number already exists.');
    }
    room.room_number = cleanNum;
  }

  if (updates.floor_id !== undefined) room.floor_id = updates.floor_id;
  if (updates.capacity !== undefined) room.capacity = updates.capacity;
  if (updates.is_active !== undefined) room.is_active = updates.is_active;

  room.updated_at = new Date().toISOString();
  setLocal(KEYS.CLASSROOMS, classrooms);
  broadcastChange('classrooms', 'UPDATE', room);
  return room;
}

export async function deleteClassroom(id: string): Promise<void> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { error } = await supabase.from('classrooms').delete().eq('id', id);
    if (error) {
      if (
        error.code === '23503' ||
        error.message?.includes('violates foreign key constraint')
      ) {
        // Fallback: manually delete dependent reservations & timetable events then classroom
        await supabase.from('reservations').delete().eq('classroom_id', id);
        await supabase.from('timetable_events').delete().eq('classroom_id', id);
        const { error: retryErr } = await supabase.from('classrooms').delete().eq('id', id);
        if (retryErr) throw new Error(retryErr.message);
      } else {
        throw new Error(error.message);
      }
    }
    broadcastChange('classrooms', 'DELETE', { id });
    broadcastChange('timetable_events', 'DELETE', { classroom_id: id });
    broadcastChange('reservations', 'DELETE', { classroom_id: id });
    return;
  }

  // Local storage mode: cascade delete timetable events and reservations
  let timetable = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  timetable = timetable.filter((t) => t.classroom_id !== id);
  setLocal(KEYS.TIMETABLE, timetable);

  let reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);
  reservations = reservations.filter((r) => r.classroom_id !== id);
  setLocal(KEYS.RESERVATIONS, reservations);

  let classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
  classrooms = classrooms.filter((c) => c.id !== id);
  setLocal(KEYS.CLASSROOMS, classrooms);

  broadcastChange('classrooms', 'DELETE', { id });
  broadcastChange('timetable_events', 'DELETE', { classroom_id: id });
  broadcastChange('reservations', 'DELETE', { classroom_id: id });
}

// --------------------------------------------------------------------------------
// 4b. TIMETABLE FLOOR & CLASSROOM AUTO-CREATION LOGIC
// Logic:
// - Classroom numbers starting with 1 (e.g. 101, 102, 105) -> First Floor (order 1)
// - Classroom numbers starting with 2 (e.g. 201, 202, 203) -> Second Floor (order 2)
// - Classroom numbers starting with 3 -> Third Floor (order 3)
// - Classroom numbers starting with 4 -> Fourth Floor (order 4)
// - Classroom numbers starting with 5 -> Fifth Floor (order 5), etc.
// - Classroom numbers starting with '0' or 'G' -> Ground Floor (order 0)
// --------------------------------------------------------------------------------
// 4b. TIMETABLE FLOOR & CLASSROOM AUTO-CREATION LOGIC
// Floor is taken directly from the CSV row floor column or input specification.
// Room number prefix logic (e.g. 2xx -> 2nd floor, 3xx -> 3rd floor) has been removed!
// --------------------------------------------------------------------------------

export function determineFloorForRoomNumber(_roomNumber?: string, explicitFloor?: string): { floorName: string; displayOrder: number } {
  if (explicitFloor && explicitFloor.trim()) {
    return { floorName: explicitFloor.trim(), displayOrder: 1 };
  }
  return { floorName: 'Main Floor', displayOrder: 1 };
}

export function findMatchingFloor(
  floors: Floor[],
  floorName: string,
  displayOrder?: number
): Floor | undefined {
  const normTarget = floorName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normTarget) return floors[0];

  // 1. Exact or normalized name match
  const byName = floors.find((f) => {
    const fn = f.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return fn === normTarget;
  });
  if (byName) return byName;

  // 2. Contains match
  const byContains = floors.find((f) => {
    const fn = f.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return fn.includes(normTarget) || normTarget.includes(fn);
  });
  if (byContains) return byContains;

  // 3. Display order fallback if provided
  if (displayOrder !== undefined) {
    const byOrder = floors.find((f) => f.display_order === displayOrder);
    if (byOrder) return byOrder;
  }

  return undefined;
}

export async function autoCreateMissingRoomsAndFloors(
  items: MissingClassroomInfo[] | string[]
): Promise<{ createdFloors: Floor[]; createdRooms: Classroom[] }> {
  const normalizedItems: Array<{ room_number: string; floor_name: string }> = [];

  for (const it of items) {
    if (typeof it === 'string') {
      const roomNum = it.trim().toUpperCase();
      if (roomNum) {
        normalizedItems.push({ room_number: roomNum, floor_name: 'Main Floor' });
      }
    } else if (it && it.room_number) {
      const roomNum = it.room_number.trim().toUpperCase();
      const floorName = it.floor_name ? it.floor_name.trim() : 'Main Floor';
      if (roomNum) {
        normalizedItems.push({ room_number: roomNum, floor_name: floorName });
      }
    }
  }

  if (normalizedItems.length === 0) {
    return { createdFloors: [], createdRooms: [] };
  }

  // Get current state
  let currentFloors = await getFloors();
  const currentClassrooms = await getClassrooms();
  const existingRoomMap = new Map(
    currentClassrooms.map((c) => [c.room_number.trim().toUpperCase(), c])
  );

  const missingItems = normalizedItems.filter((it) => !existingRoomMap.has(it.room_number));
  if (missingItems.length === 0) {
    return { createdFloors: [], createdRooms: [] };
  }

  const createdFloors: Floor[] = [];
  const createdRooms: Classroom[] = [];

  // Group rooms strictly by their explicit floor_name (no prefix digit guessing)
  const floorGroupMap = new Map<string, { floorName: string; rooms: string[] }>();

  for (const it of missingItems) {
    const key = it.floor_name.toLowerCase();
    if (!floorGroupMap.has(key)) {
      floorGroupMap.set(key, { floorName: it.floor_name, rooms: [] });
    }
    const group = floorGroupMap.get(key)!;
    if (!group.rooms.includes(it.room_number)) {
      group.rooms.push(it.room_number);
    }
  }

  let nextDisplayOrder = currentFloors.reduce((max, f) => Math.max(max, f.display_order), 0) + 1;

  for (const group of floorGroupMap.values()) {
    // Find or create floor
    let targetFloor = findMatchingFloor(currentFloors, group.floorName);

    if (!targetFloor) {
      try {
        targetFloor = await createFloor(group.floorName, nextDisplayOrder++);
        createdFloors.push(targetFloor);
        currentFloors.push(targetFloor);
      } catch (err: any) {
        currentFloors = await getFloors();
        targetFloor = findMatchingFloor(currentFloors, group.floorName);
        if (!targetFloor && currentFloors.length > 0) {
          targetFloor = currentFloors[0];
        }
      }
    }

    if (!targetFloor) {
      console.error(`Unable to resolve floor for rooms: ${group.rooms.join(', ')}`);
      continue;
    }

    // Create classrooms for this floor
    for (const roomNum of group.rooms) {
      if (existingRoomMap.has(roomNum)) continue;
      try {
        const newClassroom = await createClassroom(roomNum, targetFloor.id, 40);
        createdRooms.push(newClassroom);
        existingRoomMap.set(roomNum, newClassroom);
      } catch (err: any) {
        console.warn(`Could not create classroom "${roomNum}":`, err.message);
      }
    }
  }

  return { createdFloors, createdRooms };
}

// --------------------------------------------------------------------------------
// 4c. TIMETABLE PARSING HELPERS (Day, Time Range, Section Heading)
// --------------------------------------------------------------------------------

// Convert day string to integer (1 = Monday ... 6 = Saturday). Sunday is strictly disallowed.
export function parseDayOfWeek(raw: string): { day: number | null; isSunday: boolean } {
  const clean = raw.trim().toLowerCase();

  // Strict check for Sunday
  if (clean === '7' || clean === 'sun' || clean === 'sunday' || clean === 'su') {
    return { day: null, isSunday: true };
  }

  if (clean === '1' || clean === 'mon' || clean === 'monday' || clean === 'mo') return { day: 1, isSunday: false };
  if (clean === '2' || clean === 'tue' || clean === 'tues' || clean === 'tuesday' || clean === 'tu') return { day: 2, isSunday: false };
  if (clean === '3' || clean === 'wed' || clean === 'wednesday' || clean === 'we') return { day: 3, isSunday: false };
  if (clean === '4' || clean === 'thu' || clean === 'thur' || clean === 'thurs' || clean === 'thursday' || clean === 'th') return { day: 4, isSunday: false };
  if (clean === '5' || clean === 'fri' || clean === 'friday' || clean === 'fr') return { day: 5, isSunday: false };
  if (clean === '6' || clean === 'sat' || clean === 'saturday' || clean === 'sa') return { day: 6, isSunday: false };

  return { day: null, isSunday: false };
}

export function parseSingleTime(raw: string, fallbackPeriod?: 'AM' | 'PM'): string | null {
  if (!raw) return null;
  const clean = raw.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = (match[3] as 'AM' | 'PM' | undefined) || fallbackPeriod;

  if (minutes < 0 || minutes > 59) return null;

  if (period === 'PM') {
    if (hours < 12) hours += 12;
  } else if (period === 'AM') {
    if (hours === 12) hours = 0;
  }

  if (hours < 0 || hours > 23) return null;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function parseTimeRange(timeStr: string): { start: string; end: string } | null {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  // Split on hyphen, en-dash, em-dash, 'to', 'till', '/'
  const parts = clean.split(/\s*(?:-|–|—|\bto\b|\btill\b|\/)\s*/i);
  if (parts.length !== 2) return null;

  const startPart = parts[0].trim();
  const endPart = parts[1].trim();

  const startHasAmPm = /(AM|PM)/i.test(startPart);
  const endHasAmPm = /(AM|PM)/i.test(endPart);

  let startParsed: string | null = null;
  let endParsed: string | null = null;

  if (startHasAmPm && endHasAmPm) {
    startParsed = parseSingleTime(startPart);
    endParsed = parseSingleTime(endPart);
  } else if (!startHasAmPm && endHasAmPm) {
    const endPeriodMatch = endPart.toUpperCase().match(/(AM|PM)/);
    const endPeriod = endPeriodMatch ? (endPeriodMatch[1] as 'AM' | 'PM') : undefined;
    endParsed = parseSingleTime(endPart);

    const rawStartHourMatch = startPart.match(/^(\d{1,2})/);
    const rawEndHourMatch = endPart.match(/^(\d{1,2})/);
    let startPeriod = endPeriod;
    if (endPeriod === 'PM' && rawStartHourMatch && rawEndHourMatch) {
      const sH = parseInt(rawStartHourMatch[1], 10);
      const eH = parseInt(rawEndHourMatch[1], 10);
      if (sH > eH && sH !== 12) {
        startPeriod = 'AM';
      }
    }
    startParsed = parseSingleTime(startPart, startPeriod);
  } else if (startHasAmPm && !endHasAmPm) {
    const startPeriodMatch = startPart.toUpperCase().match(/(AM|PM)/);
    const startPeriod = startPeriodMatch ? (startPeriodMatch[1] as 'AM' | 'PM') : undefined;
    startParsed = parseSingleTime(startPart);
    endParsed = parseSingleTime(endPart, startPeriod);
  } else {
    startParsed = parseSingleTime(startPart);
    endParsed = parseSingleTime(endPart);
  }

  if (!startParsed || !endParsed) return null;
  return { start: startParsed, end: endParsed };
}

/**
 * Safely splits a CSV line into columns, preserving quoted values and supporting comma or semicolon delimiters.
 */
export function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  const delimiter = !line.includes(',') && line.includes(';') ? ';' : ',';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

export function extractTopHeadingSection(lines: string[], headerIdx: number): string | null {
  for (let i = 0; i < headerIdx; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Matches "Section: BCA A", "Class/Section - BCA B", "Section = BCA A"
    const secMatch = line.match(/(?:section|sec|batch|class|division|div)\s*[:=-]\s*([^,;\n\r]+)/i);
    if (secMatch && secMatch[1].trim()) {
      return secMatch[1].trim();
    }

    // Matches standalone header cell like "BCA A", "BCA-A", "BCA 1st Year Sec A"
    const firstCell = splitCsvLine(line)[0]?.trim() || '';
    if (firstCell && !firstCell.toLowerCase().includes('day') && !firstCell.toLowerCase().includes('room')) {
      const cleaned = firstCell.replace(/^[#*-]\s*/, '').trim();
      if (cleaned.length >= 2 && cleaned.length <= 40) {
        return cleaned;
      }
    }
  }
  return null;
}

/**
 * Checks whether a given calendar date and start time slot has already passed in the user's local time.
 * Includes a 60-second grace window to account for network transmission latency.
 */
export function isSlotInPast(dateStr: string, startTimeStr: string): boolean {
  if (!dateStr || !startTimeStr) return false;
  let datePart = dateStr;
  let timePart = startTimeStr;
  if (dateStr.includes('T')) {
    const parts = dateStr.split('T');
    datePart = parts[0];
    timePart = parts[1].substring(0, 5);
  }
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.substring(0, 5).split(':').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) return false;

  const slotDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const now = new Date();
  return slotDate.getTime() < now.getTime() - 60000;
}


// --------------------------------------------------------------------------------
// 5. TIMETABLE MANAGEMENT & CONFLICT DETECTION
// --------------------------------------------------------------------------------
export async function getTimetableEvents(): Promise<TimetableEvent[]> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase
      .from('timetable_events')
      .select('*, classroom:classrooms(*, floor:floors(*))')
      .order('day_of_week')
      .order('start_time');

    if (!error && data) {
      if (data.length > 0) {
        return data as TimetableEvent[];
      }

      // If Supabase returned 0 events, check if local storage has events (e.g. from an earlier import)
      // and automatically sync them to Supabase so previously imported events are not lost
      const localEvents = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
      if (localEvents.length > 0) {
        const classrooms = await getClassrooms();
        const validRoomIds = new Set(classrooms.map((c) => c.id));
        const syncPayload = localEvents
          .filter((e) => validRoomIds.has(e.classroom_id))
          .map((e) => ({
            classroom_id: e.classroom_id,
            subject: e.subject.trim(),
            faculty_name: e.faculty_name.trim(),
            day_of_week: e.day_of_week,
            start_time: e.start_time.trim().length === 5 ? `${e.start_time.trim()}:00` : e.start_time.trim(),
            end_time: e.end_time.trim().length === 5 ? `${e.end_time.trim()}:00` : e.end_time.trim(),
            semester: e.semester?.trim() || 'Current Semester',
            specific_date: e.specific_date || null,
            is_active: e.is_active ?? true,
          }));

        if (syncPayload.length > 0) {
          try {
            const { data: synced, error: syncErr } = await supabase
              .from('timetable_events')
              .insert(syncPayload)
              .select('*, classroom:classrooms(*, floor:floors(*))');
            if (!syncErr && synced && synced.length > 0) {
              return synced as TimetableEvent[];
            }
          } catch (syncErr) {
            console.warn('Auto-sync local timetable to Supabase error:', syncErr);
          }
        }

        // Return local events as fallback with classrooms attached
        const roomMap = new Map(classrooms.map((c) => [c.id, c]));
        return localEvents
          .map((e) => ({
            ...e,
            classroom: e.classroom || roomMap.get(e.classroom_id),
          }))
          .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
      }

      return data as TimetableEvent[];
    }
  }

  const events = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  const classrooms = await getClassrooms();
  const roomMap = new Map(classrooms.map((c) => [c.id, c]));

  return events
    .map((e) => ({
      ...e,
      classroom: roomMap.get(e.classroom_id),
    }))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
}

// Check if a timetable entry conflicts with existing confirmed faculty reservations
export async function detectTimetableConflictsWithReservations(
  classroomId: string,
  dayOfWeek: number,
  startTime: string, // "09:00"
  endTime: string, // "10:30"
  specificDate?: string | null
): Promise<Reservation[]> {
  const reservations = await getReservations({ classroomId, status: 'confirmed' });
  const conflicts: Reservation[] = [];

  for (const res of reservations) {
    const resStart = new Date(res.start_time);
    const resEnd = new Date(res.end_time);

    // Check date / day match
    if (specificDate) {
      const resDateStr = resStart.toISOString().split('T')[0];
      if (resDateStr !== specificDate) continue;
    } else {
      // Recurring schedule: compare day of week (0=Sun, 1=Mon, ..., 6=Sat)
      // Our convention: 1 = Mon, ..., 7 = Sun
      const resDay = resStart.getUTCDay() === 0 ? 7 : resStart.getUTCDay();
      if (resDay !== dayOfWeek) continue;
    }

    // Compare time ranges: HH:mm
    const resStartHHMM = resStart.toISOString().substring(11, 16);
    const resEndHHMM = resEnd.toISOString().substring(11, 16);

    // Overlap condition: requested_start < existing_end AND requested_end > existing_start
    if (startTime < resEndHHMM && endTime > resStartHHMM) {
      conflicts.push(res);
    }
  }

  return conflicts;
}

export async function createTimetableEvent(
  event: Omit<TimetableEvent, 'id' | 'created_at'>
): Promise<{ event?: TimetableEvent; conflicts?: Reservation[] }> {
  // Check for conflicts with existing faculty reservations
  const conflicts = await detectTimetableConflictsWithReservations(
    event.classroom_id,
    event.day_of_week,
    event.start_time,
    event.end_time,
    event.specific_date
  );

  if (conflicts.length > 0) {
    return { conflicts };
  }

  const cleanStart = event.start_time.trim().length === 5 ? `${event.start_time.trim()}:00` : event.start_time.trim();
  const cleanEnd = event.end_time.trim().length === 5 ? `${event.end_time.trim()}:00` : event.end_time.trim();

  // Local storage cache update
  const events = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  const newEvent: TimetableEvent = {
    ...event,
    section: event.section?.trim() || undefined,
    start_time: cleanStart,
    end_time: cleanEnd,
    id: `tt-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  events.push(newEvent);
  setLocal(KEYS.TIMETABLE, events);

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const insertPayload: any = {
      classroom_id: event.classroom_id,
      subject: event.subject.trim(),
      faculty_name: event.faculty_name.trim(),
      day_of_week: event.day_of_week,
      start_time: cleanStart,
      end_time: cleanEnd,
      semester: event.semester?.trim() || 'Current Semester',
      specific_date: event.specific_date || null,
      is_active: event.is_active ?? true,
    };
    if (event.section?.trim()) {
      insertPayload.section = event.section.trim();
    }

    const { data, error } = await supabase
      .from('timetable_events')
      .insert(insertPayload)
      .select('*, classroom:classrooms(*, floor:floors(*))')
      .single();

    if (error) {
      console.error('Supabase create timetable event error:', error);
      throw new Error(error.message || 'Failed to save timetable event.');
    }

    broadcastChange('timetable_events', 'INSERT', data);
    return { event: data as TimetableEvent };
  }

  broadcastChange('timetable_events', 'INSERT', newEvent);
  return { event: newEvent };
}

export async function deleteTimetableEvent(id: string): Promise<void> {
  let events = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  events = events.filter((e) => e.id !== id);
  setLocal(KEYS.TIMETABLE, events);

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { error } = await supabase.from('timetable_events').delete().eq('id', id);
    if (error) {
      console.error('Supabase delete timetable event error:', error);
      throw new Error(error.message || 'Failed to delete timetable event.');
    }
  }

  broadcastChange('timetable_events', 'DELETE', { id });
}

export async function parseAndValidateTimetableImport(
  rawText: string
): Promise<{
  rows: TimetableImportRow[];
  validCount: number;
  errorCount: number;
  missingClassrooms: MissingClassroomInfo[];
  detectedSection?: string;
}> {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Timetable file must contain a header row and at least one data row.');
  }

  // 1. Locate the column header row (contains "day" or "weekday" along with "room" or "subject" or "time")
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const hasDay = lower.includes('day') || lower.includes('weekday');
    const hasRoom = lower.includes('room') || lower.includes('classroom') || lower.includes('hall');
    const hasSubject = lower.includes('subject') || lower.includes('course');
    const hasTime = lower.includes('time') || lower.includes('slot') || lower.includes('timing');
    const hasFloor = lower.includes('floor') || lower.includes('level');

    if (hasDay && (hasRoom || hasSubject || hasTime || hasFloor)) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    // Fallback to first line if no clear match
    headerIdx = 0;
  }

  // 2. Extract section heading if specified at the top of the file before headers
  const topSection = extractTopHeadingSection(lines, headerIdx) || undefined;

  const header = splitCsvLine(lines[headerIdx]).map((h) => h.toLowerCase().trim());

  // Dynamic column resolution: Column order in the CSV does NOT matter
  const dayIdx = header.findIndex((h) => h.includes('day') || h.includes('weekday'));
  const timeIdx = header.findIndex(
    (h) =>
      h === 'time' ||
      h === 'timeslot' ||
      h.includes('time slot') ||
      h.includes('time-slot') ||
      h === 'slot' ||
      h.includes('timing') ||
      h.includes('interval') ||
      h.includes('hours') ||
      (h.includes('time') && !h.includes('start') && !h.includes('end'))
  );
  const startIdx = header.findIndex((h) => h.includes('start'));
  const endIdx = header.findIndex((h) => h.includes('end'));
  const roomIdx = header.findIndex(
    (h) => h.includes('room') || h.includes('classroom') || h.includes('hall')
  );
  const floorIdx = header.findIndex((h) => h.includes('floor') || h.includes('level') || h.includes('storey'));
  const subjectIdx = header.findIndex(
    (h) => h.includes('subject') || h.includes('course') || h.includes('paper') || h.includes('module') || h.includes('topic')
  );
  const facultyIdx = header.findIndex(
    (h) =>
      h.includes('faculty') ||
      h.includes('teacher') ||
      h.includes('prof') ||
      h.includes('instructor') ||
      h.includes('lecturer') ||
      h.includes('staff')
  );
  const sectionIdx = header.findIndex(
    (h) =>
      h === 'section' ||
      h === 'sec' ||
      h.includes('section') ||
      h === 'class' ||
      h.includes('division') ||
      h.includes('div') ||
      h.includes('batch')
  );
  const semesterIdx = header.findIndex((h) => h.includes('semester') || h.includes('term') || h.includes('sem'));

  if (dayIdx === -1 || roomIdx === -1 || subjectIdx === -1 || facultyIdx === -1 || (timeIdx === -1 && (startIdx === -1 || endIdx === -1))) {
    const missing: string[] = [];
    if (dayIdx === -1) missing.push('Day (e.g. Mon-Sat)');
    if (timeIdx === -1 && (startIdx === -1 || endIdx === -1)) missing.push('Time (e.g. 09:00 AM - 10:30 AM)');
    if (roomIdx === -1) missing.push('Room (e.g. 101, 202)');
    if (subjectIdx === -1) missing.push('Subject');
    if (facultyIdx === -1) missing.push('Faculty');
    throw new Error(
      `Missing required column(s): ${missing.join(', ')}. Note: Column order in your CSV does not matter, but all required columns must be present.`
    );
  }

  const classrooms = await getClassrooms();
  const roomNumberMap = new Map(classrooms.map((c) => [c.room_number.toUpperCase(), c]));

  const rows: TimetableImportRow[] = [];
  const missingClassroomsMap = new Map<string, string>();
  let validCount = 0;
  let errorCount = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3 || cols.every((c) => !c)) continue;

    const dayRaw = cols[dayIdx] || '';
    const roomNum = cols[roomIdx]?.toUpperCase() || '';
    const floorName = floorIdx !== -1 && cols[floorIdx] ? cols[floorIdx] : '';
    const subject = cols[subjectIdx] || '';
    const faculty = cols[facultyIdx] || '';
    const rowSection = (sectionIdx !== -1 && cols[sectionIdx] ? cols[sectionIdx] : '') || topSection || '';
    const semester = semesterIdx !== -1 && cols[semesterIdx] ? cols[semesterIdx] : 'Current Semester';

    // Parse time range
    let start = '';
    let end = '';

    if (timeIdx !== -1 && cols[timeIdx]) {
      const parsedRange = parseTimeRange(cols[timeIdx]);
      if (parsedRange) {
        start = parsedRange.start;
        end = parsedRange.end;
      }
    } else if (startIdx !== -1 && endIdx !== -1) {
      start = parseSingleTime(cols[startIdx]) || cols[startIdx];
      end = parseSingleTime(cols[endIdx]) || cols[endIdx];
    }

    // Parse day of week (strictly Monday through Saturday, Sunday disallowed)
    const { day: dayVal, isSunday } = parseDayOfWeek(dayRaw);

    const row: TimetableImportRow = {
      room_number: roomNum,
      floor_name: floorName || undefined,
      subject,
      faculty_name: faculty,
      day_of_week: dayVal || 0,
      start_time: start,
      end_time: end,
      section: rowSection || undefined,
      semester,
    };

    if (isSunday) {
      row.error = 'Sunday is not permitted. Timetable events are restricted to Monday through Saturday only.';
      errorCount++;
    } else if (dayVal === null) {
      row.error = `Invalid Day of Week "${dayRaw}". Must be a valid day from Monday to Saturday (e.g. Monday, Mon).`;
      errorCount++;
    } else if (!start || !end) {
      const timeSample = timeIdx !== -1 ? cols[timeIdx] : `${cols[startIdx]} - ${cols[endIdx]}`;
      row.error = `Invalid Time Format "${timeSample}". Expected format like "09:00 AM - 10:30 AM" or "09:00 - 10:30".`;
      errorCount++;
    } else if (end <= start) {
      row.error = `End time (${end}) must be strictly after start time (${start}).`;
      errorCount++;
    } else if (!roomNumberMap.has(roomNum)) {
      row.error = `Classroom "${roomNum}" on ${floorName || 'specified floor'} does not exist in the database.`;
      errorCount++;
      if (roomNum) {
        missingClassroomsMap.set(roomNum, floorName || 'Main Floor');
      }
    } else {
      const room = roomNumberMap.get(roomNum)!;
      const conflicts = await detectTimetableConflictsWithReservations(
        room.id,
        dayVal,
        start,
        end
      );

      if (conflicts.length > 0) {
        row.conflictWithReservation = conflicts[0];
        row.error = `Conflicts with active reservation by ${conflicts[0].faculty?.full_name || 'Faculty'}`;
        errorCount++;
      } else {
        validCount++;
      }
    }

    rows.push(row);
  }

  const missingClassrooms: MissingClassroomInfo[] = Array.from(missingClassroomsMap.entries()).map(
    ([room_number, floor_name]) => ({ room_number, floor_name })
  ).sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));

  return { rows, validCount, errorCount, missingClassrooms, detectedSection: topSection };
}

export async function commitTimetableImport(rows: TimetableImportRow[]): Promise<number> {
  const classrooms = await getClassrooms();
  const roomMap = new Map(classrooms.map((c) => [c.room_number.trim().toUpperCase(), c]));
  const config = getSupabaseConfigStatus();

  const toInsert: Array<{
    classroom_id: string;
    subject: string;
    faculty_name: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    semester: string;
    section?: string;
    is_active: boolean;
  }> = [];

  for (const row of rows) {
    if (row.error) continue; // Skip invalid rows
    const cleanRoom = row.room_number.trim().toUpperCase();
    const room = roomMap.get(cleanRoom);
    if (!room) continue;

    const insertItem: {
      classroom_id: string;
      subject: string;
      faculty_name: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      semester: string;
      section?: string;
      is_active: boolean;
    } = {
      classroom_id: room.id,
      subject: row.subject.trim(),
      faculty_name: row.faculty_name.trim(),
      day_of_week: row.day_of_week,
      start_time: row.start_time.trim().length === 5 ? `${row.start_time.trim()}:00` : row.start_time.trim(),
      end_time: row.end_time.trim().length === 5 ? `${row.end_time.trim()}:00` : row.end_time.trim(),
      semester: row.semester?.trim() || 'Current Semester',
      is_active: true,
    };

    if (row.section?.trim()) {
      insertItem.section = row.section.trim();
    }

    toInsert.push(insertItem);
  }

  if (toInsert.length === 0) return 0;

  // Always keep localStorage updated as local cache and fallback
  const events = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  let committed = 0;
  for (const item of toInsert) {
    events.push({
      id: `tt-${Date.now()}-${committed}`,
      ...item,
      created_at: new Date().toISOString(),
    });
    committed++;
  }
  setLocal(KEYS.TIMETABLE, events);

  if (config.isConfigured) {
    const { data, error } = await supabase
      .from('timetable_events')
      .insert(toInsert)
      .select('*, classroom:classrooms(*, floor:floors(*))');

    if (error) {
      console.error('Failed to commit timetable import to Supabase:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    broadcastChange('timetable_events', 'INSERT_BATCH', { count: data?.length || toInsert.length });
    return data?.length || toInsert.length;
  }

  broadcastChange('timetable_events', 'INSERT_BATCH', { count: committed });
  return committed;
}

// --------------------------------------------------------------------------------
// 6. AVAILABILITY ENGINE
// Interval overlap condition: requested_start < existing_end AND requested_end > existing_start
// Back-to-back allowed: requested_start == existing_end OR requested_end == existing_start
// --------------------------------------------------------------------------------
export async function checkClassroomAvailability(
  classroomId: string,
  startDateTime: string, // ISO string
  endDateTime: string // ISO string
): Promise<AvailabilityResult> {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return { available: false, reason: 'End time must be after start time.' };
  }

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    try {
      const { data, error } = await supabase.rpc('check_classroom_availability', {
        p_classroom_id: classroomId,
        p_start: startDateTime,
        p_end: endDateTime,
      });
      if (!error && data) {
        return data as AvailabilityResult;
      }
    } catch (e) {
      console.warn('Supabase check_classroom_availability failed, falling back to local calculation', e);
    }
  }

  const classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
  const room = classrooms.find((c) => c.id === classroomId);

  if (!room) {
    return { available: false, reason: 'Classroom not found.' };
  }
  if (!room.is_active) {
    return {
      available: false,
      conflict_type: 'inactive',
      reason: 'Classroom is currently marked inactive for maintenance.',
    };
  }

  // 1. Check Official Timetable
  const dayOfWeek = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
  const dateStr = start.toISOString().split('T')[0];
  const reqStartHHMM = start.toISOString().substring(11, 16);
  const reqEndHHMM = end.toISOString().substring(11, 16);

  const timetable = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  const lectureMatch = timetable.find((t) => {
    if (t.classroom_id !== classroomId || !t.is_active) return false;

    // Specific date override OR recurring day match
    const dateMatches = t.specific_date ? t.specific_date === dateStr : t.day_of_week === dayOfWeek;
    if (!dateMatches) return false;

    // Overlap: requested_start < existing_end AND requested_end > existing_start
    return reqStartHHMM < t.end_time && reqEndHHMM > t.start_time;
  });

  if (lectureMatch) {
    return {
      available: false,
      conflict_type: 'timetable',
      reason: `Classroom is occupied by official timetable lecture: ${lectureMatch.subject}`,
      details: {
        subject: lectureMatch.subject,
        faculty_name: lectureMatch.faculty_name,
        start_time: lectureMatch.start_time,
        end_time: lectureMatch.end_time,
      },
    };
  }

  // 2. Check Faculty Reservations
  const reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);
  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const resConflict = reservations.find((r) => {
    if (r.classroom_id !== classroomId || r.status !== 'confirmed') return false;

    const rStart = new Date(r.start_time);
    const rEnd = new Date(r.end_time);

    // Overlap condition: requested_start < existing_end AND requested_end > existing_start
    return start < rEnd && end > rStart;
  });

  if (resConflict) {
    const prof = profileMap.get(resConflict.faculty_id);
    return {
      available: false,
      conflict_type: 'reservation',
      reason: `Classroom is already reserved by ${prof?.full_name || 'Faculty'}.`,
      details: {
        faculty_name: prof?.full_name || 'Faculty Member',
        purpose: resConflict.purpose,
        start_time: resConflict.start_time,
        end_time: resConflict.end_time,
      },
    };
  }

  return { available: true, reason: 'Classroom is available for schedule.' };
}

// --------------------------------------------------------------------------------
// 7. TRANSACTIONAL CLASSROOM RESERVATION
// Atomic reservation operation preventing concurrent double bookings
// --------------------------------------------------------------------------------
export async function reserveClassroom(
  classroomId: string,
  startDateTime: string,
  endDateTime: string,
  purpose: string,
  facultyId: string
): Promise<Reservation> {
  // 1. Strictly block reservations in the past
  const [datePart, timePart] = startDateTime.split('T');
  if (datePart && timePart && isSlotInPast(datePart, timePart)) {
    throw new Error('Cannot book a classroom for a past date or time. Please select a future time slot.');
  }

  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase.rpc('reserve_classroom', {
      p_classroom_id: classroomId,
      p_start: startDateTime,
      p_end: endDateTime,
      p_purpose: purpose,
    });
    if (error) {
      throw new Error(error.message);
    }
    if (data && !data.success) {
      throw new Error(data.error || 'Failed to complete reservation.');
    }
    broadcastChange('reservations', 'INSERT', data);
    return {
      id: data.reservation_id,
      classroom_id: classroomId,
      faculty_id: facultyId,
      start_time: startDateTime,
      end_time: endDateTime,
      purpose,
      status: 'confirmed',
    };
  }

  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const faculty = profiles.find((p) => p.id === facultyId);

  if (!faculty) {
    throw new Error('Faculty profile not found.');
  }
  if (faculty.status !== 'active') {
    throw new Error('Your account has been deactivated. Please contact an administrator.');
  }
  if (faculty.must_change_password) {
    throw new Error('You must change your temporary password before making reservations.');
  }

  // Re-verify availability within the transactional operation
  const check = await checkClassroomAvailability(classroomId, startDateTime, endDateTime);
  if (!check.available) {
    throw new Error(check.reason || 'Classroom is not available for the requested time range.');
  }

  const reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);
  const newReservation: Reservation = {
    id: `res-${Date.now()}`,
    classroom_id: classroomId,
    faculty_id: facultyId,
    start_time: startDateTime,
    end_time: endDateTime,
    purpose: purpose.trim() || 'Academic Activity',
    status: 'confirmed',
    created_at: new Date().toISOString(),
  };

  reservations.push(newReservation);
  setLocal(KEYS.RESERVATIONS, reservations);

  logAudit({
    actor_id: facultyId,
    action: 'CREATE_RESERVATION',
    entity_type: 'reservation',
    entity_id: newReservation.id,
    details: {
      classroom_id: classroomId,
      start_time: startDateTime,
      end_time: endDateTime,
      purpose,
    },
  });

  broadcastChange('reservations', 'INSERT', newReservation);
  return newReservation;
}

export async function cancelReservation(
  reservationId: string,
  callerUserId: string,
  isAdmin: boolean
): Promise<void> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase.rpc('cancel_reservation', {
      p_reservation_id: reservationId,
    });
    if (error) throw new Error(error.message);
    if (data && !data.success) throw new Error(data.error || 'Failed to cancel reservation.');
    broadcastChange('reservations', 'UPDATE', { id: reservationId, status: 'cancelled' });
    return;
  }

  const reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);
  const res = reservations.find((r) => r.id === reservationId);

  if (!res) throw new Error('Reservation not found.');
  if (res.status === 'cancelled') throw new Error('Reservation is already cancelled.');

  if (res.faculty_id !== callerUserId && !isAdmin) {
    throw new Error('You are not authorized to cancel this reservation.');
  }

  res.status = 'cancelled';
  res.updated_at = new Date().toISOString();
  setLocal(KEYS.RESERVATIONS, reservations);

  logAudit({
    actor_id: callerUserId,
    action: 'CANCEL_RESERVATION',
    entity_type: 'reservation',
    entity_id: reservationId,
    details: { cancelled_by: callerUserId, is_admin: isAdmin },
  });

  broadcastChange('reservations', 'UPDATE', res);
}

export async function getReservations(filters?: {
  facultyId?: string;
  classroomId?: string;
  status?: 'confirmed' | 'cancelled';
}): Promise<Reservation[]> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    let query = supabase
      .from('reservations')
      .select('*, classroom:classrooms(*, floor:floors(*)), faculty:profiles(id, username, full_name)')
      .order('start_time', { ascending: false });
    if (filters?.facultyId) query = query.eq('faculty_id', filters.facultyId);
    if (filters?.classroomId) query = query.eq('classroom_id', filters.classroomId);
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (!error && data) return data as Reservation[];
  }

  const reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);
  const classrooms = await getClassrooms();
  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);

  const roomMap = new Map(classrooms.map((c) => [c.id, c]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return reservations
    .filter((r) => {
      if (filters?.facultyId && r.faculty_id !== filters.facultyId) return false;
      if (filters?.classroomId && r.classroom_id !== filters.classroomId) return false;
      if (filters?.status && r.status !== filters.status) return false;
      return true;
    })
    .map((r) => {
      const p = profileMap.get(r.faculty_id);
      return {
        ...r,
        classroom: roomMap.get(r.classroom_id),
        faculty: p ? { id: p.id, username: p.username, full_name: p.full_name } : undefined,
      };
    })
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
}

// --------------------------------------------------------------------------------
// 8. ADMIN-ONLY ANALYTICS
// Computed strictly from real database records
// --------------------------------------------------------------------------------
export interface AnalyticsSummary {
  totalReservations: number;
  totalReservedHours: number;
  cancelledReservations: number;
  activeReservations: number;
  reservationsByFaculty: { faculty_name: string; count: number; hours: number }[];
  reservationsByClassroom: { room_number: string; count: number; hours: number }[];
  usageByFloor: { floor_name: string; count: number; hours: number }[];
  dailyTrends: { date: string; count: number }[];
}

export async function getAdminAnalytics(filters?: {
  floorId?: string;
  classroomId?: string;
  facultyId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AnalyticsSummary> {
  const reservations = await getReservations();
  const classrooms = await getClassrooms();
  const floors = await getFloors();

  const floorMap = new Map(floors.map((f) => [f.id, f.name]));
  const roomMap = new Map(classrooms.map((c) => [c.id, c]));

  let filtered = reservations;

  if (filters?.floorId) {
    filtered = filtered.filter((r) => roomMap.get(r.classroom_id)?.floor_id === filters.floorId);
  }
  if (filters?.classroomId) {
    filtered = filtered.filter((r) => r.classroom_id === filters.classroomId);
  }
  if (filters?.facultyId) {
    filtered = filtered.filter((r) => r.faculty_id === filters.facultyId);
  }
  if (filters?.startDate) {
    filtered = filtered.filter((r) => r.start_time >= filters.startDate!);
  }
  if (filters?.endDate) {
    filtered = filtered.filter((r) => r.start_time <= filters.endDate!);
  }

  let totalReservedHours = 0;
  let cancelledCount = 0;
  let activeCount = 0;

  const facultyStats = new Map<string, { count: number; hours: number }>();
  const classroomStats = new Map<string, { count: number; hours: number }>();
  const floorStats = new Map<string, { count: number; hours: number }>();
  const trendStats = new Map<string, number>();

  for (const r of filtered) {
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    const durationHours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));

    if (r.status === 'cancelled') {
      cancelledCount++;
    } else {
      activeCount++;
      totalReservedHours += durationHours;

      // Faculty breakdown
      const fName = r.faculty?.full_name || 'Unknown Faculty';
      const fStat = facultyStats.get(fName) || { count: 0, hours: 0 };
      fStat.count++;
      fStat.hours += durationHours;
      facultyStats.set(fName, fStat);

      // Classroom breakdown
      const rNum = r.classroom?.room_number || 'Unknown Room';
      const cStat = classroomStats.get(rNum) || { count: 0, hours: 0 };
      cStat.count++;
      cStat.hours += durationHours;
      classroomStats.set(rNum, cStat);

      // Floor breakdown
      const floorName = r.classroom?.floor_id
        ? floorMap.get(r.classroom.floor_id) || 'Unknown Floor'
        : 'Unknown Floor';
      const flStat = floorStats.get(floorName) || { count: 0, hours: 0 };
      flStat.count++;
      flStat.hours += durationHours;
      floorStats.set(floorName, flStat);

      // Daily trends
      const dateKey = r.start_time.split('T')[0];
      trendStats.set(dateKey, (trendStats.get(dateKey) || 0) + 1);
    }
  }

  return {
    totalReservations: filtered.length,
    totalReservedHours: parseFloat(totalReservedHours.toFixed(1)),
    cancelledReservations: cancelledCount,
    activeReservations: activeCount,
    reservationsByFaculty: Array.from(facultyStats.entries()).map(([faculty_name, s]) => ({
      faculty_name,
      count: s.count,
      hours: parseFloat(s.hours.toFixed(1)),
    })),
    reservationsByClassroom: Array.from(classroomStats.entries())
      .map(([room_number, s]) => ({
        room_number,
        count: s.count,
        hours: parseFloat(s.hours.toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count),
    usageByFloor: Array.from(floorStats.entries()).map(([floor_name, s]) => ({
      floor_name,
      count: s.count,
      hours: parseFloat(s.hours.toFixed(1)),
    })),
    dailyTrends: Array.from(trendStats.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// --------------------------------------------------------------------------------
// 9. AUDIT LOGGING
// --------------------------------------------------------------------------------
export function logAudit(log: Omit<AuditLog, 'id' | 'created_at'>): void {
  const logs = getLocal<AuditLog[]>(KEYS.AUDIT_LOGS, []);
  const newLog: AuditLog = {
    ...log,
    id: `log-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  logs.unshift(newLog);
  // Keep last 500 logs
  if (logs.length > 500) logs.pop();
  setLocal(KEYS.AUDIT_LOGS, logs);
}

export function getAuditLogs(): AuditLog[] {
  return getLocal<AuditLog[]>(KEYS.AUDIT_LOGS, []);
}

// Ensure database is initialized on module load
if (typeof window !== 'undefined') {
  initializeLocalDatabase();
}
