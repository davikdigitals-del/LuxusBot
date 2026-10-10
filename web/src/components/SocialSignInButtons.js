'use client';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

function ProviderMark({ provider }) {
  if (provider === 'github') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
        <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.07c-3.1.67-3.76-1.32-3.76-1.32-.5-1.29-1.23-1.63-1.23-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.7 2.62 1.21 3.26.93.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.11-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.61 5.23-5.1 5.51.4.35.75 1.03.75 2.08V22c0 .29.2.64.77.53A11.1 11.1 0 0 0 12 .9Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M19.73 5.18a18.3 18.3 0 0 0-4.5-1.39l-.55 1.13a16.8 16.8 0 0 0-5.35 0l-.56-1.13a18.2 18.2 0 0 0-4.5 1.4C1.43 9.37.66 13.46 1.04 17.49a18 18 0 0 0 5.52 2.8l1.2-1.95a11.7 11.7 0 0 1-1.9-.92l.47-.37c3.67 1.7 7.65 1.7 11.28 0l.48.37c-.61.36-1.25.67-1.91.92l1.2 1.95a18 18 0 0 0 5.52-2.8c.46-4.67-.78-8.72-3.17-12.31ZM8.92 14.84c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.89 2.2-2 2.2Zm6.16 0c-1.1 0-2-.99-2-2.2s.88-2.2 2-2.2 2 .99 2 2.2-.88 2.2-2 2.2Z" />
    </svg>
  );
}

export default function SocialSignInButtons() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {['github', 'discord'].map((provider) => (
        <a
          key={provider}
          href={`${API_URL}/api/auth/${provider}`}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-3 text-sm font-medium text-ink-800 transition hover:bg-stone-100"
        >
          <ProviderMark provider={provider} />
          <span>Continue with {provider === 'github' ? 'GitHub' : 'Discord'}</span>
        </a>
      ))}
    </div>
  );
}
