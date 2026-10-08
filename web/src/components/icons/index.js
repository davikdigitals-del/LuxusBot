// Small hand-drawn icon set - no external icon library dependency.
// Kept to 1.5px stroke, 20x20 viewBox, matching the restrained line-icon
// feel used across the auth panels and form fields.

export function IconMail(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M3 5.5l7 5.5 7-5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLock(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="4" y="9" width="12" height="8" rx="1.5" />
      <path d="M6.5 9V6.5a3.5 3.5 0 017 0V9" strokeLinecap="round" />
    </svg>
  );
}

export function IconEye(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5-8-5.5-8-5.5z" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.25" />
    </svg>
  );
}

export function IconEyeOff(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 3l14 14" strokeLinecap="round" />
      <path d="M9.17 4.6A8.7 8.7 0 0110 4.5c5 0 8 5.5 8 5.5a13.6 13.6 0 01-2.6 3.28M6.6 6.1C3.9 7.6 2 10 2 10s3 5.5 8 5.5c1.08 0 2.06-.2 2.94-.55" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.1 8.1a2.25 2.25 0 003.1 3.1" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M3.5 17c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconBuilding(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="4" y="3" width="12" height="14" rx="1" />
      <path d="M7.5 6.5h1M11.5 6.5h1M7.5 9.5h1M11.5 9.5h1M7.5 12.5h1M11.5 12.5h1" strokeLinecap="round" />
      <path d="M8.5 17v-2.5h3V17" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 10.5l4 4 8-8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSpinner(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M17.5 10a7.5 7.5 0 00-7.5-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconChat(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M3 4.5h14v9H8l-3.5 3v-3H3v-9z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconHandoff(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="5.5" cy="6" r="2.25" />
      <circle cx="14.5" cy="14" r="2.25" />
      <path d="M8 7l4.5 6M12 6.5l-1.5 1.5M13 15.5l1.5-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBook(props) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M10 5.5c-1.2-1-3-1.5-6-1.5v10.5c3 0 4.8.5 6 1.5 1.2-1 3-1.5 6-1.5V4c-3 0-4.8.5-6 1.5z" strokeLinejoin="round" />
      <path d="M10 5.5v10.5" />
    </svg>
  );
}
