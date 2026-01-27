'use client';

import { useEffect } from 'react';

export default function SupervisorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Supervisor Portal Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
      <div className="bg-red-50 text-red-700 p-4 rounded-lg shadow-sm max-w-md w-full text-center">
        <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
        <p className="text-sm mb-4">{error.message || 'An error occurred in the supervisor portal.'}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Reload Dashboard
        </button>
      </div>
    </div>
  );
}
