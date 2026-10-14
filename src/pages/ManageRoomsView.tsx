import React, { useState, useEffect, useCallback } from 'react';
import type { Classroom, Floor } from '../types';
import {
  getClassrooms,
  getFloors,
  createFloor,
  updateFloor,
  deleteFloor,
  createClassroom,
  updateClassroom,
  deleteClassroom,
  subscribeToRealtimeChanges,
} from '../services/storageEngine';
import {
  Building2,
  Layers,
  PlusCircle,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export const ManageRoomsView: React.FC = () => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Floor Form State
  const [floorName, setFloorName] = useState('');
  const [floorOrder, setFloorOrder] = useState<number>(1);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);

  // Classroom Form State
  const [roomNumber, setRoomNumber] = useState('');
  const [classroomFloorId, setClassroomFloorId] = useState('');
  const [capacity, setCapacity] = useState<number>(50);
  const [editingRoom, setEditingRoom] = useState<Classroom | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [allRooms, allFloors] = await Promise.all([getClassrooms(), getFloors()]);
      setClassrooms(allRooms);
      setFloors(allFloors);
      if (allFloors.length > 0 && !classroomFloorId) {
        setClassroomFloorId(allFloors[0].id);
      }
    } catch (e) {
      console.error('Failed to load room data', e);
    }
  }, [classroomFloorId]);

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtimeChanges(() => loadData());
    return () => unsub();
  }, [loadData]);

  // Floor Actions
  const handleSaveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingFloor) {
        await updateFloor(editingFloor.id, floorName, floorOrder);
        setEditingFloor(null);
      } else {
        await createFloor(floorName, floorOrder);
      }
      setFloorName('');
      setFloorOrder((prev) => prev + 1);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save floor.');
    }
  };

  const handleDeleteFloor = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete floor "${name}"?`)) {
      try {
        setError(null);
        await deleteFloor(id);
        loadData();
      } catch (err: any) {
        setError(err.message || 'Cannot delete floor.');
      }
    }
  };

  // Classroom Actions
  const handleSaveClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingRoom) {
        await updateClassroom(editingRoom.id, {
          room_number: roomNumber,
          floor_id: classroomFloorId,
          capacity,
        });
        setEditingRoom(null);
      } else {
        await createClassroom(roomNumber, classroomFloorId, capacity);
      }
      setRoomNumber('');
      setCapacity(50);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save classroom.');
    }
  };

  const handleToggleRoomStatus = async (room: Classroom) => {
    try {
      setError(null);
      await updateClassroom(room.id, { is_active: !room.is_active });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update classroom status.');
    }
  };

  const handleDeleteRoom = async (id: string, roomNum: string) => {
    if (confirm(`Are you sure you want to delete classroom "${roomNum}"?`)) {
      try {
        setError(null);
        await deleteClassroom(id);
        loadData();
      } catch (err: any) {
        setError(err.message || 'Cannot delete classroom.');
      }
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          FLOORS & CLASSROOMS MANAGEMENT
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Configure college infrastructure, assign rooms to floors, and control active booking status
        </p>
      </div>

      {error && (
        <div className="alert-box alert-solid" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Operation Error</div>
            <div style={{ fontSize: '13px' }}>{error}</div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Floors on Left, Classrooms on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Floors Column */}
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} />
              {editingFloor ? 'Edit Floor' : 'Add New Floor'}
            </h2>
            <form onSubmit={handleSaveFloor}>
              <div style={{ marginBottom: '12px' }}>
                <label>Floor Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ground Floor, Third Floor"
                  value={floorName}
                  onChange={(e) => setFloorName(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label>Display Order (Sorting)</label>
                <input
                  type="number"
                  value={floorOrder}
                  onChange={(e) => setFloorOrder(Number(e.target.value))}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {editingFloor && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFloor(null);
                      setFloorName('');
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn-primary">
                  <PlusCircle size={14} />
                  {editingFloor ? 'Update Floor' : 'Create Floor'}
                </button>
              </div>
            </form>
          </div>

          {/* Floors Table */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              Configured Floors ({floors.length})
            </h3>
            <table className="allocator-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Floor Name</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {floors.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 700 }}>#{f.display_order}</td>
                    <td style={{ fontWeight: 600 }}>{f.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setEditingFloor(f);
                            setFloorName(f.name);
                            setFloorOrder(f.display_order);
                          }}
                          className="btn-secondary"
                          style={{ padding: '4px 6px', fontSize: '11px' }}
                          title="Edit Floor"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteFloor(f.id, f.name)}
                          className="btn-secondary"
                          style={{ padding: '4px 6px', fontSize: '11px' }}
                          title="Delete Floor"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Classrooms Column */}
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} />
              {editingRoom ? `Edit Classroom ${editingRoom.room_number}` : 'Add New Classroom'}
            </h2>
            <form onSubmit={handleSaveClassroom}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label>Room Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. G-101, F-205"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>Capacity (Seats) *</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label>Assigned Floor *</label>
                <select
                  value={classroomFloorId}
                  onChange={(e) => setClassroomFloorId(e.target.value)}
                  required
                >
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {editingRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRoom(null);
                      setRoomNumber('');
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn-primary">
                  <PlusCircle size={14} />
                  {editingRoom ? 'Update Classroom' : 'Create Classroom'}
                </button>
              </div>
            </form>
          </div>

          {/* Classrooms List Table */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              Configured Classrooms ({classrooms.length})
            </h3>
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Seats</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classrooms.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 800 }}>{c.room_number}</td>
                      <td>{c.floor?.name || 'Floor'}</td>
                      <td>{c.capacity}</td>
                      <td>
                        <button
                          onClick={() => handleToggleRoomStatus(c)}
                          className={c.is_active ? 'badge-solid' : 'badge-outline'}
                          style={{ border: 'none', cursor: 'pointer' }}
                          title="Click to toggle active status"
                        >
                          {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button
                            onClick={() => {
                              setEditingRoom(c);
                              setRoomNumber(c.room_number);
                              setCapacity(c.capacity);
                              setClassroomFloorId(c.floor_id);
                            }}
                            className="btn-secondary"
                            style={{ padding: '4px 6px', fontSize: '11px' }}
                            title="Edit Room"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteRoom(c.id, c.room_number)}
                            className="btn-secondary"
                            style={{ padding: '4px 6px', fontSize: '11px' }}
                            title="Delete Room"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
