import { ReactNode, useState } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  tooltip?: string;
}

export function Field({ label, hint, required, children, tooltip }: FieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 label">
        {label}
        {required && <span className="text-brand-600">*</span>}
        {tooltip && (
          <button
            type="button"
            className="relative text-ink-mute hover:text-brand-600"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            aria-label="Hjælp"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2 2-2 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle cx="12" cy="17" r="0.9" fill="currentColor" />
            </svg>
            {open && (
              <span className="absolute z-20 left-5 top-0 w-60 -translate-y-1/2 rounded-lg bg-ink text-white text-[11px] leading-snug px-3 py-2 shadow-lg">
                {tooltip}
              </span>
            )}
          </button>
        )}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-ink-mute">{hint}</span>}
    </label>
  );
}
