import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import { IconCheck } from '@/components/icons';

export const metadata = { title: 'Payment received - Luxus Bot' };

export default function WelcomePage() {
  return (
    <AuthShell>
      <div className="text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-signal-green/10 text-signal-green">
          <IconCheck className="h-5 w-5" />
        </span>
        <h2 className="mt-4 font-display text-2xl text-ink-900">Thank you - payment received</h2>
        <p className="mt-2 text-sm text-ink-600">
          We&apos;re setting up your account now. <span className="text-ink-800">Check your email</span> for a link to set your password
          (it can take a minute or two to arrive; check spam too).
        </p>
        <p className="mt-4 text-sm text-ink-600">
          No email after a few minutes? Use <Link href="/forgot-password" className="font-medium text-brass-dark hover:underline">Forgot password</Link> with the
          email you paid with.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brass-dark hover:underline">
          Go to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
