import InlineChat from '@/components/InlineChat';

export default function EmbedPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '0',
      background: 'transparent',
    }}>
      <InlineChat />
    </div>
  );
}
