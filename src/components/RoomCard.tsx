import React from 'react';
import type { Classroom, AvailabilityResult } from '../types';
import {
  CheckCircle,
  BookOpen,
  CalendarCheck,
  AlertTriangle,
  Users,
  Clock,
  User,
} from 'lucide-react';

interface RoomCardProps {
  classroom: Classroom;
  availability: AvailabilityResult;
  onReserve: (classroom: Classroom) => void;
  isReaderMode: boolean;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  classroom,
  availability,
  onReserve,
  isReaderMode,
}) => {
  const isAvailable = availability.available;
  const isLecture = availability.conflict_type === 'timetable';
  const isFacultyReserved = availability.conflict_type === 'reservation';
  const isInactive = !classroom.is_active || availability.conflict_type === 'inactive';

  // State class mapping
  let stateClass = 'state-available';
  if (isInactive) stateClass = 'state-inactive';
  else if (isLecture) stateClass = 'state-occupied';
  else if (isFacultyReserved) stateClass = 'state-reserved';

  return (
    <div className={`room-card ${stateClass}`}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div>
            <span
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.5px',
                opacity: isLecture ? 0.9 : 0.7,
              }}
            >
              {classroom.floor?.name || 'Main Wing'}
            </span>
            <h3 style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1.1, marginTop: '2px' }}>
              {classroom.room_number}
            </h3>
          </div>

          {/* State Badge with Icon */}
          <div>
            {isInactive && (
              <span className="badge-outline" style={{ borderStyle: 'dotted' }}>
                <AlertTriangle size={12} />
                INACTIVE
              </span>
            )}
            {isAvailable && (
              <span className="badge-outline">
                <CheckCircle size={12} />
                AVAILABLE
              </span>
            )}
            {isLecture && (
              <span className="badge-solid">
                <BookOpen size={12} />
                LECTURE
              </span>
            )}
            {isFacultyReserved && (
              <span className="badge-outline" style={{ borderStyle: 'dashed' }}>
                <CalendarCheck size={12} />
                RESERVED
              </span>
            )}
          </div>
        </div>

        {/* Room Capacity */}
        <div
          className="room-meta"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            marginTop: '8px',
          }}
        >
          <Users size={14} />
          Capacity: {classroom.capacity} Students
        </div>
      </div>

      {/* Middle: Details depending on state */}
      <div style={{ margin: '16px 0', fontSize: '13px' }}>
        {isAvailable && (
          <div style={{ padding: '8px 0', borderTop: '1px solid var(--color-purple)', borderBottom: '1px solid var(--color-purple)' }}>
            <div style={{ fontWeight: 600 }}>Ready for Allocation</div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>No scheduled lectures or faculty reservations in this interval.</div>
          </div>
        )}

        {isLecture && availability.details && (
          <div
            style={{
              padding: '10px',
              backgroundColor: 'var(--color-white)',
              color: 'var(--color-purple)',
              borderRadius: '4px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
              {availability.details.subject}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <User size={13} />
              <span>{availability.details.faculty_name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} />
              <span>Time: {availability.details.start_time} - {availability.details.end_time}</span>
            </div>
          </div>
        )}

        {isFacultyReserved && availability.details && (
          <div
            style={{
              padding: '10px',
              border: '1px solid var(--color-purple)',
              borderRadius: '4px',
              backgroundColor: 'var(--color-white)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '4px' }}>
              Faculty Reservation
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <User size={13} />
              <span style={{ fontWeight: 600 }}>{availability.details.faculty_name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} />
              <span>{new Date(availability.details.start_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(availability.details.end_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {availability.details.purpose && (
              <div style={{ fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>
                "{availability.details.purpose}"
              </div>
            )}
          </div>
        )}

        {isInactive && (
          <div style={{ fontStyle: 'italic', opacity: 0.8 }}>
            Room currently unavailable for reservations due to scheduled maintenance.
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div>
        {isAvailable ? (
          <button
            onClick={() => onReserve(classroom)}
            className={isLecture ? 'btn-secondary' : 'btn-primary'}
            style={{ width: '100%' }}
          >
            <CalendarCheck size={16} />
            {isReaderMode ? 'Sign In to Reserve' : 'Reserve Classroom'}
          </button>
        ) : (
          <button
            disabled
            className="btn-secondary"
            style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}
          >
            Unavailable in Selected Interval
          </button>
        )}
      </div>
    </div>
  );
};
