import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileList } from './FileList';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import type { PublicUpload, UploadedFile } from '../../types';
import { formatBytes } from '../../types';
import { deleteUpload, fetchRecentUploads, toAbsoluteUrl } from '../../utils/api';
import { isExpired } from '../../utils/dates';
import { readDeleteCapabilities, removeDeleteCapability } from '../../utils/deleteVault';

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
  const [capabilities, setCapabilities] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UploadedFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;

    void Promise.all([fetchRecentUploads(), readDeleteCapabilities()])
      .then(([result, tokens]) => {
        if (cancelled) return;
        setUploads(result);
        setCapabilities(tokens);
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

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;

    const target = pendingDelete;
    const deleteToken = capabilities.get(target.id);

    if (!deleteToken) {
      setDeleteError(
        'This browser does not hold the private delete key for this file, so it cannot be deleted here.',
      );
      return;
    }

    setDeletingId(target.id);
    setDeleteError(null);

    try {
      await deleteUpload(deleteToken);
      await removeDeleteCapability(target.id);
      setUploads((current) => current?.filter((upload) => upload.token !== target.id) ?? null);
      setCapabilities((current) => {
        const next = new Map(current);
        next.delete(target.id);
        return next;
      });
      setPendingDelete(null);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : 'Could not delete the file. Please try again.',
      );
    } finally {
      setDeletingId(null);
    }
  };

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

  const deletableIds = new Set(capabilities.keys());

  return (
    <>
      <FileList
        files={files}
        onCopyLink={onCopyLink}
        onDelete={(file) => {
          setDeleteError(null);
          setPendingDelete(file);
        }}
        deletableIds={deletableIds}
        deletingId={deletingId}
      />

      {pendingDelete && (
        <DeleteConfirmDialog
          filename={pendingDelete.name}
          busy={deletingId === pendingDelete.id}
          error={deleteError}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </>
  );
};
