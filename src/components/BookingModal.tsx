import React, { useState } from 'react';
import type { Classroom } from '../types';
import { reserveClassroom } from '../services/storageEngine';
import { useAuth } from '../context/AuthContext';
import {
  CalendarCheck,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building,
  Users,
} from 'lucide-react';

interface BookingModalProps {
  classroom: Classroom;
  date: string;
  startTime: string;
  endTime: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  classroom,
  date,
  startTime,
  endTime,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const startIso = `${date}T${startTime}:00.000Z`;
  const endIso = `${date}T${endTime}:00.000Z`;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be logged in to reserve a classroom.');
      return;
    }
    if (!purpose.trim()) {
      setError('Please provide a purpose or activity title for this booking.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await reserveClassroom(classroom.id, startIso, endIso, purpose, user.id);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to complete reservation. Room may have just been booked.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarCheck size={24} />
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>RESERVE CLASSROOM</h2>
          </div>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '4px 8px', borderRadius: '4px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Room & Time Summary Box */}
        <div
          style={{
            border: '2px solid var(--color-purple)',
            padding: '16px',
            borderRadius: '6px',
            marginBottom: '20px',
            backgroundColor: 'var(--color-white)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
                Selected Room
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800 }}>{classroom.room_number}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <Building size={14} />
                <span>{classroom.floor?.name || 'Main Floor'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginTop: '4px' }}>
                <Users size={14} />
                <span>Capacity: {classroom.capacity} seats</span>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: '10px',
              borderTop: '1px solid var(--color-purple)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <Clock size={16} />
            <span>
              {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {startTime} to {endTime}
            </span>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="alert-box alert-solid" style={{ marginBottom: '16px' }}>
            <AlertCircle size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Reservation Blocked</div>
              <div style={{ fontSize: '13px' }}>{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="alert-box alert-outline" style={{ marginBottom: '16px' }}>
            <CheckCircle2 size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Booking Confirmed!</div>
              <div style={{ fontSize: '13px' }}>Classroom {classroom.room_number} has been allocated to you.</div>
            </div>
          </div>
        )}

        {/* Booking Form */}
        <form onSubmit={handleConfirm}>
          <div style={{ marginBottom: '20px' }}>
            <label>Purpose / Academic Activity Description *</label>
            <textarea
              rows={3}
              placeholder="e.g., Make-up Lecture for CS-204, Seminar on Distributed Systems, Faculty Committee Meeting"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={loading || success}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || success}
            >
              {loading ? 'Validating & Booking...' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
