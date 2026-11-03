import { useEffect, useState } from 'react';

export function StorageNotice() {
  const [error, setError] = useState('');
  useEffect(() => {
    const listener = (event: Event) => setError((event as CustomEvent<string>).detail);
    window.addEventListener('workspace-storage-error', listener);
    return () => window.removeEventListener('workspace-storage-error', listener);
  }, []);
  if (!error) return null;
  return <div role="alert" className="fixed top-16 left-4 right-4 md:left-auto md:max-w-md z-[100001] bg-red-50 text-red-900 border border-red-300 rounded-xl p-4 shadow-lg">
    <p className="font-semibold">Your changes could not be saved.</p>
    <p className="text-sm mt-1">{error}</p>
    <button className="underline mt-2" onClick={() => setError('')}>Dismiss</button>
  </div>;
}
