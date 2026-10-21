import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, X, KeyRound, User, AlertCircle } from 'lucide-react';
import { PasswordInput } from './PasswordInput';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSuccess }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogIn size={22} />
            <h2 style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Sign In to Allocator
            </h2>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert-box alert-solid" style={{ marginBottom: '16px' }}>
            <AlertCircle size={18} />
            <div style={{ fontSize: '13px' }}>{error}</div>
          </div>
        )}

        {/* SIGN IN FORM ONLY */}
        <form onSubmit={handleSignIn}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} />
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin or eleanor.vance"
              autoFocus
              required
              minLength={3}
              maxLength={32}
              pattern="^[a-zA-Z0-9_.-]+$"
              title="Username must be 3-32 characters (letters, numbers, hyphens, dots, underscores)"
              autoComplete="username"
              spellCheck={false}
            />
            <div className="form-helper">3 to 32 alphanumeric characters</div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <KeyRound size={14} />
              Password
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter account password"
              required
              minLength={6}
              maxLength={64}
              autoComplete="current-password"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Continue in Reader Mode
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
