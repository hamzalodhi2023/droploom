import { useState } from 'react';
import { Clock, ShieldCheck } from 'lucide-react';
import { UploadFlow } from '../components/upload/UploadFlow';
import { RecentUploads } from '../components/display/RecentUploads';

const steps = [
  'Drag files in, or click the dropzone to browse your device.',
  'Pick an expiry — presets or a custom number of minutes.',
  'Upload — every file gets its own link you can copy and share.',
  'Keep this tab open if you want to delete a file before it expires.',
];

export const UploadDashboard = () => {
  const [recentKey, setRecentKey] = useState(0);

  const handleCopyLink = (link: string) => {
    void navigator.clipboard?.writeText(link).catch(() => {
      /* clipboard can be blocked outside a user gesture; nothing to recover */
    });
  };

  const refreshRecent = () => setRecentKey((key) => key + 1);

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
            <UploadFlow onUploaded={refreshRecent} onDeleted={refreshRecent} />
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
              Files are stored under unguessable names and served only through random share
              tokens. Deletion needs a separate private key that is shown only once.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
};
