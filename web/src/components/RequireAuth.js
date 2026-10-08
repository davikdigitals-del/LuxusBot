'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

/** Wrap any page that needs a logged-in user with a chosen business. */
export default function RequireAuth({ children }) {
  const { user, loading, currentBusiness, businesses } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-ink-600">
        Loading…
      </div>
    );
  }

  if (!user) return null; // redirecting

  if (businesses.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-sm text-ink-600">
          Your account isn&apos;t attached to a business yet. Contact whoever invited you.
        </p>
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-ink-600">
        Loading…
      </div>
    );
  }

  return children;
}
