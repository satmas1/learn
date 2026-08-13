import './globals.css';
import 'mafs/core.css';
import 'mafs/font.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'EduEngine — Adaptive Mastery',
  description: 'Interactive, adaptive curriculum mastery powered by Bayesian Knowledge Tracing.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
