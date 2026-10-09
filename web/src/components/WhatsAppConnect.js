'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api, { ApiError } from '@/lib/api';
import { Badge, Button, ErrorBanner } from '@/components/ui';

const STATUS_LABEL = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  qr: 'Scan to connect',
  connected: 'Connected',
};
const STATUS_TONE = { disconnected: 'neutral', connecting: 'amber', qr: 'amber', connected: 'green' };

/**
 * Shared connect/status/disconnect UI for both a business's assistant
 * number and one agent's own linked number - same flow, different endpoints.
 */
export default function WhatsAppConnect({ statusUrl, connectUrl, disconnectUrl, subtitle }) {
  const [state, setState] = useState({ status: 'disconnected', qr: null, phoneNumber: null });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get(statusUrl);
      setState(data);
      return data;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check connection status.');
      return null;
    }
  }, [statusUrl]);

  useEffect(() => {
    fetchStatus();
    return () => clearInterval(pollRef.current);
  }, [fetchStatus]);

  const startPolling = () => {
    clearInterval(pollRef.current);
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (data && (data.status === 'connected' || data.status === 'qr')) {
        clearInterval(pollRef.current);
      } else if (Date.now() - startedAt >= 120000) {
        clearInterval(pollRef.current);
        setError('WhatsApp did not provide a QR code. Please try again.');
      }
    }, 2000);
  };

  const onConnect = async () => {
    setBusy(true);
    setError('');
    const refreshing = state.status === 'qr';
    if (refreshing) setState((current) => ({ ...current, status: 'connecting', qr: null }));
    try {
      const result = await api.post(connectUrl, refreshing ? { refresh: true } : undefined);
      setState(result);
      startPolling();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the connection.');
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    setBusy(true);
    setError('');
    try {
      await api.delete(disconnectUrl);
      clearInterval(pollRef.current);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not disconnect.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-stone-200 bg-white p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[state.status]}>{STATUS_LABEL[state.status]}</Badge>
            {state.phoneNumber && <span className="text-sm text-ink-700">{state.phoneNumber}</span>}
          </div>
          {subtitle && <p className="mt-1 text-sm text-ink-600">{subtitle}</p>}
        </div>
        {state.status === 'connected' ? (
          <Button className="w-full sm:w-auto" variant="danger" onClick={onDisconnect} disabled={busy}>Disconnect</Button>
        ) : (
          <Button className="w-full sm:w-auto" onClick={onConnect} disabled={busy || state.status === 'connecting'}>
            {state.status === 'qr' ? 'Refresh QR' : 'Connect'}
          </Button>
        )}
      </div>

      <ErrorBanner message={error} />

      {state.status === 'qr' && state.qr && (
        <div className="flex flex-col items-center py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt="WhatsApp QR code" className="h-56 w-56 rounded border border-stone-200" />
          <p className="mt-3 text-sm text-ink-600">Open WhatsApp → Linked devices → Link a device</p>
        </div>
      )}
    </div>
  );
}
