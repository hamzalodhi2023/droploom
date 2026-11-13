import { Clock } from 'lucide-react';
import {
  EXPIRY_PRESETS,
  MAX_EXPIRY_MINUTES,
  MIN_EXPIRY_MINUTES,
  formatExpiryMinutes,
  resolveExpiryMinutes,
} from '../../types';
import type { ExpiryMode } from '../../types';

const CUSTOM_PRESETS = [1, 5, 15, 30, 45, 90] as const;

type ExpirySelectorProps = {
  mode: ExpiryMode;
  customMinutes: string;
  onModeChange: (mode: ExpiryMode) => void;
  onCustomMinutesChange: (value: string) => void;
  disabled?: boolean;
};

export const ExpirySelector = ({
  mode,
  customMinutes,
  onModeChange,
  onCustomMinutesChange,
  disabled = false,
}: ExpirySelectorProps) => {
  const minutes = resolveExpiryMinutes(mode, customMinutes);
  const options: ReadonlyArray<{ value: ExpiryMode; label: string; description: string }> = [
    ...EXPIRY_PRESETS.map((preset) => ({
      value: preset.value as ExpiryMode,
      label: preset.label,
      description: preset.description,
    })),
    { value: 'custom', label: 'Custom', description: 'Pick your own minutes' },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
          Link expiry
        </span>
      </div>

      <div role="radiogroup" aria-label="Link expiry" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const selected = option.value === mode;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onModeChange(option.value)}
              className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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

      {mode === 'custom' && (
        <div className="mt-3 rounded-xl border border-border bg-bg/40 p-3">
          <label
            htmlFor="custom-expiry"
            className="text-xs font-medium text-muted"
          >
            Expiry in minutes ({MIN_EXPIRY_MINUTES}–{MAX_EXPIRY_MINUTES})
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              id="custom-expiry"
              type="number"
              inputMode="numeric"
              min={MIN_EXPIRY_MINUTES}
              max={MAX_EXPIRY_MINUTES}
              step={1}
              value={customMinutes}
              disabled={disabled}
              onChange={(event) => onCustomMinutesChange(event.target.value)}
              placeholder="e.g. 45"
              aria-invalid={minutes === null}
              className="w-28 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-accent disabled:opacity-50"
            />

            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  onClick={() => onCustomMinutesChange(String(preset))}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {preset} min
                </button>
              ))}
            </div>
          </div>

          {minutes === null ? (
            <p className="mt-2 text-xs text-error">
              Enter a whole number of minutes between {MIN_EXPIRY_MINUTES} and {MAX_EXPIRY_MINUTES}.
            </p>
          ) : (
            <p className="mt-2 text-xs text-success">{formatExpiryMinutes(minutes)}</p>
          )}
        </div>
      )}

      {mode !== 'custom' && minutes !== null && (
        <p className="mt-2 text-xs text-muted">{formatExpiryMinutes(minutes)}</p>
      )}
    </div>
  );
};
