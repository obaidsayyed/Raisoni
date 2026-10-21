import React, { useState } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void | Promise<void>;
}

interface ConfirmModalProps {
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, options, onClose }) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !options) return null;

  const isDanger = options.variant === 'danger';

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await options.onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '460px' }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-tint-soft)',
                color: 'var(--color-primary-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isDanger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
            </div>
            <div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--color-primary-dark)',
                }}
              >
                {options.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '4px 6px', border: 'none' }}
            disabled={loading}
          >
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-text-main)',
            lineHeight: '1.5',
            margin: '0 0 24px 0',
            opacity: 0.9,
            wordBreak: 'break-word',
          }}
        >
          {options.message}
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            disabled={loading}
          >
            {options.cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary"
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              backgroundColor: 'var(--color-primary-dark)',
              borderColor: 'var(--color-primary-dark)',
            }}
            disabled={loading}
          >
            {loading ? 'Processing...' : options.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
