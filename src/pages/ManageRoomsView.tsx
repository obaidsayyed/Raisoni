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
import { useFeedback } from '../context/FeedbackContext';

export const ManageRoomsView: React.FC = () => {
  const { toast, confirm } = useFeedback();
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
  const [editingRoom, setEditingRoom] = useState<Classroom | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [allRooms, allFloors] = await Promise.all([getClassrooms(), getFloors()]);
      setClassrooms(allRooms);
      setFloors(allFloors);
      if (allFloors.length > 0 && (!classroomFloorId || !allFloors.some((f) => f.id === classroomFloorId))) {
        setClassroomFloorId(allFloors[0].id);
      } else if (allFloors.length === 0) {
        setClassroomFloorId('');
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

  const handleDeleteFloor = (id: string, name: string) => {
    confirm({
      title: 'Delete Floor',
      message: `Are you sure you want to delete floor "${name}"? All classrooms on this floor and their schedules will be deleted automatically.`,
      confirmText: 'Delete Floor',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setError(null);
          await deleteFloor(id);
          toast.success(`Floor "${name}" deleted.`);
          loadData();
        } catch (err: any) {
          const errMsg = err.message || 'Cannot delete floor.';
          setError(errMsg);
          toast.error(errMsg);
        }
      },
    });
  };

  // Classroom Actions
  const handleSaveClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!classroomFloorId) {
      setError('Please create and select a floor before adding a classroom.');
      return;
    }
    try {
      if (editingRoom) {
        await updateClassroom(editingRoom.id, {
          room_number: roomNumber,
          floor_id: classroomFloorId,
        });
        setEditingRoom(null);
      } else {
        await createClassroom(roomNumber, classroomFloorId);
      }
      setRoomNumber('');
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

  const handleDeleteRoom = (id: string, roomNum: string) => {
    confirm({
      title: 'Delete Classroom',
      message: `Are you sure you want to delete classroom "${roomNum}"? Existing schedules and allocations for this room will also be removed.`,
      confirmText: 'Delete Classroom',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setError(null);
          await deleteClassroom(id);
          toast.success(`Classroom ${roomNum} deleted.`);
          loadData();
        } catch (err: any) {
          const errMsg = err.message || 'Cannot delete classroom.';
          setError(errMsg);
          toast.error(errMsg);
        }
      },
    });
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          FLOORS & CLASSROOMS MANAGEMENT
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Configure college infrastructure, assign rooms to floors, and control active room status
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
      <div className="responsive-split-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
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
                  minLength={1}
                  maxLength={40}
                />
                <div className="form-helper">1 to 40 characters</div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label>Display Order (Sorting) *</label>
                <input
                  type="number"
                  value={floorOrder}
                  onChange={(e) => setFloorOrder(Number(e.target.value))}
                  required
                  min={1}
                  max={100}
                  step={1}
                />
                <div className="form-helper">Numeric sequence order (1-100)</div>
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
            <div className="table-responsive">
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Floor Name</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {floors.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', opacity: 0.6, padding: '24px 0' }}>
                        No floors added yet. Add your first floor above.
                      </td>
                    </tr>
                  ) : (
                    floors.map((f) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
              <div className="grid-2" style={{ marginBottom: '16px' }}>
                <div>
                  <label>Room Number *</label>
                  <input
                    type="text"
                    placeholder="e.g. G-101, F-205"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value.toUpperCase())}
                    required
                    minLength={1}
                    maxLength={20}
                    pattern="^[a-zA-Z0-9_.-]+$"
                    title="Room number alphanumeric e.g. G-101, F-205, 301"
                  />
                  <div className="form-helper">Alphanumeric room code (1-20 chars)</div>
                </div>
                <div>
                  <label>Assigned Floor *</label>
                  <select
                    value={classroomFloorId}
                    onChange={(e) => setClassroomFloorId(e.target.value)}
                    required
                    disabled={floors.length === 0}
                  >
                    {floors.length === 0 ? (
                      <option value="">No floors available - create a floor first</option>
                    ) : (
                      floors.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="form-helper">Select building floor level</div>
                </div>
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
                <button type="submit" className="btn-primary" disabled={floors.length === 0}>
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
            <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classrooms.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', opacity: 0.6, padding: '24px 0' }}>
                        No classrooms added yet.
                      </td>
                    </tr>
                  ) : (
                    classrooms.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 800 }}>{c.room_number}</td>
                        <td>{c.floor?.name || 'Floor'}</td>
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
                  ))
                )}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
