import React, { useState, useEffect, useCallback } from 'react';
import type { Profile } from '../types';
import {
  getFacultyProfiles,
  createFacultyAccount,
  resetFacultyPassword,
  toggleFacultyStatus,
  subscribeToRealtimeChanges,
} from '../services/storageEngine';
import {
  UserCheck,
  UserPlus,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const ManageFacultyView: React.FC = () => {
  const [facultyList, setFacultyList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Faculty Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [tempPassword, setTempPassword] = useState('Faculty@123');

  // Reset Password Modal State
  const [resettingUser, setResettingUser] = useState<Profile | null>(null);
  const [newTempPassword, setNewTempPassword] = useState('Faculty@123');

  const loadData = useCallback(async () => {
    try {
      const data = await getFacultyProfiles();
      setFacultyList(data);
    } catch (e) {
      console.error('Failed to load faculty accounts', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToRealtimeChanges(() => loadData());
    return () => unsub();
  }, [loadData]);

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      const newAcc = await createFacultyAccount(fullName, username, tempPassword);
      setSuccessMsg(`Faculty account for ${newAcc.full_name} (@${newAcc.username}) successfully provisioned. They will be required to change their temporary password upon first sign in.`);
      setFullName('');
      setUsername('');
      setTempPassword('Faculty@123');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create faculty account.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await resetFacultyPassword(resettingUser.id, newTempPassword);
      setSuccessMsg(`Temporary password for @${resettingUser.username} has been reset. The faculty member must change it on their next login.`);
      setResettingUser(null);
      setNewTempPassword('Faculty@123');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    }
  };

  const handleToggleStatus = async (faculty: Profile) => {
    const nextStatus = faculty.status === 'active' ? 'disabled' : 'active';
    if (confirm(`Are you sure you want to ${nextStatus === 'disabled' ? 'deactivate' : 'activate'} account @${faculty.username}?`)) {
      try {
        setError(null);
        await toggleFacultyStatus(faculty.id, nextStatus);
        loadData();
      } catch (err: any) {
        setError(err.message || 'Failed to update account status.');
      }
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          FACULTY ACCOUNTS & CREDENTIAL PROVISIONING
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Provision new college faculty credentials, issue temporary passwords, and control authorization status
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

      {successMsg && (
        <div className="alert-box alert-outline" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Action Completed</div>
            <div style={{ fontSize: '13px' }}>{successMsg}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Create Account Form */}
        <div className="card">
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={18} />
            Provision Faculty Member
          </h2>
          <form onSubmit={handleCreateFaculty}>
            <div style={{ marginBottom: '14px' }}>
              <label>Full Display Name *</label>
              <input
                type="text"
                placeholder="e.g. Prof. Eleanor Vance"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label>Assigned Unique Username *</label>
              <input
                type="text"
                placeholder="e.g. eleanor.vance"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label>Temporary Password * (Min 8 chars)</label>
              <input
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                required
              />
              <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
                Note: The faculty member will be required to change this upon their first login.
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              <UserCheck size={16} />
              Create Faculty Account
            </button>
          </form>
        </div>

        {/* Faculty List Table */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
            Registered Faculty Members ({facultyList.length})
          </h3>

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontWeight: 600 }}>
              Loading faculty accounts...
            </div>
          ) : (
            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Faculty Name</th>
                    <th>Username</th>
                    <th>Status</th>
                    <th>Must Change Pass</th>
                    <th style={{ textAlign: 'center' }}>Admin Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyList.map((f) => {
                    const isActive = f.status === 'active';
                    return (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 700 }}>{f.full_name}</td>
                        <td>@{f.username}</td>
                        <td>
                          <button
                            onClick={() => handleToggleStatus(f)}
                            className={isActive ? 'badge-solid' : 'badge-outline'}
                            style={{ border: 'none', cursor: 'pointer', fontSize: '10px' }}
                            title="Click to toggle active/disabled"
                          >
                            {isActive ? 'ACTIVE' : 'DISABLED'}
                          </button>
                        </td>
                        <td>
                          {f.must_change_password ? (
                            <span className="badge-outline" style={{ borderStyle: 'dotted', fontSize: '10px' }}>
                              YES
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', opacity: 0.8 }}>No</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => setResettingUser(f)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Reset Temporary Password"
                          >
                            <KeyRound size={12} />
                            Reset Password
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="modal-overlay" onClick={() => setResettingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} />
              Reset Password for @{resettingUser.username}
            </h3>
            <p style={{ fontSize: '13px', opacity: 0.8, marginBottom: '16px' }}>
              Set a new temporary password. The faculty member will be required to change it on their next login.
            </p>
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '16px' }}>
                <label>New Temporary Password (Min 8 chars)</label>
                <input
                  type="text"
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Apply Temporary Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
