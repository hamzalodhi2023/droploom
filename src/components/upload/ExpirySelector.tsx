import { Clock } from 'lucide-react';
import { EXPIRY_OPTIONS } from '../../types';
import type { ExpiryOption } from '../../types';

type ExpirySelectorProps = {
  value: ExpiryOption;
  onChange: (value: ExpiryOption) => void;
  disabled?: boolean;
};

export const ExpirySelector = ({ value, onChange, disabled = false }: ExpirySelectorProps) => {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
          Link expiry
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Link expiry"
        className="grid gap-2 sm:grid-cols-3"
      >
        {EXPIRY_OPTIONS.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'border-accent bg-accent-soft text-fg'
                  : 'border-border bg-bg/40 text-muted hover:border-accent/60 hover:text-fg'
              }`}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs text-muted">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
