import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, X, KeyRound, User, CheckCircle2, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSuccess }) => {
  const { login, bootstrapAdmin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bootstrapAdmin();
      setBootstrapMsg(res.message);
      setUsername('Admin123');
      setPassword('Admin@123');
    } catch (err: any) {
      setError(err.message || 'Failed to bootstrap administrator.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogIn size={24} />
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>SIGN IN TO ALLOCATOR</h2>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Informational Bootstrap Admin Box */}
        <div
          style={{
            border: '2px solid var(--color-purple)',
            padding: '14px',
            borderRadius: '6px',
            marginBottom: '16px',
            backgroundColor: 'var(--color-white)',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <KeyRound size={16} />
            BUILT-IN ADMINISTRATOR BOOTSTRAP:
          </div>
          <div style={{ opacity: 0.9, marginBottom: '8px' }}>
            Bootstrap Admin: <code>Admin123</code> / <code>Admin@123</code> (Enforces password change on first access).
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              onClick={handleBootstrap}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              disabled={loading}
            >
              Provision / Verify Initial Admin
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('Admin123', 'Admin@123')}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Fill Admin Credentials
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('prof.smith', 'Faculty@123')}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Fill Sample Faculty (prof.smith)
            </button>
          </div>
        </div>

        {bootstrapMsg && (
          <div className="alert-box alert-outline" style={{ marginBottom: '14px' }}>
            <CheckCircle2 size={18} />
            <div style={{ fontSize: '13px' }}>{bootstrapMsg}</div>
          </div>
        )}

        {error && (
          <div className="alert-box alert-solid" style={{ marginBottom: '14px' }}>
            <AlertCircle size={18} />
            <div style={{ fontSize: '13px' }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} />
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Admin123 or prof.smith"
              autoFocus
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <KeyRound size={14} />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
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
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
