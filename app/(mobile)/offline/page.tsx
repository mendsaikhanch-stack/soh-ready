'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-4">📡</div>
      <h1 className="text-xl font-bold text-gray-800 mb-2">Интернэт холболтгүй</h1>
      <p className="text-sm text-gray-500 mb-6">
        Интернэт холболтоо шалгаад дахин оролдоно уу.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold active:bg-blue-700 transition"
      >
        Дахин оролдох
      </button>
    </div>
  );
}
