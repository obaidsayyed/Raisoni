import React, { useState, useEffect, useCallback } from 'react';
import type { Reservation, Classroom, Profile } from '../types';
import {
  getReservations,
  getClassrooms,
  getFacultyProfiles,
  cancelReservation,
  subscribeToRealtimeChanges,
} from '../services/storageEngine';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Clock,
  User,
  Building,
  CheckCircle2,
  XCircle,
  Filter,
  Trash2,
} from 'lucide-react';

export const AllReservationsView: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [facultyList, setFacultyList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [facultyFilter, setFacultyFilter] = useState('');
  const [classroomFilter, setClassroomFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all');

  const loadData = useCallback(async () => {
    try {
      const [allRes, allRooms, allFaculty] = await Promise.all([
        getReservations(),
        getClassrooms(),
        getFacultyProfiles(),
      ]);
      setReservations(allRes);
      setClassrooms(allRooms);
      setFacultyList(allFaculty);
    } catch (e) {
      console.error('Failed to load reservations', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtimeChanges(() => loadData());
    return () => unsub();
  }, [loadData]);

  const handleAdminCancel = async (id: string, roomNum: string, facultyName: string) => {
    if (!user) return;
    if (confirm(`Administrator Action: Are you sure you want to cancel the booking for ${roomNum} made by ${facultyName}?`)) {
      try {
        await cancelReservation(id, user.id, true);
        loadData();
      } catch (err: any) {
        alert(err.message || 'Failed to cancel reservation.');
      }
    }
  };

  const filtered = reservations.filter((r) => {
    if (facultyFilter && r.faculty_id !== facultyFilter) return false;
    if (classroomFilter && r.classroom_id !== classroomFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          ALL FACULTY RESERVATIONS
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Comprehensive oversight of all college classroom bookings across all departments
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} />
              Faculty Member
            </label>
            <select
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
            >
              <option value="">All Faculty Members</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.full_name} ({f.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building size={14} />
              Classroom
            </label>
            <select
              value={classroomFilter}
              onChange={(e) => setClassroomFilter(e.target.value)}
            >
              <option value="">All Classrooms</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.room_number} ({c.floor?.name || 'Main'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} />
              Booking Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed Only</option>
              <option value="cancelled">Cancelled Only</option>
            </select>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            <span className="badge-outline">Showing: {filtered.length} Bookings</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', fontWeight: 700 }}>
          Loading all reservation records...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
          <Calendar size={48} style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>No Matching Reservations</h3>
          <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>
            No records matched the filter criteria.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="allocator-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Classroom</th>
                <th>Faculty Member</th>
                <th>Date</th>
                <th>Time Interval</th>
                <th>Purpose</th>
                <th style={{ textAlign: 'center' }}>Admin Control</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isConfirmed = r.status === 'confirmed';
                const start = new Date(r.start_time);
                const end = new Date(r.end_time);

                return (
                  <tr key={r.id}>
                    <td>
                      {isConfirmed ? (
                        <span className="badge-solid">
                          <CheckCircle2 size={11} />
                          CONFIRMED
                        </span>
                      ) : (
                        <span className="badge-outline" style={{ borderStyle: 'dotted' }}>
                          <XCircle size={11} />
                          CANCELLED
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      {r.classroom?.room_number || 'Room'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.faculty?.full_name || 'Faculty'}</div>
                      <div style={{ fontSize: '11px', opacity: 0.7 }}>@{r.faculty?.username}</div>
                    </td>
                    <td>{start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} />
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>{r.purpose}</td>
                    <td style={{ textAlign: 'center' }}>
                      {isConfirmed && (
                        <button
                          onClick={() => handleAdminCancel(r.id, r.classroom?.room_number || '', r.faculty?.full_name || '')}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="Cancel Booking"
                        >
                          <Trash2 size={13} />
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
