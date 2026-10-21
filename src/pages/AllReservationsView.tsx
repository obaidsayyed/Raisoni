import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useFeedback } from '../context/FeedbackContext';

export const AllReservationsView: React.FC = () => {
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [facultyList, setFacultyList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [facultyFilter, setFacultyFilter] = useState('');
  const [classroomFilter, setClassroomFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'last_week' | 'last_month' | 'custom' | 'all'>('today');
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

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

  const handleAdminCancel = (id: string, roomNum: string, facultyName: string) => {
    if (!user) return;
    confirm({
      title: 'Cancel Reservation',
      message: `Administrator Action: Are you sure you want to cancel the schedule for ${roomNum} made by ${facultyName}?`,
      confirmText: 'Cancel Schedule',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await cancelReservation(id, user.id, true);
          toast.success(`Schedule for ${roomNum} cancelled.`);
          loadData();
        } catch (err: any) {
          toast.error(err.message || 'Failed to cancel reservation.');
        }
      },
    });
  };

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (facultyFilter && r.faculty_id !== facultyFilter) return false;
      if (classroomFilter && r.classroom_id !== classroomFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      // Date filtering (defaults to Today)
      if (dateFilter !== 'all') {
        const resStart = new Date(r.start_time);
        const resYear = resStart.getFullYear();
        const resMonth = String(resStart.getMonth() + 1).padStart(2, '0');
        const resDay = String(resStart.getDate()).padStart(2, '0');
        const resDateStr = `${resYear}-${resMonth}-${resDay}`;

        const now = new Date();
        const todayYear = now.getFullYear();
        const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
        const todayDay = String(now.getDate()).padStart(2, '0');
        const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

        if (dateFilter === 'today') {
          if (resDateStr !== todayStr) return false;
        } else if (dateFilter === 'yesterday') {
          const yest = new Date(now);
          yest.setDate(yest.getDate() - 1);
          const yYear = yest.getFullYear();
          const yMonth = String(yest.getMonth() + 1).padStart(2, '0');
          const yDay = String(yest.getDate()).padStart(2, '0');
          const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;
          if (resDateStr !== yesterdayStr) return false;
        } else if (dateFilter === 'last_week') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          const endOfToday = new Date(now);
          endOfToday.setHours(23, 59, 59, 999);
          if (resStart < sevenDaysAgo || resStart > endOfToday) return false;
        } else if (dateFilter === 'last_month') {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          thirtyDaysAgo.setHours(0, 0, 0, 0);
          const endOfToday = new Date(now);
          endOfToday.setHours(23, 59, 59, 999);
          if (resStart < thirtyDaysAgo || resStart > endOfToday) return false;
        } else if (dateFilter === 'custom') {
          if (customDate && resDateStr !== customDate) return false;
        }
      }

      return true;
    });
  }, [reservations, facultyFilter, classroomFilter, statusFilter, dateFilter, customDate]);

  return (
    <div className="page-container">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          ALL FACULTY RESERVATIONS
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Comprehensive oversight of all college classroom schedules across all departments
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div className="all-reservations-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} />
              Date Filter
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_week">Last Week</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date</option>
              <option value="all">All Dates</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} />
                Select Date
              </label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
          )}

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
              Schedule Status
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
            <span className="badge-outline">Showing: {filtered.length} Schedules</span>
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
        <div className="table-responsive">
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
                          title="Cancel Schedule"
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
