export type UserRole = 'admin' | 'faculty' | 'reader';
export type AccountStatus = 'active' | 'disabled';
export type ReservationStatus = 'confirmed' | 'cancelled';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  status: AccountStatus;
  must_change_password?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Floor {
  id: string;
  name: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Classroom {
  id: string;
  room_number: string;
  floor_id: string;
  capacity: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  floor?: Floor;
}

export interface TimetableEvent {
  id: string;
  classroom_id: string;
  subject: string;
  faculty_name: string;
  day_of_week: number; // 1 = Mon, 6 = Sat
  start_time: string; // HH:mm:ss or HH:mm
  end_time: string; // HH:mm:ss or HH:mm
  specific_date?: string | null; // YYYY-MM-DD
  semester: string;
  section?: string;
  is_active: boolean;
  created_at?: string;
  classroom?: Classroom;
}

export interface Reservation {
  id: string;
  classroom_id: string;
  faculty_id: string;
  start_time: string; // ISO 8601 string
  end_time: string; // ISO 8601 string
  purpose: string;
  status: ReservationStatus;
  created_at?: string;
  updated_at?: string;
  classroom?: Classroom;
  faculty?: {
    id: string;
    username: string;
    full_name: string;
  };
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  created_at: string;
  actor?: {
    username: string;
    full_name: string;
  };
}

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  conflict_type?: 'none' | 'timetable' | 'reservation' | 'inactive';
  details?: {
    subject?: string;
    faculty_name?: string;
    purpose?: string;
    start_time?: string;
    end_time?: string;
  };
}

export interface MissingClassroomInfo {
  room_number: string;
  floor_name: string;
}

export interface TimetableImportRow {
  room_number: string;
  floor_name?: string;
  subject: string;
  faculty_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section?: string;
  semester?: string;
  specific_date?: string;
  error?: string;
  conflictWithReservation?: Reservation;
}

