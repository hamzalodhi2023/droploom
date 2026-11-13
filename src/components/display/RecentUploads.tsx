import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileList } from './FileList';
import type { PublicUpload, UploadedFile } from '../../types';
import { formatBytes } from '../../types';
import { fetchRecentUploads, toAbsoluteUrl } from '../../utils/api';
import { isExpired } from '../../utils/dates';

type RecentUploadsProps = {
  onCopyLink: (link: string) => void;
  /** Change this value to refetch after an upload completes. */
  refreshKey?: number;
};

const toUploadedFile = (upload: PublicUpload): UploadedFile => ({
  id: upload.token,
  name: upload.filename,
  size: upload.size,
  sizeFormatted: formatBytes(upload.size),
  uploadDate: new Date(upload.createdAt),
  expiryDate: new Date(upload.expiresAt),
  expiryEnabled: true,
  sharingLink: toAbsoluteUrl(upload.sharePath),
  status: isExpired(upload.expiresAt) ? 'expired' : 'ready',
});

export const RecentUploads = ({ onCopyLink, refreshKey = 0 }: RecentUploadsProps) => {
  const [uploads, setUploads] = useState<PublicUpload[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;

    void fetchRecentUploads()
      .then((result) => {
        if (cancelled) return;
        setUploads(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setUploads([]);
        setError(cause instanceof Error ? cause.message : 'Could not load recent uploads');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setError(null);
    setUploads(null);
    load();
  };

  useEffect(() => load(), [load, refreshKey]);

  const files = useMemo<UploadedFile[]>(
    () => (uploads ?? []).map(toUploadedFile),
    [uploads],
  );

  if (error) {
    return (
      <div className="rounded-2xl border border-error/40 bg-error/10 px-6 py-8 text-center">
        <p className="text-sm font-semibold text-error">Recent uploads could not be loaded</p>
        <p className="mt-1 text-xs text-error/80">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/60 hover:text-fg"
        >
          Try again
        </button>
      </div>
    );
  }

  if (uploads === null) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 px-6 py-10 text-center text-sm text-muted">
        Loading your uploads…
      </div>
    );
  }

  return <FileList files={files} onCopyLink={onCopyLink} />;
};
