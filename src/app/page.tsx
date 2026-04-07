export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-afterlife-navy mb-4">
          ConvoEngine
        </h1>
        <p className="text-gray-600 mb-6">
          Intelligent chatbot for Afterlife — India&apos;s first digital succession planning platform.
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          <p>API: <code className="bg-gray-100 px-2 py-1 rounded">/api/chat</code></p>
          <p>Widget: <code className="bg-gray-100 px-2 py-1 rounded">/widget</code></p>
          <p>Admin: <code className="bg-gray-100 px-2 py-1 rounded">/admin</code></p>
        </div>
      </div>
    </main>
  );
}
