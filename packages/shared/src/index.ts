export type OutputFormat = 'webp' | 'avif' | 'svg' | 'auto';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface FileResult {
  inputPath: string;
  outputPath: string;
  inputSize: number;
  outputSize: number;
  savedBytes: number;
  savedPercent: number;
  format: OutputFormat;
}

export interface JobManifest {
  jobId: string;
  createdAt: string;
  completedAt?: string;
  status: JobStatus;
  totalInputSize: number;
  totalOutputSize: number;
  totalSavedBytes: number;
  totalSavedPercent: number;
  fileCount: number;
  files: FileResult[];
}

export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  message: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress?: number;
  totalFiles?: number;
  processedFiles?: number;
  manifest?: JobManifest;
  errors?: FailedFileError[];
  createdAt: string;
  completedAt?: string;
}

export interface FailedFileError {
  filePath: string;
  reason: string;
}

export interface ConvertSingleResponse {
  originalSize: number;
  convertedSize: number;
  savedBytes: number;
  savedPercent: number;
  format: OutputFormat;
}

export interface ConvertSingleQuery {
  format?: OutputFormat;
  quality?: number;
  lossless?: boolean;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  sharp: {
    version: string;
    libvips: string;
  };
  timestamp: string;
}

export const SUPPORTED_RASTER_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/webp',
  'image/avif',
] as const;

export const SUPPORTED_VECTOR_TYPES = ['image/svg+xml'] as const;

export const SUPPORTED_INPUT_TYPES = [
  ...SUPPORTED_RASTER_TYPES,
  ...SUPPORTED_VECTOR_TYPES,
] as const;

export type SupportedMimeType = (typeof SUPPORTED_INPUT_TYPES)[number];
