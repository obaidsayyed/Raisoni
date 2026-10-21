import React from 'react';
import type { Floor } from '../types';
import { Calendar, Clock, Filter, Layers } from 'lucide-react';

interface RoomFilterBarProps {
  selectedDate: string;
  onChangeDate: (date: string) => void;
  startTime: string;
  onChangeStartTime: (time: string) => void;
  endTime: string;
  onChangeEndTime: (time: string) => void;
  selectedFloorId: string;
  onChangeFloorId: (floorId: string) => void;
  floors: Floor[];
  availabilityFilter: 'all' | 'available' | 'occupied' | 'reserved';
  onChangeAvailabilityFilter: (filter: 'all' | 'available' | 'occupied' | 'reserved') => void;
  stats: {
    total: number;
    available: number;
    lecture: number;
    reserved: number;
  };
}

export const RoomFilterBar: React.FC<RoomFilterBarProps> = ({
  selectedDate,
  onChangeDate,
  startTime,
  onChangeStartTime,
  endTime,
  onChangeEndTime,
  selectedFloorId,
  onChangeFloorId,
  floors,
  availabilityFilter,
  onChangeAvailabilityFilter,
  stats,
}) => {
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div
        className="room-filter-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          alignItems: 'flex-end',
        }}
      >
        {/* Date Selector */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} />
            Reservation Date *
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onChangeDate(e.target.value)}
            required
            min={todayStr}
          />
        </div>

        {/* Start Time */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} />
            Start Time *
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => onChangeStartTime(e.target.value)}
            required
          />
        </div>

        {/* End Time */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} />
            End Time *
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => onChangeEndTime(e.target.value)}
            required
          />
        </div>

        {/* Floor Filter */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} />
            Floor Level
          </label>
          <select
            value={selectedFloorId}
            onChange={(e) => onChangeFloorId(e.target.value)}
          >
            <option value="">All Floors</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} />
            Filter State
          </label>
          <select
            value={availabilityFilter}
            onChange={(e) =>
              onChangeAvailabilityFilter(
                e.target.value as 'all' | 'available' | 'occupied' | 'reserved'
              )
            }
          >
            <option value="all">All Rooms ({stats.total})</option>
            <option value="available">Available Only ({stats.available})</option>
            <option value="occupied">Official Lectures ({stats.lecture})</option>
            <option value="reserved">Faculty Reserved ({stats.reserved})</option>
          </select>
        </div>
      </div>

      {/* Preset time buttons & Summary counts */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--color-tint-border)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
            Quick Intervals:
          </span>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => {
              onChangeStartTime('09:00');
              onChangeEndTime('10:30');
            }}
          >
            09:00 - 10:30 (Morning)
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => {
              onChangeStartTime('11:00');
              onChangeEndTime('12:30');
            }}
          >
            11:00 - 12:30 (Mid-Day)
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => {
              onChangeStartTime('14:00');
              onChangeEndTime('15:30');
            }}
          >
            14:00 - 15:30 (Afternoon)
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', fontWeight: 600 }}>
          <span className="badge-outline">Total: {stats.total}</span>
          <span className="badge-outline">Free: {stats.available}</span>
          <span className="badge-solid">Lectures: {stats.lecture}</span>
          <span className="badge-outline" style={{ borderStyle: 'dashed' }}>
            Reserved: {stats.reserved}
          </span>
        </div>
      </div>
    </div>
  );
};
