import { useState } from 'react';
import { AlertCircle, Loader2, UploadCloud } from 'lucide-react';
import { UploadArea } from './UploadArea';
import { SelectedFileList } from './SelectedFileList';
import { ValidationErrors } from './ValidationErrors';
import { ExpirySelector } from './ExpirySelector';
import { UploadResults } from './UploadResults';
import { useFileSelection } from '../../hooks/useFileSelection';
import { ApiError, toRejections, uploadFiles } from '../../utils/api';
import { resolveExpiryMinutes } from '../../types';
import type { ExpiryMode, PublicUpload, UploadRejection } from '../../types';

type UploadPhase = 'idle' | 'uploading' | 'success' | 'error';

type UploadFlowProps = {
  /** Heading shown above the dropzone; pass null to hide it. */
  heading?: string | null;
  onUploaded?: (uploads: PublicUpload[]) => void;
  onDeleted?: (token: string) => void;
};

/**
 * The single upload implementation shared by the landing page and the
 * dashboard: file selection, expiry, progress, results, deletion.
 */
export const UploadFlow = ({
  heading = 'New upload',
  onUploaded,
  onDeleted,
}: UploadFlowProps) => {
  const { files, errors, totalSizeFormatted, addFiles, removeFile, clearAll, dismissErrors } =
    useFileSelection();

  const [expiryMode, setExpiryMode] = useState<ExpiryMode>('24h');
  const [customMinutes, setCustomMinutes] = useState('45');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<PublicUpload[]>([]);
  const [rejections, setRejections] = useState<UploadRejection[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const hasFiles = files.length > 0;
  const isUploading = phase === 'uploading';
  const expiryMinutes = resolveExpiryMinutes(expiryMode, customMinutes);

  const resetFeedback = () => {
    setPhase('idle');
    setProgress(0);
    setResults([]);
    setRejections([]);
    setUploadError(null);
  };

  const handleAddFiles = (incoming: File[]) => {
    if (phase === 'success' || phase === 'error') resetFeedback();
    addFiles(incoming);
  };

  const handleUpload = async () => {
    if (!hasFiles || isUploading || expiryMinutes === null) return;

    const payload = files.map((selected) => selected.file);

    setPhase('uploading');
    setProgress(0);
    setUploadError(null);
    setResults([]);
    setRejections([]);
    dismissErrors();

    try {
      const response = await uploadFiles({
        files: payload,
        expiresInMinutes: expiryMinutes,
        onProgress: setProgress,
      });

      setResults(response.uploads);
      setRejections(response.rejections);
      setPhase('success');
      clearAll();
      onUploaded?.(response.uploads);
    } catch (cause) {
      if (cause instanceof ApiError) {
        setUploadError(cause.message);
        setRejections(toRejections(cause));
      } else {
        setUploadError('Something went wrong while uploading. Please try again.');
      }
      setPhase('error');
    }
  };

  const handleDeleted = (token: string) => {
    const remaining = results.filter((upload) => upload.token !== token);
    setResults(remaining);
    onDeleted?.(token);

    if (remaining.length === 0) {
      resetFeedback();
    }
  };

  return (
    <div className="flex flex-col gap-0">
      {(heading !== null || (hasFiles && phase !== 'success')) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {heading !== null && <h2 className="text-sm font-semibold">
            {phase === 'success' ? 'Upload complete' : heading}
          </h2>}
          {hasFiles && phase !== 'success' && (
            <span className="text-xs text-muted">
              {files.length} {files.length === 1 ? 'file' : 'files'} · {totalSizeFormatted}
            </span>
          )}
        </div>
      )}

      {phase === 'success' ? (
        <UploadResults
          uploads={results}
          rejections={rejections}
          onReset={resetFeedback}
          onDeleted={handleDeleted}
        />
      ) : (
        <>
          <UploadArea onFilesSelected={handleAddFiles} disabled={isUploading} />

          <div className="mt-4 flex flex-col gap-3">
            <ValidationErrors errors={errors} onDismiss={dismissErrors} />

            <SelectedFileList files={files} onRemove={removeFile} />

            <ExpirySelector
              mode={expiryMode}
              customMinutes={customMinutes}
              onModeChange={setExpiryMode}
              onCustomMinutesChange={setCustomMinutes}
              disabled={isUploading}
            />

            {isUploading && (
              <div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Uploading {files.length} {files.length === 1 ? 'file' : 'files'}…
                  </span>
                  <span>{progress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  aria-label="Upload progress"
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {phase === 'error' && uploadError && (
              <div role="alert" className="rounded-xl border border-error/40 bg-error/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-error">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  Upload failed
                </p>
                <p className="mt-1 text-xs leading-relaxed text-error/90">{uploadError}</p>

                {rejections.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {rejections.map((rejection) => (
                      <li
                        key={`${rejection.code}-${rejection.filename}`}
                        className="text-xs text-error/90"
                      >
                        <span className="font-semibold">{rejection.filename}</span>
                        <span className="px-1.5 opacity-60" aria-hidden="true">
                          —
                        </span>
                        <span>{rejection.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                {hasFiles
                  ? `${files.length} ${files.length === 1 ? 'file' : 'files'} ready · ${totalSizeFormatted}`
                  : 'Add at least one file to upload.'}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearAll();
                    resetFeedback();
                  }}
                  disabled={!hasFiles || isUploading}
                  className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-accent/60 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={!hasFiles || isUploading || expiryMinutes === null}
                  aria-busy={isUploading}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#0b0713] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isUploading ? 'Uploading…' : phase === 'error' ? 'Try again' : 'Upload files'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
