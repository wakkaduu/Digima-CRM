import type { InputHTMLAttributes, ReactNode } from 'react';

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
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ ...(error ? { 'aria-invalid': true as const } : {}), ...(ids ? { 'aria-describedby': ids } : {}) })}
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error">
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
      {(aria) => <input id={id} className="input" {...input} {...aria} />}
    </Field>
  );
}
