export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',

  maxSingleFileSize: Number(process.env.MAX_SINGLE_FILE_SIZE ?? 52_428_800),
  maxZipSize: Number(process.env.MAX_ZIP_SIZE ?? 524_288_000),
  maxFilesPerZip: Number(process.env.MAX_FILES_PER_ZIP ?? 500),

  defaultQuality: Number(process.env.DEFAULT_QUALITY ?? 82),
  qualityThreshold: Number(process.env.QUALITY_THRESHOLD ?? 0.95),

  workerConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 4),
  tempDir: process.env.TEMP_DIR ?? '/tmp/converter-jobs',
  jobTtlMs: Number(process.env.JOB_TTL_MS ?? 3_600_000),

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim()),
} as const;
