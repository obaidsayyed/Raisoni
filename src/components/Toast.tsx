import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  title?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '400px',
        width: 'calc(100vw - 40px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const isError = t.type === 'error';
        const isSuccess = t.type === 'success';

        return (
          <div
            key={t.id}
            className="toast-item"
            style={{
              pointerEvents: 'auto',
              backgroundColor: 'var(--color-white)',
              border: isError
                ? '2px solid var(--color-primary-dark)'
                : '1px solid var(--color-accent)',
              borderRadius: 'var(--border-radius)',
              boxShadow: 'var(--shadow-md)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              color: 'var(--color-primary-dark)',
            }}
          >
            <div style={{ marginTop: '2px', flexShrink: 0 }}>
              {isSuccess && <CheckCircle2 size={18} color="var(--color-primary-dark)" />}
              {isError && <AlertTriangle size={18} color="var(--color-primary-dark)" />}
              {!isSuccess && !isError && <Info size={18} color="var(--color-accent)" />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {t.title && (
                <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '2px' }}>
                  {t.title}
                </div>
              )}
              <div style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--color-text-main)' }}>
                {t.message}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: 'var(--color-text-muted)',
                lineHeight: 1,
                flexShrink: 0,
              }}
              title="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
