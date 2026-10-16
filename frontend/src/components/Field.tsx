import type { InputHTMLAttributes, ReactNode } from 'react';
import { Input } from './ui/controls';

interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (aria: { 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}

/** Label + control + hint + inline error, wired together for screen readers. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block font-semibold">{label}</label>
      {children({ ...(error ? { 'aria-invalid': true as const } : {}), ...(ids ? { 'aria-describedby': ids } : {}) })}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-small text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-small font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
};

export function TextField({ id, label, hint, error, ...input }: TextFieldProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(aria) => <Input id={id} {...input} {...aria} />}
    </Field>
  );
}
