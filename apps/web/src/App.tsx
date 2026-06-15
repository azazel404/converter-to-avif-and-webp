import { useState, useCallback, useEffect, useRef } from 'react';
import { Download, RefreshCw, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DropZone } from '@/components/DropZone';
import { ResultsTable, SummaryCard } from '@/components/ResultsTable';
import { useJobPoller } from '@/hooks/useJobPoller';
import { submitJob, getDownloadUrl } from '@/lib/api';

type Stage = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export default function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { jobStatus, error: pollError } = useJobPoller(jobId);

  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    setJobId(null);
    setIsUploading(true);
    try {
      const res = await submitJob(file);
      setJobId(res.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadError(message);
      toast.error('Upload failed', { description: message });
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Derive the UI stage from a single source of truth. No competing state,
  // no setState-during-render, no races with the poller.
  const stage: Stage = uploadError || pollError || jobStatus?.status === 'failed'
    ? 'error'
    : jobStatus?.status === 'completed'
      ? 'done'
      : jobId
        ? 'processing'
        : isUploading
          ? 'uploading'
          : 'idle';

  // Fire toasts on terminal-state transitions only (effects, never during render).
  const notifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!jobStatus || notifiedRef.current === jobStatus.jobId + jobStatus.status) return;
    if (jobStatus.status === 'completed') {
      notifiedRef.current = jobStatus.jobId + jobStatus.status;
      toast.success('Conversion complete!', {
        description: `${jobStatus.manifest?.fileCount ?? 0} files optimized — saved ${jobStatus.manifest?.totalSavedPercent ?? 0}%`,
      });
    } else if (jobStatus.status === 'failed') {
      notifiedRef.current = jobStatus.jobId + jobStatus.status;
      toast.error('Conversion failed', {
        description: jobStatus.errors?.[0]?.reason ?? 'One or more files could not be converted.',
      });
    }
  }, [jobStatus]);

  const handleReset = useCallback(() => {
    setJobId(null);
    setIsUploading(false);
    setUploadError(null);
  }, []);

  const progress =
    stage === 'uploading'
      ? 10
      : stage === 'processing'
        ? Math.max(15, jobStatus?.progress ?? 15)
        : stage === 'done'
          ? 100
          : 0;

  const errorMessage =
    uploadError ??
    pollError ??
    (jobStatus?.errors && jobStatus.errors.length > 0
      ? jobStatus.errors.map((e) => `${e.filePath || 'archive'}: ${e.reason}`).join('\n')
      : null) ??
    'An unexpected error occurred.';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center rounded-lg bg-primary p-1.5">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-foreground">Asset Optimizer</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">WebP · AVIF · SVG</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Shrink your frontend assets
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Upload a <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">.zip</code>{' '}
            of PNG, JPEG, GIF, TIFF, BMP, WebP, AVIF, or SVG files. Get back a smaller{' '}
            <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">.zip</code> with the
            best modern format for each file — automatically.
          </p>
        </div>

        {/* Upload zone (idle) */}
        {stage === 'idle' && <DropZone onFile={handleFile} />}

        {/* Progress (uploading / processing) */}
        {(stage === 'uploading' || stage === 'processing') && (
          <div className="rounded-xl border border-border bg-card p-8 space-y-5 text-center">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {stage === 'uploading' ? 'Uploading archive…' : 'Converting assets…'}
              </p>
              {stage === 'processing' && jobStatus && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {jobStatus.processedFiles ?? 0} / {jobStatus.totalFiles ?? '?'} files processed
                </p>
              )}
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground font-mono">{progress}%</p>
          </div>
        )}

        {/* Error state */}
        {stage === 'error' && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 space-y-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
              <div>
                <p className="font-semibold text-destructive">Conversion failed</p>
                <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                  {errorMessage}
                </pre>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        )}

        {/* Done state */}
        {stage === 'done' && jobStatus?.manifest && (
          <div className="space-y-6">
            <SummaryCard
              totalInputSize={jobStatus.manifest.totalInputSize}
              totalOutputSize={jobStatus.manifest.totalOutputSize}
              totalSavedPercent={jobStatus.manifest.totalSavedPercent}
              fileCount={jobStatus.manifest.fileCount}
            />

            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Per-file results</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RefreshCw className="h-4 w-4" />
                  New conversion
                </Button>
                {jobId && (
                  <Button size="sm" asChild>
                    <a href={getDownloadUrl(jobId)} download>
                      <Download className="h-4 w-4" />
                      Download optimized .zip
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <ResultsTable files={jobStatus.manifest.files} />
          </div>
        )}
      </main>
    </div>
  );
}
