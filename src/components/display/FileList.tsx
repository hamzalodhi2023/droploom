import { useState } from 'react';
import {
  Check,
  Copy,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  File as FileIcon,
} from 'lucide-react';
import type { UploadedFile } from '../../types';

type FileListProps = {
  files: UploadedFile[];
  onCopyLink: (link: string) => void;
};

const iconFor = (name: string) => {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) return FileText;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return FileArchive;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return FileImage;
  if (['mp4', 'mov', 'webm', 'avi'].includes(extension)) return FileVideo;
  return FileIcon;
};

export const FileList = ({ files, onCopyLink }: FileListProps) => {
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

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {files.map((file) => {
        const FileGlyph = iconFor(file.name);
        const isExpired = file.status === 'expired';
        const isCopied = copiedId === file.id;

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

            <div className="mt-5 flex items-center justify-between gap-3">
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
            </div>
          </div>
        );
      })}
    </div>
  );
};
