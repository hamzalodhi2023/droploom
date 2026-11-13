import { Loader2, Trash2 } from 'lucide-react';

type DeleteConfirmDialogProps = {
  filename: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Confirmation shown before any permanent deletion, on both pages. */
export const DeleteConfirmDialog = ({
  filename,
  busy,
  error,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-error/10 text-error">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 id="delete-dialog-title" className="text-base font-semibold">
            Delete this file permanently?
          </h2>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted">
          <span className="font-medium text-fg">{filename}</span> will be removed from the server.
          Its sharing link will stop working immediately and return 404. This cannot be undone.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-error/40 bg-error/10 p-3 text-xs text-error"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-accent/60 hover:text-fg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
};
