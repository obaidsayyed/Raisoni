import React, { useState, useEffect, useCallback } from 'react';
import {
  getAdminAnalytics,
  getClassrooms,
  getFloors,
  getFacultyProfiles,
  type AnalyticsSummary,
} from '../services/storageEngine';
import type { Classroom, Floor, Profile } from '../types';
import {
  Calendar,
  Clock,
  Layers,
  Users,
  Building,
  XCircle,
  TrendingUp,
} from 'lucide-react';

export const AdminAnalyticsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [facultyList, setFacultyList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [floorId, setFloorId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stats, allRooms, allFloors, allFaculty] = await Promise.all([
        getAdminAnalytics({
          floorId: floorId || undefined,
          classroomId: classroomId || undefined,
          facultyId: facultyId || undefined,
          startDate: startDate ? `${startDate}T00:00:00.000Z` : undefined,
          endDate: endDate ? `${endDate}T23:59:59.999Z` : undefined,
        }),
        getClassrooms(),
        getFloors(),
        getFacultyProfiles(),
      ]);
      setAnalytics(stats);
      setClassrooms(allRooms);
      setFloors(allFloors);
      setFacultyList(allFaculty);
    } catch (e) {
      console.error('Failed to load analytics', e);
    } finally {
      setLoading(false);
    }
  }, [floorId, classroomId, facultyId, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          ADMINISTRATIVE USAGE & HISTORICAL ANALYTICS
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Real-time metrics computed directly from database reservation logs and classroom utilization records
        </p>
      </div>

      {/* Filter Section */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
          <div>
            <label>Floor</label>
            <select value={floorId} onChange={(e) => setFloorId(e.target.value)}>
              <option value="">All Floors</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Classroom</label>
            <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              <option value="">All Classrooms</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.room_number}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Faculty</label>
            <select value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
              <option value="">All Faculty</option>
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div>
            <label>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      {loading || !analytics ? (
        <div style={{ textAlign: 'center', padding: '60px 0', fontWeight: 700 }}>
          Aggregating reservation analytics...
        </div>
      ) : (
        <div>
          {/* Top KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
                <Calendar size={16} />
                Total Bookings
              </div>
              <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '8px' }}>
                {analytics.totalReservations}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                All recorded reservations
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
                <Clock size={16} />
                Total Reserved Hours
              </div>
              <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '8px' }}>
                {analytics.totalReservedHours} hrs
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                Cumulative academic usage
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
                <TrendingUp size={16} />
                Active Confirmed
              </div>
              <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '8px' }}>
                {analytics.activeReservations}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                Valid non-cancelled bookings
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
                <XCircle size={16} />
                Cancelled Bookings
              </div>
              <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '8px' }}>
                {analytics.cancelledReservations}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                Retained for audit history
              </div>
            </div>
          </div>

          {/* Daily Trends Chart strictly using Solid Purple & White */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} />
              Reservation Booking Trends
            </h3>

            {analytics.dailyTrends.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', opacity: 0.8, fontSize: '13px' }}>
                No daily reservation activity recorded for the selected filter interval.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '180px', minWidth: '400px', borderBottom: '2px solid var(--color-purple)', paddingBottom: '8px' }}>
                  {analytics.dailyTrends.map((t) => {
                    const maxCount = Math.max(...analytics.dailyTrends.map((d) => d.count), 1);
                    const heightPercent = Math.max(15, (t.count / maxCount) * 100);
                    return (
                      <div key={t.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>{t.count}</div>
                        <div
                          style={{
                            width: '32px',
                            height: `${heightPercent}%`,
                            backgroundColor: 'var(--color-purple)',
                            borderRadius: '4px 4px 0 0',
                          }}
                        />
                        <div style={{ fontSize: '11px', marginTop: '6px', whiteSpace: 'nowrap' }}>
                          {t.date.substring(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Detailed Tables Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
            {/* By Classroom */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={16} />
                Most Frequently Reserved Classrooms
              </h3>
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Bookings</th>
                    <th>Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.reservationsByClassroom.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center' }}>No data</td></tr>
                  ) : (
                    analytics.reservationsByClassroom.map((r) => (
                      <tr key={r.room_number}>
                        <td style={{ fontWeight: 800 }}>{r.room_number}</td>
                        <td style={{ fontWeight: 600 }}>{r.count} bookings</td>
                        <td>{r.hours} hrs</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* By Faculty */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} />
                Reservations by Faculty Member
              </h3>
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Faculty Name</th>
                    <th>Bookings</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.reservationsByFaculty.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center' }}>No data</td></tr>
                  ) : (
                    analytics.reservationsByFaculty.map((f) => (
                      <tr key={f.faculty_name}>
                        <td style={{ fontWeight: 700 }}>{f.faculty_name}</td>
                        <td style={{ fontWeight: 600 }}>{f.count} bookings</td>
                        <td>{f.hours} hrs</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* By Floor */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} />
                Classroom Usage by Floor
              </h3>
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Floor Level</th>
                    <th>Bookings</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.usageByFloor.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: 'center' }}>No data</td></tr>
                  ) : (
                    analytics.usageByFloor.map((fl) => (
                      <tr key={fl.floor_name}>
                        <td style={{ fontWeight: 700 }}>{fl.floor_name}</td>
                        <td style={{ fontWeight: 600 }}>{fl.count} bookings</td>
                        <td>{fl.hours} hrs</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
