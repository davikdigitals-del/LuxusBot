'use client';

import { useId, useState } from 'react';
import { IconEye, IconEyeOff } from '@/components/icons';

/**
 * Labeled input with a leading icon and, for password fields, a visibility
 * toggle. Used across login/register so every field looks and behaves the
 * same way.
 */
export default function AuthField({ label, icon: Icon, type = 'text', error, hint, ...props }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && show ? 'text' : type;

  return (
    <div>
      <label htmlFor={id} className="block text-sm text-ink-800 mb-1.5">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600/50" />
        )}
        <input
          id={id}
          type={resolvedType}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full rounded-md border bg-white py-2.5 text-sm text-ink-900 placeholder:text-ink-600/40 transition focus:outline-none focus:ring-1 ${
            Icon ? 'pl-9' : 'pl-3'
          } ${isPassword ? 'pr-10' : 'pr-3'} ${
            error ? 'border-signal-red focus:border-signal-red focus:ring-signal-red' : 'border-stone-300 focus:border-brass focus:ring-brass'
          }`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-600/60 hover:text-ink-800"
          >
            {show ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-signal-red">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-600/70">{hint}</p>
      ) : null}
    </div>
  );
}
