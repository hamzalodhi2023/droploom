import { ShieldCheck, Timer, Link2, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UploadFlow } from '../components/upload/UploadFlow';

const features = [
  {
    icon: ShieldCheck,
    title: 'Secure sharing',
    body: 'Links are unguessable and private by default. Only people you send them to can open the file.',
  },
  {
    icon: Timer,
    title: 'Expiry control',
    body: 'Set a lifetime from one minute to seven days. When the timer runs out, the link stops working.',
  },
  {
    icon: Link2,
    title: 'Easy sharing',
    body: 'One link, any device. Copy it to a message, a ticket or an email and you are done.',
  },
];

const steps = [
  {
    title: 'Upload',
    body: 'Drag a file into the dropzone or pick one from your device — any file type up to 100 MB.',
  },
  {
    title: 'Generate',
    body: 'Droploom creates a short sharing link with the expiry window you choose.',
  },
  {
    title: 'Share',
    body: 'Send the link anywhere. Access ends automatically when the link expires.',
  },
];

export const LandingPage = () => {
  return (
    <div className="relative overflow-hidden">
      {/* Decorative background glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      {/* Hero */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pt-32 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Temporary links. Zero friction.
          </span>

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Your files.{' '}
            <span className="bg-gradient-to-r from-accent to-fuchsia-500 bg-clip-text text-transparent">
              Your link.
            </span>{' '}
            Your control.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
            <span className="block">
              Securely share files with temporary links that expire on your schedule.
            </span>
            <span className="block">
              No accounts needed. No complicated setup.
            </span>
          </p>
        </div>

        {/* Dropzone */}
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-2xl border border-border bg-card p-5 text-left sm:p-6">
            <UploadFlow heading={null} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Features</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need. Nothing you don't.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent/60 hover:bg-accent-soft"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Three steps. About ten seconds.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="relative rounded-2xl border border-border bg-card p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {index + 1}
              </span>
              <h3 className="mt-5 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="overflow-hidden rounded-3xl border border-border bg-card px-8 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to send something?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted sm:text-base">
            Open the dashboard, drop a file and get a link that cleans up after itself.
          </p>
          <Link
            to="/upload"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#0b0713] transition-opacity hover:opacity-90"
          >
            Start sharing
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted sm:flex-row">
          <p>© 2025 Droploom. All rights reserved.</p>
          <nav className="flex items-center gap-6">
            <Link to="/" className="transition-colors hover:text-fg">
              Home
            </Link>
            <Link to="/upload" className="transition-colors hover:text-fg">
              Dashboard
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
