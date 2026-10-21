import React, { useState, useEffect, useCallback } from 'react';
import type { Profile } from '../types';
import {
  getFacultyProfiles,
  createFacultyAccount,
  resetFacultyPassword,
  toggleFacultyStatus,
  deleteFacultyAccount,
  subscribeToRealtimeChanges,
} from '../services/storageEngine';
import { useFeedback } from '../context/FeedbackContext';
import { PasswordInput } from '../components/PasswordInput';
import {
  UserCheck,
  UserPlus,
  UserX,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Trash2,
} from 'lucide-react';

export const ManageFacultyView: React.FC = () => {
  const { toast, confirm } = useFeedback();
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
      const msg = `Faculty account for ${newAcc.full_name} (@${newAcc.username}) successfully provisioned.`;
      setSuccessMsg(msg);
      toast.success(msg, 'Faculty Provisioned');
      setFullName('');
      setUsername('');
      setTempPassword('Faculty@123');
      loadData();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to create faculty account.';
      setError(errMsg);
      toast.error(errMsg, 'Provisioning Error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await resetFacultyPassword(resettingUser.id, newTempPassword);
      const msg = `Temporary password for @${resettingUser.username} has been reset.`;
      setSuccessMsg(msg);
      toast.success(msg, 'Password Reset');
      setResettingUser(null);
      setNewTempPassword('Faculty@123');
      loadData();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to reset password.';
      setError(errMsg);
      toast.error(errMsg, 'Reset Failed');
    }
  };

  const handleToggleStatus = (faculty: Profile) => {
    const nextStatus = faculty.status === 'active' ? 'disabled' : 'active';
    const isDeactivating = nextStatus === 'disabled';

    confirm({
      title: isDeactivating ? 'Deactivate Faculty Account' : 'Activate Faculty Account',
      message: isDeactivating
        ? `Are you sure you want to deactivate faculty account @${faculty.username} (${faculty.full_name})? They will be unable to log in or schedule classrooms until reactivated.`
        : `Are you sure you want to reactivate faculty account @${faculty.username} (${faculty.full_name})?`,
      confirmText: isDeactivating ? 'Deactivate Account' : 'Activate Account',
      variant: isDeactivating ? 'danger' : 'primary',
      onConfirm: async () => {
        try {
          setError(null);
          await toggleFacultyStatus(faculty.id, nextStatus);
          const msg = `Account @${faculty.username} is now ${nextStatus}.`;
          toast.success(msg);
          loadData();
        } catch (err: any) {
          const errMsg = err.message || 'Failed to update account status.';
          setError(errMsg);
          toast.error(errMsg);
        }
      },
    });
  };

  const handleDeleteFaculty = (faculty: Profile) => {
    confirm({
      title: 'Delete Faculty Account',
      message: `Permanently delete faculty account @${faculty.username} (${faculty.full_name})? Any active classroom reservations made by this faculty member will also be removed. This cannot be undone.`,
      confirmText: 'Delete Permanently',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setError(null);
          await deleteFacultyAccount(faculty.id);
          const msg = `Faculty member @${faculty.username} has been deleted.`;
          toast.success(msg, 'Account Deleted');
          loadData();
        } catch (err: any) {
          const errMsg = err.message || 'Failed to delete faculty account.';
          setError(errMsg);
          toast.error(errMsg, 'Delete Failed');
        }
      },
    });
  };

  return (
    <div className="page-container">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          FACULTY ACCOUNTS & CREDENTIAL PROVISIONING
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Provision new college faculty credentials, manage authorization status, or remove accounts
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

      <div className="responsive-split-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
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
                minLength={2}
                maxLength={60}
                autoComplete="name"
              />
              <div className="form-helper">2 to 60 characters</div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label>Assigned Unique Username *</label>
              <input
                type="text"
                placeholder="e.g. eleanor.vance"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={32}
                pattern="^[a-zA-Z0-9_.-]+$"
                title="3 to 32 characters (letters, numbers, hyphens, dots, underscores)"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="form-helper">3 to 32 alphanumeric characters</div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label>Temporary Password * (Min 8 chars)</label>
              <PasswordInput
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                required
                minLength={8}
                maxLength={64}
                autoComplete="new-password"
              />
              <div className="form-helper">
                Minimum 8 characters. Faculty will be prompted to change this on initial login.
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
            <div className="table-responsive" style={{ maxHeight: '450px', overflowY: 'auto' }}>
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
                          <span
                            className={isActive ? 'badge-solid' : 'badge-outline'}
                            style={{ fontSize: '10px' }}
                          >
                            {isActive ? 'ACTIVE' : 'DEACTIVATED'}
                          </span>
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
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {/* Deactivate / Activate Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(f)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title={isActive ? 'Deactivate faculty account' : 'Activate faculty account'}
                            >
                              {isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteFaculty(f)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Permanently delete faculty account"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>

                            {/* Reset Password Button */}
                            <button
                              type="button"
                              onClick={() => setResettingUser(f)}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Reset Temporary Password"
                            >
                              <KeyRound size={12} />
                              Reset Pass
                            </button>
                          </div>
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
                <label>New Temporary Password * (Min 8 chars)</label>
                <PasswordInput
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  required
                  minLength={8}
                  maxLength={64}
                  autoComplete="new-password"
                />
                <div className="form-helper">Minimum 8 characters</div>
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
