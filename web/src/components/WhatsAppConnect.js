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
  const isAgent = statusUrl.startsWith('/api/agent/');
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

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current);
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (data?.status === 'qr') {
        clearInterval(pollRef.current);
      } else if (data?.status === 'disconnected') {
        clearInterval(pollRef.current);
        if (data.lastDisconnectReason) {
          setError(`WhatsApp disconnected: ${data.lastDisconnectReason}`);
        }
      } else if (Date.now() - startedAt >= 120000) {
        if (data?.status !== 'connected') {
          clearInterval(pollRef.current);
          setError('WhatsApp did not connect or provide a QR code. Check the API service logs, then retry.');
        }
      }
    }, 2000);
  }, [fetchStatus]);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().then((data) => {
      if (!cancelled && (data?.status === 'connecting' || data?.status === 'connected')) startPolling();
    });
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [fetchStatus, startPolling]);

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

  const onResetAndReconnect = async () => {
    if (!window.confirm('Reset this WhatsApp link? You will need to scan a new QR code.')) return;

    setBusy(true);
    setError('');
    clearInterval(pollRef.current);
    try {
      await api.delete(disconnectUrl);
      setState({ status: 'disconnected', qr: null, phoneNumber: null });
      const result = await api.post(connectUrl);
      setState(result);
      startPolling();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the WhatsApp connection.');
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
          {state.lastInboundAt && (
            <p className="mt-2 text-xs text-ink-600">
              Last WhatsApp message received by the server: {new Date(state.lastInboundAt).toLocaleString()}
              {state.lastInboundType ? ` · ${state.lastInboundType}` : ''}
            </p>
          )}
          {state.status === 'connected' && !state.lastInboundAt && (
            <p className="mt-2 text-xs text-ink-600">
              Connected, but no {isAgent ? 'agent self-chat messages' : 'incoming customer messages'} have been recorded by the server yet.
            </p>
          )}
          {state.lastDisconnectReason && state.status !== 'connected' && (
            <p className="mt-2 break-words text-xs text-signal-red">Last connection issue: {state.lastDisconnectReason}</p>
          )}
        </div>
        {state.status === 'connected' ? (
          <Button className="w-full sm:w-auto" variant="danger" onClick={onDisconnect} disabled={busy}>Disconnect</Button>
        ) : state.status === 'connecting' ? (
          <Button className="w-full sm:w-auto" variant="danger" onClick={onResetAndReconnect} disabled={busy}>
            {busy ? 'Resetting…' : 'Reset & reconnect'}
          </Button>
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
