import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, X, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';

interface PasswordChangeModalProps {
  isForced?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  isForced = false,
  onClose,
  onSuccess,
}) => {
  const { completeInitialPasswordChange, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      if (isForced) {
        await completeInitialPasswordChange(newPassword);
      } else {
        await changePassword(currentPassword, newPassword);
      }
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={isForced ? undefined : onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} />
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>
              {isForced ? 'REQUIRED: CHANGE INITIAL PASSWORD' : 'UPDATE ACCOUNT PASSWORD'}
            </h2>
          </div>
          {!isForced && onClose && (
            <button onClick={onClose} className="btn-secondary" style={{ padding: '4px 8px' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {isForced && (
          <div className="alert-box alert-solid" style={{ marginBottom: '16px' }}>
            <Lock size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Security Requirement</div>
              <div style={{ fontSize: '13px' }}>
                For security compliance, you must replace the default/temporary credentials before accessing your dashboard.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="alert-box alert-solid" style={{ marginBottom: '16px' }}>
            <AlertTriangle size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Error</div>
              <div style={{ fontSize: '13px' }}>{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="alert-box alert-outline" style={{ marginBottom: '16px' }}>
            <CheckCircle2 size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Password Updated</div>
              <div style={{ fontSize: '13px' }}>Your new credentials have been securely registered.</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isForced && (
            <div style={{ marginBottom: '14px' }}>
              <label>Current Password *</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label>New Password * (Min 8 characters)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label>Confirm New Password *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            {!isForced && onClose && (
              <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={loading || success}>
              {loading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
