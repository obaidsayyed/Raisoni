import React from 'react';
import type { Classroom, AvailabilityResult } from '../types';
import {
  CheckCircle,
  BookOpen,
  CalendarCheck,
  AlertTriangle,
  Clock,
  User,
} from 'lucide-react';

interface RoomCardProps {
  classroom: Classroom;
  availability: AvailabilityResult;
  onReserve: (classroom: Classroom) => void;
  isReaderMode: boolean;
  isPastSlot?: boolean;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  classroom,
  availability,
  onReserve,
  isReaderMode,
  isPastSlot = false,
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
                letterSpacing: '0.6px',
                color: isLecture ? 'var(--color-tint-soft)' : 'var(--color-text-muted)',
              }}
            >
              {classroom.floor?.name || 'Main Wing'}
            </span>
            <h3
              className="room-card-number"
              style={{
                fontSize: '22px',
                fontWeight: 800,
                lineHeight: 1.2,
                marginTop: '2px',
                color: isLecture ? '#FFFFFF' : 'var(--color-primary-dark)',
              }}
            >
              {classroom.room_number}
            </h3>
          </div>

          {/* State Badge with Icon */}
          <div>
            {isInactive && (
              <span className="badge-outline" style={{ borderStyle: 'dashed', opacity: 0.8 }}>
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
              <span className="badge-outline">
                <CalendarCheck size={12} />
                RESERVED
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Details depending on state */}
      <div className="room-card-body" style={{ margin: '16px 0', fontSize: '13px' }}>
        {isAvailable && isPastSlot && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--color-tint-subtle)',
              border: '1px solid var(--color-tint-border-subtle)',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>Time Slot Passed</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              This time slot has already passed and can no longer be reserved.
            </div>
          </div>
        )}

        {isAvailable && !isPastSlot && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--color-tint-subtle)',
              border: '1px solid var(--color-tint-border-subtle)',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>Ready for Allocation</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              No scheduled lectures or faculty reservations in this interval.
            </div>
          </div>
        )}

        {isLecture && availability.details && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px', color: '#FFFFFF' }}>
              {availability.details.subject}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', color: 'var(--color-tint-soft)', fontSize: '12px' }}>
              <User size={13} />
              <span>{availability.details.faculty_name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-tint-soft)', fontSize: '12px' }}>
              <Clock size={13} />
              <span>Time: {availability.details.start_time} - {availability.details.end_time}</span>
            </div>
          </div>
        )}

        {isFacultyReserved && availability.details && (
          <div
            style={{
              padding: '10px 12px',
              border: '1px solid var(--color-accent-border)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-white)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '4px', color: 'var(--color-primary-dark)' }}>
              Faculty Reservation
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', fontSize: '12px' }}>
              <User size={13} color="var(--color-accent)" />
              <span style={{ fontWeight: 600 }}>{availability.details.faculty_name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              <Clock size={13} />
              <span>
                {new Date(availability.details.start_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(availability.details.end_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {availability.details.purpose && (
              <div style={{ fontSize: '12px', marginTop: '4px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                "{availability.details.purpose}"
              </div>
            )}
          </div>
        )}

        {isInactive && (
          <div style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '12px' }}>
            Room currently unavailable for reservations due to scheduled maintenance.
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div>
        {isAvailable ? (
          isPastSlot ? (
            <button
              disabled
              className="btn-secondary"
              style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
              title="Cannot reserve classroom for a past date or time"
            >
              Time Slot Passed
            </button>
          ) : (
            <button
              onClick={() => onReserve(classroom)}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              <CalendarCheck size={15} />
              {isReaderMode ? 'Sign In to Reserve' : 'Reserve Classroom'}
            </button>
          )
        ) : (
          <button
            disabled
            className="btn-secondary"
            style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
          >
            Unavailable in Selected Interval
          </button>
        )}
      </div>
    </div>
  );
};
