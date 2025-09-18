'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

export default function ScanForm() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setProgress(10);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userId: 'clerk_user_id' }), // Replace with Clerk user ID
      });
      setProgress(50);
      const data = await res.json();
      setProgress(100);
      alert('Scan complete! Results: ' + JSON.stringify(data.results));
    } catch (error) {
      alert('Scan failed');
    }
    setLoading(false);
    setProgress(0);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-6">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter website URL"
        className="w-full p-3 mb-4 border rounded"
        required
        aria-label="Website URL for ADA scan"
      />
      {loading && <Progress value={progress} className="mb-4" />}
      <Button type="submit" disabled={loading} className="w-full bg-secondary hover:bg-green-700" aria-label="Run ADA scan">
        {loading ? 'Scanning...' : 'Run ADA Scan'}
      </Button>
    </form>
  );
}