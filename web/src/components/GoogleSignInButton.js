'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.38 38.06 46.98 31.94 46.98 24.55Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

export default function GoogleSignInButton({ onCredential, onError }) {
  const buttonRef = useRef(null);
  const credentialHandlerRef = useRef(onCredential);
  const errorHandlerRef = useRef(onError);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    credentialHandlerRef.current = onCredential;
    errorHandlerRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    if (!scriptLoaded || !clientId || !buttonRef.current || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response.credential) {
          errorHandlerRef.current?.('Google did not return a sign-in credential.');
          return;
        }
        credentialHandlerRef.current?.(response.credential);
      },
    });
    buttonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: Math.floor(buttonRef.current.getBoundingClientRect().width),
    });
  }, [clientId, scriptLoaded]);

  if (!clientId) {
    return (
      <div>
        <button
          type="button"
          disabled
          className="flex min-h-11 w-full items-center justify-center gap-3 rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-ink-800 opacity-70"
          aria-describedby="google-signin-configuration"
        >
          <GoogleMark />
          Continue with Google
        </button>
        <p id="google-signin-configuration" role="status" className="mt-2 text-center text-xs text-ink-600">
          Google sign-in will be available after the site is configured.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptLoaded(true)}
        onError={() => {
          setScriptFailed(true);
          errorHandlerRef.current?.('Could not load Google sign-in. Please try again.');
        }}
      />
      <div className="relative min-h-11 w-full">
        <div ref={buttonRef} className="min-h-11 w-full" />
        {!scriptLoaded && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 rounded-md border border-stone-300 bg-white text-sm font-medium text-ink-800"
          >
            <GoogleMark />
            Continue with Google
          </div>
        )}
      </div>
      {scriptFailed && (
        <p role="alert" className="mt-2 text-center text-sm text-signal-red">
          Google sign-in could not be loaded.
        </p>
      )}
    </div>
  );
}
