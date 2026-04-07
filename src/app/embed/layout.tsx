import '../globals.css';

export const metadata = {
  title: 'Afterlife Chat',
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: '20px', background: 'transparent' }}>
        {children}
      </body>
    </html>
  );
}
