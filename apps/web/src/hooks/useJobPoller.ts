import { useEffect, useRef, useState } from 'react';
import type { JobStatusResponse } from '@converter/shared';
import { pollJob } from '@/lib/api';

const POLL_INTERVAL_MS = 1500;

export function useJobPoller(jobId: string | null) {
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setJobStatus(null);
    setError(null);

    if (!jobId) {
      return;
    }

    let cancelled = false;

    async function poll() {
      if (cancelled || !jobId) return;
      try {
        const status = await pollJob(jobId);
        if (!cancelled) {
          setJobStatus(status);
          if (status.status === 'completed' || status.status === 'failed') {
            return;
          }
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId]);

  return { jobStatus, error };
}
