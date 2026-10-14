import React, { useState, useEffect, useCallback } from 'react';
import type { TimetableEvent, Classroom } from '../types';
import {
  getTimetableEvents,
  getClassrooms,
  deleteTimetableEvent,
  subscribeToRealtimeChanges,
} from '../services/storageEngine';
import { useAuth } from '../context/AuthContext';
import { TimetableUploadModal } from '../components/TimetableUploadModal';
import { TimetableManualModal } from '../components/TimetableManualModal';
import {
  BookOpen,
  Upload,
  PlusCircle,
  Trash2,
  Clock,
  User,
  Building,
} from 'lucide-react';

export const TimetableView: React.FC = () => {
  const { role } = useAuth();
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = all days
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [allEvents, allRooms] = await Promise.all([
        getTimetableEvents(),
        getClassrooms(),
      ]);
      setEvents(allEvents);
      setClassrooms(allRooms);
    } catch (e) {
      console.error('Failed to load timetable', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtimeChanges(() => loadData());
    return () => unsub();
  }, [loadData]);

  const handleDelete = async (id: string, subject: string) => {
    if (confirm(`Are you sure you want to remove lecture "${subject}" from the official timetable?`)) {
      try {
        await deleteTimetableEvent(id);
        loadData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete timetable event.');
      }
    }
  };

  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const filteredEvents = events.filter((e) => {
    if (selectedDay !== 0 && e.day_of_week !== selectedDay) return false;
    if (selectedRoomId && e.classroom_id !== selectedRoomId) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Header & Admin Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
            OFFICIAL COLLEGE TIMETABLE
          </h1>
          <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
            Semester scheduled courses and recurring classroom assignments
          </p>
        </div>

        {role === 'admin' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowManualModal(true)}
              className="btn-secondary"
            >
              <PlusCircle size={16} />
              Add Lecture
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary"
            >
              <Upload size={16} />
              Import Timetable (CSV)
            </button>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ marginBottom: '4px' }}>Day of Week</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              style={{ minWidth: '160px' }}
            >
              <option value={0}>All Days (Mon - Sun)</option>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
              <option value={6}>Saturday</option>
              <option value={7}>Sunday</option>
            </select>
          </div>

          <div>
            <label style={{ marginBottom: '4px' }}>Classroom</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              style={{ minWidth: '180px' }}
            >
              <option value="">All Classrooms</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.room_number} ({c.floor?.name || 'Main'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: '13px', fontWeight: 600 }}>
            <span className="badge-outline">Total Lectures: {filteredEvents.length}</span>
          </div>
        </div>
      </div>

      {/* Timetable Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', fontWeight: 700 }}>
          Loading official timetable...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
          <BookOpen size={48} style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>No Lectures Scheduled for Selection</h3>
          <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>
            There are no official lectures registered matching the selected day or classroom filter.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="allocator-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time Slot</th>
                <th>Classroom</th>
                <th>Course / Subject</th>
                <th>Instructor / Faculty</th>
                <th>Semester</th>
                {role === 'admin' && <th style={{ textAlign: 'center' }}>Admin Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 700 }}>{dayNames[e.day_of_week]}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={13} />
                      {e.start_time} - {e.end_time}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building size={13} />
                      {e.classroom?.room_number || 'Room'}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{e.subject}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={13} />
                      {e.faculty_name}
                    </div>
                  </td>
                  <td>{e.semester}</td>
                  {role === 'admin' && (
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(e.id, e.subject)}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        title="Remove Lecture"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <TimetableUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={loadData}
        />
      )}

      {/* Manual Modal */}
      {showManualModal && (
        <TimetableManualModal
          classrooms={classrooms}
          onClose={() => setShowManualModal(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
