import { AuthProvider } from '@/lib/AuthContext';
import './globals.css';

export const metadata = {
  title: 'Luxus Bot',
  description: 'Your WhatsApp assistant, run from one place.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
