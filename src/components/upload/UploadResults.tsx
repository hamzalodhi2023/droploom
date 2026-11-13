import { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Copy, Download, ExternalLink } from 'lucide-react';
import type { PublicUpload, UploadRejection } from '../../types';
import { formatBytes } from '../../types';
import { formatDateTime, formatRemaining } from '../../utils/dates';
import { toAbsoluteUrl } from '../../utils/api';

type UploadResultsProps = {
  uploads: PublicUpload[];
  rejections: UploadRejection[];
  onReset: () => void;
};

export const UploadResults = ({ uploads, rejections, onReset }: UploadResultsProps) => {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCopy = async (upload: PublicUpload) => {
    const link = toAbsoluteUrl(upload.sharePath);

    try {
      await navigator.clipboard.writeText(link);
      setCopiedToken(upload.token);
      window.setTimeout(() => setCopiedToken(null), 1600);
    } catch {
      // Clipboard access can be blocked; the link stays visible and selectable.
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-success/40 bg-success/10 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-success">
              {uploads.length === 1 ? '1 file uploaded' : `${uploads.length} files uploaded`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-success/90">
              Share these links with anyone — no account needed to download.
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="flex-shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/60 hover:text-fg"
          >
            Upload more
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-3">
          {uploads.map((upload) => {
            const link = toAbsoluteUrl(upload.sharePath);
            const isCopied = copiedToken === upload.token;

            return (
              <li
                key={upload.token}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold" title={upload.filename}>
                    {upload.filename}
                  </p>
                  <p className="text-xs text-muted">
                    {formatBytes(upload.size)} · {formatRemaining(upload.expiresAt)}
                  </p>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    readOnly
                    value={link}
                    aria-label={`Sharing link for ${upload.filename}`}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-bg/60 px-3 py-2 text-xs text-fg selection:bg-accent-soft"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy(upload)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isCopied ? 'Copied' : 'Copy link'}
                    </button>

                    <a
                      href={upload.downloadPath}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-[#0b0713] transition-opacity hover:opacity-90"
                      download={upload.filename}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </a>

                    <a
                      href={upload.downloadPath}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open sharing page for ${upload.filename}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-accent/60 hover:text-accent"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <p className="mt-2 text-xs text-muted">
                  Expires {formatDateTime(upload.expiresAt)} · {upload.downloadCount}{' '}
                  {upload.downloadCount === 1 ? 'download' : 'downloads'}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      {rejections.length > 0 && (
        <div role="alert" className="rounded-xl border border-error/40 bg-error/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {rejections.length === 1
              ? '1 file was rejected by the server'
              : `${rejections.length} files were rejected by the server`}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {rejections.map((rejection) => (
              <li key={`${rejection.code}-${rejection.filename}`} className="text-xs text-error/90">
                <span className="font-semibold">{rejection.filename}</span>
                <span className="px-1.5 opacity-60" aria-hidden="true">
                  —
                </span>
                <span>{rejection.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
