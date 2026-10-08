export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`rounded border border-stone-200 bg-white p-5 ${className}`}>{children}</div>;
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-stone-100 text-ink-700',
    green: 'bg-signal-green/10 text-signal-green',
    amber: 'bg-signal-amber/10 text-brass-dark',
    red: 'bg-signal-red/10 text-signal-red',
  };
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50',
    secondary: 'border border-stone-300 text-ink-800 hover:bg-stone-100 disabled:opacity-50',
    danger: 'border border-signal-red/30 text-signal-red hover:bg-signal-red/5 disabled:opacity-50',
  };
  return (
    <button className={`rounded px-3.5 py-2 text-sm font-medium transition ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded border border-dashed border-stone-300 py-12 text-center">
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 rounded border border-signal-red/30 bg-signal-red/5 px-3 py-2 text-sm text-signal-red">
      {message}
    </div>
  );
}
