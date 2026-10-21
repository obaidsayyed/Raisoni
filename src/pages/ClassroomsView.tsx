import React, { useState, useEffect, useCallback } from 'react';
import type { Classroom, Floor, AvailabilityResult } from '../types';
import {
  getClassrooms,
  getFloors,
  checkClassroomAvailability,
  subscribeToRealtimeChanges,
  isSlotInPast,
} from '../services/storageEngine';
import { RoomCard } from '../components/RoomCard';
import { RoomFilterBar } from '../components/RoomFilterBar';
import { ScheduleModal } from '../components/BookingModal';
import { useAuth } from '../context/AuthContext';
import { Building2, AlertCircle } from 'lucide-react';

interface ClassroomsViewProps {
  onOpenLogin: () => void;
}

export const ClassroomsView: React.FC<ClassroomsViewProps> = ({ onOpenLogin }) => {
  const { role } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, AvailabilityResult>>({});
  const [loading, setLoading] = useState(true);

  // Local calendar date formatted YYYY-MM-DD
  const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Filter States
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'occupied' | 'reserved'>('all');

  const isPastSlot = isSlotInPast(selectedDate, startTime);

  // Schedule Modal State
  const [scheduleRoom, setScheduleRoom] = useState<Classroom | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [allRooms, allFloors] = await Promise.all([getClassrooms(), getFloors()]);
      setClassrooms(allRooms);
      setFloors(allFloors);

      // Check availability for all rooms for selected interval
      const startIso = `${selectedDate}T${startTime}:00.000Z`;
      const endIso = `${selectedDate}T${endTime}:00.000Z`;

      const availMap: Record<string, AvailabilityResult> = {};
      await Promise.all(
        allRooms.map(async (r) => {
          availMap[r.id] = await checkClassroomAvailability(r.id, startIso, endIso);
        })
      );
      setAvailabilities(availMap);
    } catch (e) {
      console.error('Error loading classroom data', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, startTime, endTime]);

  useEffect(() => {
    loadData();

    // Subscribe to realtime updates
    const unsubscribe = subscribeToRealtimeChanges(() => {
      loadData();
    });

    return () => unsubscribe();
  }, [loadData]);

  // Handle reserve click
  const handleReserveClick = (classroom: Classroom) => {
    if (isPastSlot) {
      return;
    }
    if (role === 'reader') {
      onOpenLogin();
      return;
    }
    setScheduleRoom(classroom);
  };

  // Compute stats
  const stats = {
    total: classrooms.length,
    available: 0,
    lecture: 0,
    reserved: 0,
  };

  classrooms.forEach((c) => {
    const a = availabilities[c.id];
    if (a?.available) stats.available++;
    else if (a?.conflict_type === 'timetable') stats.lecture++;
    else if (a?.conflict_type === 'reservation') stats.reserved++;
  });

  // Filter classrooms for display
  const displayedClassrooms = classrooms.filter((c) => {
    if (selectedFloorId && c.floor_id !== selectedFloorId) return false;
    const a = availabilities[c.id];
    if (availabilityFilter === 'available' && !a?.available) return false;
    if (availabilityFilter === 'occupied' && a?.conflict_type !== 'timetable') return false;
    if (availabilityFilter === 'reserved' && a?.conflict_type !== 'reservation') return false;
    return true;
  });

  return (
    <div className="page-container">
      {/* Title Section */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          CAMPUS CLASSROOM AVAILABILITY
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Realtime schedule engine combining official timetable lectures and confirmed faculty reservations
        </p>
      </div>

      {/* Reader Mode Notice */}
      {role === 'reader' && (
        <div className="alert-box alert-outline" style={{ marginBottom: '20px' }}>
          <AlertCircle size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Reader Mode Active</div>
            <div style={{ fontSize: '13px' }}>
              You are viewing real-time classroom schedules publicly. Sign in with faculty or admin credentials to schedule classrooms.
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <RoomFilterBar
        selectedDate={selectedDate}
        onChangeDate={setSelectedDate}
        startTime={startTime}
        onChangeStartTime={setStartTime}
        endTime={endTime}
        onChangeEndTime={setEndTime}
        selectedFloorId={selectedFloorId}
        onChangeFloorId={setSelectedFloorId}
        floors={floors}
        availabilityFilter={availabilityFilter}
        onChangeAvailabilityFilter={setAvailabilityFilter}
        stats={stats}
      />

      {/* Room Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', fontWeight: 700 }}>
          Calculating classroom availability across schedules...
        </div>
      ) : displayedClassrooms.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}
        >
          <Building2 size={48} style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700 }}>No Classrooms Match Filter Criteria</h3>
          <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>
            Try adjusting the floor level or reset the availability filter.
          </p>
        </div>
      ) : (
        <div
          className="room-cards-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {displayedClassrooms.map((c) => (
            <RoomCard
              key={c.id}
              classroom={c}
              availability={
                availabilities[c.id] || { available: true, reason: 'Checking...' }
              }
              onReserve={handleReserveClick}
              isReaderMode={role === 'reader'}
              isPastSlot={isPastSlot}
            />
          ))}
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleRoom && (
        <ScheduleModal
          classroom={scheduleRoom}
          date={selectedDate}
          startTime={startTime}
          endTime={endTime}
          onClose={() => setScheduleRoom(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
