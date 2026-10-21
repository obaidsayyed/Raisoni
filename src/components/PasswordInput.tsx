import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperStyle?: React.CSSProperties;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  wrapperStyle,
  style,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%', ...wrapperStyle }}>
      <input
        {...props}
        type={showPassword ? 'text' : 'password'}
        style={{
          width: '100%',
          paddingRight: '40px',
          ...style,
        }}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          lineHeight: 1,
        }}
        title={showPassword ? 'Hide password' : 'View password'}
        aria-label={showPassword ? 'Hide password' : 'View password'}
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};
