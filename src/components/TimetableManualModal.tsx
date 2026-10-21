import React, { useState } from 'react';
import type { Classroom, Reservation } from '../types';
import { createTimetableEvent } from '../services/storageEngine';
import { PlusCircle, X, AlertTriangle } from 'lucide-react';

interface TimetableManualModalProps {
  classrooms: Classroom[];
  onClose: () => void;
  onSuccess: () => void;
}

export const TimetableManualModal: React.FC<TimetableManualModalProps> = ({
  classrooms,
  onClose,
  onSuccess,
}) => {
  const [classroomId, setClassroomId] = useState(classrooms[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [semester, setSemester] = useState('Fall 2026');
  const [section, setSection] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [conflicts, setConflicts] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classroomId || !subject || !facultyName) {
      setError('Please fill in all required fields.');
      return;
    }
    if (endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }

    setLoading(true);
    setError(null);
    setConflicts([]);

    try {
      const res = await createTimetableEvent({
        classroom_id: classroomId,
        subject: subject.trim(),
        faculty_name: facultyName.trim(),
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        semester: semester.trim(),
        section: section.trim() || undefined,
        specific_date: specificDate ? specificDate : null,
        is_active: true,
      });

      if (res.conflicts && res.conflicts.length > 0) {
        setConflicts(res.conflicts);
        setError(
          `Cannot schedule: This slot conflicts with ${res.conflicts.length} active faculty reservation(s). You must resolve or cancel the conflicting reservations first.`
        );
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save timetable event.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={24} />
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>ADD TIMETABLE LECTURE</h2>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="alert-box alert-solid" style={{ marginBottom: '16px' }}>
            <AlertTriangle size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Schedule Conflict</div>
              <div style={{ fontSize: '13px' }}>{error}</div>
            </div>
          </div>
        )}

        {conflicts.length > 0 && (
          <div
            style={{
              border: '2px solid var(--color-purple)',
              padding: '12px',
              borderRadius: '6px',
              marginBottom: '16px',
              backgroundColor: 'var(--color-white)',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
              Conflicting Active Reservations:
            </div>
            {conflicts.map((c) => (
              <div key={c.id} style={{ fontSize: '12px', borderBottom: '1px solid var(--color-purple)', padding: '6px 0' }}>
                • Reserved by <strong>{c.faculty?.full_name || 'Faculty'}</strong> ({new Date(c.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(c.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                <br />
                Purpose: "{c.purpose}"
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label>Classroom *</label>
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              required
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.room_number} ({c.floor?.name || 'Main Floor'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid-2" style={{ marginBottom: '14px' }}>
            <div>
              <label>Course / Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Distributed Systems"
                required
                minLength={2}
                maxLength={80}
              />
              <div className="form-helper">2 to 80 characters</div>
            </div>
            <div>
              <label>Instructor / Faculty *</label>
              <input
                type="text"
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                placeholder="e.g. Dr. Alan Turing"
                required
                minLength={2}
                maxLength={80}
              />
              <div className="form-helper">Faculty display name</div>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: '14px' }}>
            <div>
              <label>Day of Week *</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                required
              >
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>
            <div>
              <label>Start Time *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label>End Time *</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: '20px' }}>
            <div>
              <label>Section / Batch (Optional)</label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. BCA A"
                maxLength={30}
              />
            </div>
            <div>
              <label>Semester / Term (Optional)</label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="e.g. Sem V, Fall 2024"
                maxLength={30}
              />
            </div>
            <div>
              <label>Specific Date (Optional)</label>
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Checking Conflicts...' : 'Save Lecture Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
