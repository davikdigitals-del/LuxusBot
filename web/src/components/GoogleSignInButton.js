'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

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
      <p role="alert" className="text-center text-sm text-signal-red">
        Google sign-in is not configured.
      </p>
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
      <div ref={buttonRef} className="min-h-10 w-full" />
      {scriptFailed && (
        <p role="alert" className="mt-2 text-center text-sm text-signal-red">
          Google sign-in could not be loaded.
        </p>
      )}
    </div>
  );
}
