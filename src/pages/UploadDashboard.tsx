import { useState } from 'react';
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { UploadArea } from '../components/upload/UploadArea';
import { SelectedFileList } from '../components/upload/SelectedFileList';
import { ValidationErrors } from '../components/upload/ValidationErrors';
import { RecentUploads } from '../components/display/RecentUploads';
import { useFileSelection } from '../hooks/useFileSelection';

const steps = [
  'Drag files in, or click the dropzone to browse your device.',
  'Each file is checked for type and size before it is added.',
  'Review your selection and remove anything you do not want.',
  'Continue when you are ready. Nothing is uploaded from this preview.',
];

export const UploadDashboard = () => {
  const { files, errors, totalSizeFormatted, addFiles, removeFile, clearAll, dismissErrors } =
    useFileSelection();
  const [isReady, setIsReady] = useState(false);

  const hasFiles = files.length > 0;

  const handleAddFiles = (incoming: File[]) => {
    setIsReady(false);
    addFiles(incoming);
  };

  const handleRemove = (id: string) => {
    setIsReady(false);
    removeFile(id);
  };

  const handleClearAll = () => {
    setIsReady(false);
    clearAll();
  };

  const handleContinue = () => {
    if (!hasFiles) return;
    setIsReady(true);
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
              <h2 className="text-sm font-semibold">New upload</h2>
              {hasFiles && (
                <span className="text-xs text-muted">
                  {files.length} {files.length === 1 ? 'file' : 'files'} · {totalSizeFormatted}
                </span>
              )}
            </div>

            <UploadArea onFilesSelected={handleAddFiles} />

            <div className="mt-4 flex flex-col gap-3">
              <ValidationErrors errors={errors} onDismiss={dismissErrors} />

              <SelectedFileList files={files} onRemove={handleRemove} />

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted">
                  {hasFiles
                    ? `${files.length} valid ${files.length === 1 ? 'file' : 'files'} ready · ${totalSizeFormatted}`
                    : 'Add at least one file to continue.'}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={!hasFiles}
                    className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-accent/60 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!hasFiles}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#0b0713] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continue
                  </button>
                </div>
              </div>

              {isReady && (
                <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-4">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold text-success">Ready to continue</p>
                    <p className="mt-1 text-xs leading-relaxed text-success/90">
                      {files.length} {files.length === 1 ? 'file' : 'files'} ({totalSizeFormatted})
                      selected. Nothing has been uploaded — generating links arrives in a later
                      phase.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent uploads</h2>
              <span className="text-xs text-muted">3 files</span>
            </div>
            <RecentUploads onCopyLink={handleCopyLink} />
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
              Files stay in your browser during this preview — nothing is sent to a server. Links
              are unguessable and expire automatically once sharing is enabled.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
};
