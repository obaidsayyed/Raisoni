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
  const floors = getLocal<Floor[]>(KEYS.FLOORS, []);
  if (floors.length === 0) {
    const defaultFloors: Floor[] = [
      { id: 'fl-1', name: 'Ground Floor', display_order: 1, created_at: new Date().toISOString() },
      { id: 'fl-2', name: 'First Floor', display_order: 2, created_at: new Date().toISOString() },
      { id: 'fl-3', name: 'Second Floor', display_order: 3, created_at: new Date().toISOString() },
    ];
    setLocal(KEYS.FLOORS, defaultFloors);

    const defaultClassrooms: Classroom[] = [
      { id: 'cr-101', room_number: 'G-101', floor_id: 'fl-1', capacity: 60, is_active: true },
      { id: 'cr-102', room_number: 'G-102', floor_id: 'fl-1', capacity: 45, is_active: true },
      { id: 'cr-103', room_number: 'G-103', floor_id: 'fl-1', capacity: 50, is_active: true },
      { id: 'cr-201', room_number: 'F-201', floor_id: 'fl-2', capacity: 60, is_active: true },
      { id: 'cr-202', room_number: 'F-202', floor_id: 'fl-2', capacity: 40, is_active: true },
      { id: 'cr-203', room_number: 'F-203', floor_id: 'fl-2', capacity: 75, is_active: true },
      { id: 'cr-301', room_number: 'S-301', floor_id: 'fl-3', capacity: 50, is_active: true },
      { id: 'cr-302', room_number: 'S-302', floor_id: 'fl-3', capacity: 55, is_active: true },
    ];
    setLocal(KEYS.CLASSROOMS, defaultClassrooms);

    // Default official timetable events (Mon-Fri lectures)
    const defaultTimetable: TimetableEvent[] = [
      {
        id: 'tt-1',
        classroom_id: 'cr-101',
        subject: 'Data Structures & Algorithms',
        faculty_name: 'Dr. Robert Lang',
        day_of_week: 1, // Mon
        start_time: '09:00',
        end_time: '10:30',
        semester: 'Semester 3',
        is_active: true,
      },
      {
        id: 'tt-2',
        classroom_id: 'cr-101',
        subject: 'Database Management Systems',
        faculty_name: 'Prof. Sarah Jenkins',
        day_of_week: 1, // Mon
        start_time: '11:00',
        end_time: '12:30',
        semester: 'Semester 3',
        is_active: true,
      },
      {
        id: 'tt-3',
        classroom_id: 'cr-201',
        subject: 'Operating Systems Architecture',
        faculty_name: 'Dr. Michael Chang',
        day_of_week: 2, // Tue
        start_time: '10:00',
        end_time: '11:30',
        semester: 'Semester 5',
        is_active: true,
      },
      {
        id: 'tt-4',
        classroom_id: 'cr-202',
        subject: 'Computer Networks',
        faculty_name: 'Prof. Anita Sharma',
        day_of_week: 3, // Wed
        start_time: '14:00',
        end_time: '15:30',
        semester: 'Semester 5',
        is_active: true,
      },
      {
        id: 'tt-5',
        classroom_id: 'cr-301',
        subject: 'Artificial Intelligence & Robotics',
        faculty_name: 'Dr. David Vance',
        day_of_week: 4, // Thu
        start_time: '09:30',
        end_time: '11:00',
        semester: 'Semester 7',
        is_active: true,
      },
    ];
    setLocal(KEYS.TIMETABLE, defaultTimetable);

    // Initial faculty accounts for testing
    const defaultProfiles: Profile[] = [
      {
        id: 'fac-1',
        username: 'prof.smith',
        full_name: 'Prof. John Smith',
        role: 'faculty',
        status: 'active',
        must_change_password: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'fac-2',
        username: 'dr.watson',
        full_name: 'Dr. Clara Watson',
        role: 'faculty',
        status: 'active',
        must_change_password: false,
        created_at: new Date().toISOString(),
      },
    ];
    setLocal(KEYS.PROFILES, defaultProfiles);

    const defaultPasswords: Record<string, string> = {
      'prof.smith': 'Faculty@123',
      'dr.watson': 'Faculty@123',
    };
    setLocal(KEYS.PASSWORDS, defaultPasswords);
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

// --------------------------------------------------------------------------------
// 4. FLOORS & CLASSROOMS CRUD
// --------------------------------------------------------------------------------
export async function getFloors(): Promise<Floor[]> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase.from('floors').select('*').order('display_order');
    if (!error && data && data.length > 0) return data as Floor[];
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
    const { error } = await supabase.from('floors').delete().eq('id', id);
    if (error) throw new Error(error.message);
    broadcastChange('floors', 'DELETE', { id });
    return;
  }

  const classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
  if (classrooms.some((c) => c.floor_id === id)) {
    throw new Error('Cannot delete floor that still has assigned classrooms.');
  }

  let floors = getLocal<Floor[]>(KEYS.FLOORS, []);
  floors = floors.filter((f) => f.id !== id);
  setLocal(KEYS.FLOORS, floors);
  broadcastChange('floors', 'DELETE', { id });
}

export async function getClassrooms(): Promise<Classroom[]> {
  const config = getSupabaseConfigStatus();
  if (config.isConfigured) {
    const { data, error } = await supabase
      .from('classrooms')
      .select('*, floor:floors(*)')
      .order('room_number');
    if (!error && data && data.length > 0) return data as Classroom[];
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
  capacity: number
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
    if (error) throw new Error(error.message);
    broadcastChange('classrooms', 'DELETE', { id });
    return;
  }

  const timetable = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  const reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);

  const hasTimetable = timetable.some((t) => t.classroom_id === id);
  const hasReservations = reservations.some((r) => r.classroom_id === id);

  if (hasTimetable || hasReservations) {
    throw new Error(
      'Cannot delete classroom with existing timetable schedules or reservation history. Please deactivate it instead.'
    );
  }

  let classrooms = getLocal<Classroom[]>(KEYS.CLASSROOMS, []);
  classrooms = classrooms.filter((c) => c.id !== id);
  setLocal(KEYS.CLASSROOMS, classrooms);
  broadcastChange('classrooms', 'DELETE', { id });
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
    if (!error && data) return data as TimetableEvent[];
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
  const reservations = getLocal<Reservation[]>(KEYS.RESERVATIONS, []);
  const profiles = getLocal<Profile[]>(KEYS.PROFILES, []);
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const conflicts: Reservation[] = [];

  for (const res of reservations) {
    if (res.classroom_id !== classroomId || res.status !== 'confirmed') continue;

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
      const prof = profileMap.get(res.faculty_id);
      conflicts.push({
        ...res,
        faculty: prof
          ? { id: prof.id, username: prof.username, full_name: prof.full_name }
          : undefined,
      });
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

  const events = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  const newEvent: TimetableEvent = {
    ...event,
    id: `tt-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  events.push(newEvent);
  setLocal(KEYS.TIMETABLE, events);
  broadcastChange('timetable_events', 'INSERT', newEvent);
  return { event: newEvent };
}

export async function deleteTimetableEvent(id: string): Promise<void> {
  let events = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);
  events = events.filter((e) => e.id !== id);
  setLocal(KEYS.TIMETABLE, events);
  broadcastChange('timetable_events', 'DELETE', { id });
}

export async function parseAndValidateTimetableImport(
  rawText: string
): Promise<{ rows: TimetableImportRow[]; validCount: number; errorCount: number }> {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('Timetable file must contain a header row and at least one data row.');
  }

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const roomIdx = header.findIndex((h) => h.includes('room'));
  const subjectIdx = header.findIndex((h) => h.includes('subject') || h.includes('course'));
  const facultyIdx = header.findIndex((h) => h.includes('faculty') || h.includes('teacher') || h.includes('prof'));
  const dayIdx = header.findIndex((h) => h.includes('day'));
  const startIdx = header.findIndex((h) => h.includes('start'));
  const endIdx = header.findIndex((h) => h.includes('end'));
  const semesterIdx = header.findIndex((h) => h.includes('semester'));

  if (roomIdx === -1 || subjectIdx === -1 || facultyIdx === -1 || dayIdx === -1 || startIdx === -1 || endIdx === -1) {
    throw new Error(
      'Missing required columns. Expected header columns: Room Number, Subject, Faculty, Day (1-7), Start Time (HH:mm), End Time (HH:mm)'
    );
  }

  const classrooms = await getClassrooms();
  const roomNumberMap = new Map(classrooms.map((c) => [c.room_number.toUpperCase(), c]));

  const rows: TimetableImportRow[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < 6) continue;

    const roomNum = cols[roomIdx]?.toUpperCase() || '';
    const subject = cols[subjectIdx] || '';
    const faculty = cols[facultyIdx] || '';
    const dayVal = parseInt(cols[dayIdx], 10);
    const start = cols[startIdx] || '';
    const end = cols[endIdx] || '';
    const semester = semesterIdx !== -1 ? cols[semesterIdx] : 'Current Semester';

    const row: TimetableImportRow = {
      room_number: roomNum,
      subject,
      faculty_name: faculty,
      day_of_week: dayVal,
      start_time: start,
      end_time: end,
      semester,
    };

    if (!roomNumberMap.has(roomNum)) {
      row.error = `Classroom "${roomNum}" does not exist in the database.`;
      errorCount++;
    } else if (isNaN(dayVal) || dayVal < 1 || dayVal > 7) {
      row.error = `Invalid Day of Week "${cols[dayIdx]}". Must be an integer between 1 (Monday) and 7 (Sunday).`;
      errorCount++;
    } else if (!/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end)) {
      row.error = `Invalid Time Format. Expected HH:mm (24-hour format).`;
      errorCount++;
    } else if (end <= start) {
      row.error = `End time (${end}) must be strictly after start time (${start}).`;
      errorCount++;
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

  return { rows, validCount, errorCount };
}

export async function commitTimetableImport(rows: TimetableImportRow[]): Promise<number> {
  const classrooms = await getClassrooms();
  const roomMap = new Map(classrooms.map((c) => [c.room_number.toUpperCase(), c]));
  const events = getLocal<TimetableEvent[]>(KEYS.TIMETABLE, []);

  let committed = 0;
  for (const row of rows) {
    if (row.error) continue; // Skip invalid rows
    const room = roomMap.get(row.room_number);
    if (!room) continue;

    events.push({
      id: `tt-${Date.now()}-${committed}`,
      classroom_id: room.id,
      subject: row.subject,
      faculty_name: row.faculty_name,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      semester: row.semester || 'Current Semester',
      is_active: true,
      created_at: new Date().toISOString(),
    });
    committed++;
  }

  setLocal(KEYS.TIMETABLE, events);
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

  return { available: true, reason: 'Classroom is available for booking.' };
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
