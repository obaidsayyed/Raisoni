import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PasswordInput } from '../components/PasswordInput';

export const AccountSecurityView: React.FC = () => {
  const { user, changeUsername, changePassword } = useAuth();

  // Username Form State
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Password Form State
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  if (!user) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', textAlign: 'center' }}>
        Please log in to manage your account security settings.
      </div>
    );
  }

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setUsernameSuccess(null);

    if (newUsername.trim().toLowerCase() === user.username.toLowerCase()) {
      setUsernameError('This is already your current username.');
      return;
    }

    setUsernameLoading(true);
    try {
      const updated = await changeUsername(newUsername);
      setUsernameSuccess(`Username successfully updated to "@${updated}". You can use this for all future sign-ins.`);
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setUsernameLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPass.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('New password and confirmation do not match.');
      return;
    }

    setPassLoading(true);
    try {
      await changePassword(currentPass, newPass);
      setPassSuccess('Password successfully updated. Your account is secured.');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setPassError(err.message || 'Failed to update password.');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px' }}>
          ACCOUNT SECURITY & CREDENTIALS
        </h1>
        <p style={{ opacity: 0.8, fontSize: '14px', marginTop: '4px' }}>
          Manage your login identifier, update passwords, and maintain credential security
        </p>
      </div>

      <div className="responsive-split-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        {/* Username Change Card */}
        <div className="card">
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} />
            Change Username
          </h2>

          {usernameSuccess && (
            <div className="alert-box alert-outline" style={{ marginBottom: '14px' }}>
              <CheckCircle2 size={18} />
              <div style={{ fontSize: '13px' }}>{usernameSuccess}</div>
            </div>
          )}

          {usernameError && (
            <div className="alert-box alert-solid" style={{ marginBottom: '14px' }}>
              <AlertTriangle size={18} />
              <div style={{ fontSize: '13px' }}>{usernameError}</div>
            </div>
          )}

          <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '14px' }}>
            Current Username: <strong>@{user.username}</strong> ({user.full_name})
          </div>

          <form onSubmit={handleUsernameChange}>
            <div style={{ marginBottom: '16px' }}>
              <label>New Username (Unique, 3-32 chars) *</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
                required
                minLength={3}
                maxLength={32}
                pattern="^[a-zA-Z0-9_.-]+$"
                title="3 to 32 characters (letters, numbers, hyphens, dots, underscores)"
                autoComplete="username"
                spellCheck={false}
              />
              <div className="form-helper">
                3 to 32 characters. Letters, numbers, hyphens, and underscores only.
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={usernameLoading}>
              {usernameLoading ? 'Validating Uniqueness...' : 'Update Username'}
            </button>
          </form>
        </div>

        {/* Password Change Card */}
        <div className="card">
          <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={18} />
            Change Password
          </h2>

          {passSuccess && (
            <div className="alert-box alert-outline" style={{ marginBottom: '14px' }}>
              <CheckCircle2 size={18} />
              <div style={{ fontSize: '13px' }}>{passSuccess}</div>
            </div>
          )}

          {passError && (
            <div className="alert-box alert-solid" style={{ marginBottom: '14px' }}>
              <AlertTriangle size={18} />
              <div style={{ fontSize: '13px' }}>{passError}</div>
            </div>
          )}

          <form onSubmit={handlePasswordChange}>
            <div style={{ marginBottom: '14px' }}>
              <label>Current Password *</label>
              <PasswordInput
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="Enter current password"
                required
                minLength={6}
                maxLength={64}
                autoComplete="current-password"
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label>New Password * (Min 8 characters)</label>
              <PasswordInput
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Enter new strong password"
                required
                minLength={8}
                maxLength={64}
                autoComplete="new-password"
              />
              <div className="form-helper">At least 8 characters long</div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label>Confirm New Password *</label>
              <PasswordInput
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Re-enter new password"
                required
                minLength={8}
                maxLength={64}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn-primary" disabled={passLoading}>
              {passLoading ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
