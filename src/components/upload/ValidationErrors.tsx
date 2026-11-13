import { AlertCircle, X } from 'lucide-react';
import type { FileValidationError } from '../../types';

type ValidationErrorsProps = {
  errors: FileValidationError[];
  onDismiss: () => void;
};

export const ValidationErrors = ({ errors, onDismiss }: ValidationErrorsProps) => {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-error/40 bg-error/10 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-error">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {errors.length === 1 ? '1 file was not added' : `${errors.length} files were not added`}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss validation errors"
          className="-mr-1 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-error/80 transition-colors hover:bg-error/15 hover:text-error"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {errors.map((error) => (
          <li key={error.id} className="text-xs leading-relaxed text-error/90">
            <span className="font-semibold">{error.fileName}</span>
            <span className="px-1.5 opacity-60" aria-hidden="true">
              —
            </span>
            <span>{error.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
