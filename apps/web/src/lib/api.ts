import type {
  CreateJobResponse,
  JobStatusResponse,
  OutputFormat,
} from '@converter/shared';

const BASE_URL = '/api';

export async function submitJob(
  zipFile: File,
  format: OutputFormat = 'auto',
  quality = 82,
  lossless = false,
): Promise<CreateJobResponse> {
  const form = new FormData();
  form.append('file', zipFile);

  const params = new URLSearchParams({
    format,
    quality: String(quality),
    lossless: String(lossless),
  });

  const url = `${BASE_URL}/jobs?${params}`;
  console.log('[API] POST', url, { fileName: zipFile.name, size: zipFile.size });

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: form,
    });

    console.log('[API] Response status:', res.status, res.statusText);

    if (!res.ok) {
      const contentType = res.headers.get('content-type');
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      
      if (contentType?.includes('application/json')) {
        try {
          const err = await res.json();
          console.error('[API] Error response:', err);
          errorMessage = (err as { error?: string }).error ?? errorMessage;
        } catch (parseErr) {
          console.error('[API] Failed to parse error JSON:', parseErr);
        }
      } else {
        const text = await res.text();
        console.error('[API] Error response (non-JSON):', text);
        if (text) errorMessage = text;
      }
      
      throw new Error(errorMessage);
    }

    const data = await res.json() as CreateJobResponse;
    console.log('[API] Success:', data);
    return data;
  } catch (err) {
    console.error('[API] submitJob failed:', err);
    throw err;
  }
}

export async function pollJob(jobId: string): Promise<JobStatusResponse> {
  const url = `${BASE_URL}/jobs/${jobId}`;
  
  try {
    const res = await fetch(url);

    if (!res.ok) {
      const contentType = res.headers.get('content-type');
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      
      if (contentType?.includes('application/json')) {
        try {
          const err = await res.json();
          console.error('[API] Poll error response:', err);
          errorMessage = (err as { error?: string }).error ?? errorMessage;
        } catch (parseErr) {
          console.error('[API] Failed to parse poll error JSON:', parseErr);
        }
      }
      
      throw new Error(errorMessage);
    }

    return res.json() as Promise<JobStatusResponse>;
  } catch (err) {
    console.error('[API] pollJob failed:', err);
    throw err;
  }
}

export function getDownloadUrl(jobId: string): string {
  return `${BASE_URL}/jobs/${jobId}/download`;
}
