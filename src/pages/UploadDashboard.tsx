import { useState } from 'react';
import { AlertCircle, Clock, Loader2, ShieldCheck, UploadCloud } from 'lucide-react';
import { UploadArea } from '../components/upload/UploadArea';
import { SelectedFileList } from '../components/upload/SelectedFileList';
import { ValidationErrors } from '../components/upload/ValidationErrors';
import { ExpirySelector } from '../components/upload/ExpirySelector';
import { UploadResults } from '../components/upload/UploadResults';
import { RecentUploads } from '../components/display/RecentUploads';
import { useFileSelection } from '../hooks/useFileSelection';
import { ApiError, toRejections, uploadFiles } from '../utils/api';
import type { ExpiryOption, PublicUpload, UploadRejection } from '../types';

const steps = [
  'Drag files in, or click the dropzone to browse your device.',
  'Each file is checked for type and size before it is added.',
  'Pick how long the sharing link should stay alive.',
  'Upload — every file gets its own link you can copy and share.',
];

type UploadPhase = 'idle' | 'uploading' | 'success' | 'error';

export const UploadDashboard = () => {
  const { files, errors, totalSizeFormatted, addFiles, removeFile, clearAll, dismissErrors } =
    useFileSelection();

  const [expiry, setExpiry] = useState<ExpiryOption>('24h');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<PublicUpload[]>([]);
  const [rejections, setRejections] = useState<UploadRejection[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recentKey, setRecentKey] = useState(0);

  const hasFiles = files.length > 0;
  const isUploading = phase === 'uploading';

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

  const handleRemove = (id: string) => {
    removeFile(id);
  };

  const handleClearAll = () => {
    clearAll();
    resetFeedback();
  };

  const handleUpload = async () => {
    if (!hasFiles || isUploading) return;

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
        expiresIn: expiry,
        onProgress: setProgress,
      });

      setResults(response.uploads);
      setRejections(response.rejections);
      setPhase('success');
      clearAll();
      setRecentKey((key) => key + 1);
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

  const handleCopyLink = (link: string) => {
    void navigator.clipboard?.writeText(link).catch(() => {
      /* clipboard can be blocked outside a user gesture; nothing to recover */
    });
  };

  return (
    <div className="relative mx-auto w-full max-w-6xl px-6 pt-28 pb-20">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Dashboard</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Upload files</h1>
        <p className="text-sm text-muted sm:text-base">
          Share files with anyone, anywhere — links expire on your schedule.
        </p>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">
                {phase === 'success' ? 'Upload complete' : 'New upload'}
              </h2>
              {hasFiles && phase !== 'success' && (
                <span className="text-xs text-muted">
                  {files.length} {files.length === 1 ? 'file' : 'files'} · {totalSizeFormatted}
                </span>
              )}
            </div>

            {phase === 'success' ? (
              <UploadResults
                uploads={results}
                rejections={rejections}
                onReset={resetFeedback}
              />
            ) : (
              <>
                <UploadArea onFilesSelected={handleAddFiles} />

                <div className="mt-4 flex flex-col gap-3">
                  <ValidationErrors errors={errors} onDismiss={dismissErrors} />

                  <SelectedFileList files={files} onRemove={handleRemove} />

                  <ExpirySelector value={expiry} onChange={setExpiry} disabled={isUploading} />

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
                        onClick={handleClearAll}
                        disabled={!hasFiles || isUploading}
                        className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-accent/60 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Clear all
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUpload()}
                        disabled={!hasFiles || isUploading}
                        aria-busy={isUploading}
                        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#0b0713] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <UploadCloud className="h-4 w-4" aria-hidden="true" />
                        )}
                        {isUploading
                          ? 'Uploading…'
                          : phase === 'error'
                            ? 'Try again'
                            : 'Upload files'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent uploads</h2>
              <span className="text-xs text-muted">Active links</span>
            </div>
            <RecentUploads onCopyLink={handleCopyLink} refreshKey={recentKey} />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold">How it works</h2>
            </div>
            <ol className="mt-5 space-y-4">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-muted">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold">Private by default</h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Files are validated on the server, stored under unguessable names, and served only
              through random share tokens. Expired links are rejected and their files deleted.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
};
