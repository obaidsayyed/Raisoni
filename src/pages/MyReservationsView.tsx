import React, { useState, useEffect, useCallback } from 'react';
import type { Reservation } from '../types';
import {
  getReservations,
  cancelReservation,
  subscribeToRealtimeChanges,
} from '../services/storageEngine';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  Clock,
  Building,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export const MyReservationsView: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const all = await getReservations({ facultyId: user.id });
      setReservations(all);
    } catch (e) {
      console.error('Failed to load reservations', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtimeChanges(() => loadData());
    return () => unsub();
  }, [loadData]);

  const handleCancel = async (id: string, roomNum: string) => {
    if (!user) return;
    if (confirm(`Are you sure you want to cancel your reservation for room ${roomNum}?`)) {
      try {
        setError(null);
        await cancelReservation(id, user.id, user.role === 'admin');
        loadData();
      } catch (err: any) {
        setError(err.message || 'Failed to cancel reservation.');
      }
    }
  };

  const now = new Date().toISOString();
  const upcomingReservations = reservations.filter((r) => r.end_time >= now);
  const pastReservations = reservations.filter((r) => r.end_time < now);

  const displayed =
    activeTab === 'upcoming'
      ? upcomingReservations
      : activeTab === 'past'
      ? pastReservations
      : reservations;

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          MY CLASSROOM RESERVATIONS
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Track and manage your upcoming bookings and past academic reservation history
        </p>
      </div>

      {error && (
        <div className="alert-box alert-solid" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Action Error</div>
            <div style={{ fontSize: '13px' }}>{error}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '6px 14px' }}
        >
          Upcoming Bookings ({upcomingReservations.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={activeTab === 'past' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '6px 14px' }}
        >
          Past History ({pastReservations.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}
          style={{ padding: '6px 14px' }}
        >
          All ({reservations.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', fontWeight: 700 }}>
          Loading your reservations...
        </div>
      ) : displayed.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
          <Calendar size={48} style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>No Reservations Found</h3>
          <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>
            You do not have any {activeTab === 'all' ? '' : activeTab} classroom reservations.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {displayed.map((r) => {
            const isConfirmed = r.status === 'confirmed';
            const isUpcoming = r.end_time >= now;
            const startDate = new Date(r.start_time);
            const endDate = new Date(r.end_time);

            return (
              <div
                key={r.id}
                className="card"
                style={{
                  borderWidth: '2px',
                  borderStyle: isConfirmed ? 'solid' : 'dashed',
                  opacity: isConfirmed ? 1 : 0.7,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '20px', fontWeight: 800 }}>
                        {r.classroom?.room_number || 'Room'}
                      </span>
                      <span className="badge-outline">
                        <Building size={12} />
                        {r.classroom?.floor?.name || 'Floor'}
                      </span>
                      {isConfirmed ? (
                        <span className="badge-solid">
                          <CheckCircle2 size={12} />
                          CONFIRMED
                        </span>
                      ) : (
                        <span className="badge-outline" style={{ borderStyle: 'dotted' }}>
                          <XCircle size={12} />
                          CANCELLED
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} />
                        {startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} />
                        {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      Purpose: <span style={{ fontWeight: 400 }}>"{r.purpose}"</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {isConfirmed && isUpcoming && (
                    <button
                      onClick={() => handleCancel(r.id, r.classroom?.room_number || '')}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <XCircle size={14} />
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
