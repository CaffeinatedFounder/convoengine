import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ConvoEngine — Afterlife Chat',
  description: 'Intelligent chatbot for Afterlife — India\'s first digital succession planning platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
