import { useState } from 'react';
import {
  Check,
  Copy,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  File as FileIcon,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { UploadedFile } from '../../types';

type FileListProps = {
  files: UploadedFile[];
  onCopyLink: (link: string) => void;
  /** Called when the user asks to delete a file. */
  onDelete?: (file: UploadedFile) => void;
  /** Tokens this browser holds a delete capability for. */
  deletableIds?: ReadonlySet<string>;
  deletingId?: string | null;
};

const iconFor = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'csv'].includes(extension)) return FileText;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(extension)) return FileArchive;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(extension)) return FileImage;
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(extension)) return FileVideo;
  return FileIcon;
};

export const FileList = ({
  files,
  onCopyLink,
  onDelete,
  deletableIds,
  deletingId = null,
}: FileListProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (file: UploadedFile) => {
    onCopyLink(file.sharingLink);
    setCopiedId(file.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-accent-soft text-accent">
          <FileIcon className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-semibold">No uploads yet</p>
        <p className="mt-1 text-sm text-muted">
          Files you share will appear here with their expiry status.
        </p>
      </div>
    );
  }

  const withoutCapability = onDelete
    ? files.filter((file) => !deletableIds?.has(file.id)).length
    : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {files.map((file) => {
          const FileGlyph = iconFor(file.name);
          const isExpired = file.status === 'expired';
          const isCopied = copiedId === file.id;
          const canDelete = Boolean(onDelete) && Boolean(deletableIds?.has(file.id));
          const isDeleting = deletingId === file.id;

          return (
            <div
              key={file.id}
              className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/60"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-accent-soft text-accent">
                  <FileGlyph className="h-5 w-5" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={file.name}>
                    {file.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {file.sizeFormatted} · Uploaded {file.uploadDate.toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    isExpired
                      ? 'border-error/30 bg-error/10 text-error'
                      : 'border-success/30 bg-success/10 text-success'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isExpired ? 'bg-error' : 'bg-success'}`}
                    aria-hidden="true"
                  />
                  {isExpired ? 'Expired' : 'Active'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(file)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/60 hover:text-accent"
                    aria-label={`Copy sharing link for ${file.name}`}
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {isCopied ? 'Copied' : 'Copy link'}
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(file)}
                      disabled={!canDelete || isDeleting}
                      aria-label={
                        canDelete
                          ? `Delete ${file.name}`
                          : `Delete unavailable for ${file.name} (private key not in this browser)`
                      }
                      title={
                        canDelete
                          ? 'Permanently delete this file'
                          : 'This browser does not hold the delete key for this file'
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-error/60 hover:text-error disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {withoutCapability > 0 && (
        <p className="rounded-xl border border-border bg-bg/40 p-3 text-xs leading-relaxed text-muted">
          Delete is unavailable for {withoutCapability === 1 ? '1 file' : `${withoutCapability} files`}{' '}
          here because this browser does not hold their private delete key (it is stored only in the
          browser that uploaded the file). Those files still disappear at their expiry time, after
          their first complete download, or when deleted from the original browser.
        </p>
      )}
    </div>
  );
};
