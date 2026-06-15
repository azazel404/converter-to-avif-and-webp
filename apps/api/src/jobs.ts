import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import archiver from 'archiver';
import unzipper from 'unzipper';
import pLimit from 'p-limit';
import type {
  JobStatus,
  JobManifest,
  FileResult,
  FailedFileError,
  OutputFormat,
} from '@converter/shared';
import { isSupportedFile, isSvg, getOutputExtension, convertBuffer } from './converter.js';
import { config } from './config.js';

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: Date;
  completedAt?: Date;
  totalFiles: number;
  processedFiles: number;
  manifest?: JobManifest;
  errors?: FailedFileError[];
  outputZipPath?: string;
  inputZipName: string;
}

const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function createJob(inputZipName: string): Job {
  const job: Job = {
    id: randomUUID(),
    status: 'queued',
    createdAt: new Date(),
    totalFiles: 0,
    processedFiles: 0,
    inputZipName,
  };
  jobs.set(job.id, job);
  scheduleCleanup(job.id);
  return job;
}

function scheduleCleanup(jobId: string): void {
  setTimeout(async () => {
    const job = jobs.get(jobId);
    if (!job) return;
    if (job.outputZipPath) {
      await fs.rm(job.outputZipPath, { force: true });
    }
    const jobDir = path.join(config.tempDir, jobId);
    await fs.rm(jobDir, { recursive: true, force: true });
    jobs.delete(jobId);
  }, config.jobTtlMs);
}

export async function processJob(
  jobId: string,
  zipBuffer: Buffer,
  targetFormat: OutputFormat,
  quality: number,
  lossless: boolean,
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  job.status = 'processing';

  const jobDir = path.join(config.tempDir, jobId);
  const inputDir = path.join(jobDir, 'input');
  const outputDir = path.join(jobDir, 'output');
  await fs.mkdir(inputDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  try {
    const inputZipPath = path.join(jobDir, 'input.zip');
    await fs.writeFile(inputZipPath, zipBuffer);

    const entries: { relativePath: string; buffer: Buffer }[] = [];
    let entryCount = 0;

    const directory = await unzipper.Open.file(inputZipPath);

    for (const entry of directory.files) {
      if (entry.type === 'Directory') continue;

      entryCount++;
      if (entryCount > config.maxFilesPerZip) {
        throw new Error(
          `Zip contains more than ${config.maxFilesPerZip} files. Reduce file count and retry.`,
        );
      }

      const normalizedPath = path.normalize(entry.path).replace(/\\/g, '/');
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        throw new Error(`Zip-slip detected for path: ${entry.path}`);
      }

      // Skip macOS resource-fork metadata entries created by the Finder
      if (
        normalizedPath.startsWith('__MACOSX/') ||
        path.basename(normalizedPath).startsWith('._')
      ) continue;

      if (!isSupportedFile(normalizedPath)) continue;

      const buffer = await entry.buffer();
      entries.push({ relativePath: normalizedPath, buffer });
    }

    if (entries.length === 0) {
      throw new Error('Zip contains no supported image files.');
    }

    job.totalFiles = entries.length;

    const limit = pLimit(config.workerConcurrency);
    const fileResults: FileResult[] = [];
    const failedFiles: FailedFileError[] = [];

    await Promise.all(
      entries.map((entry) =>
        limit(async () => {
          try {
            const result = await convertBuffer(
              entry.buffer,
              entry.relativePath,
              targetFormat,
              quality,
              lossless,
            );

            const ext = getOutputExtension(result.format);
            const outputRelative = replaceExtension(entry.relativePath, ext);

            const outputFilePath = path.join(outputDir, outputRelative);
            await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
            await fs.writeFile(outputFilePath, result.buffer);

            fileResults.push({
              inputPath: entry.relativePath,
              outputPath: outputRelative,
              inputSize: result.inputSize,
              outputSize: result.outputSize,
              savedBytes: result.savedBytes,
              savedPercent: result.savedPercent,
              format: result.format,
            });

            job.processedFiles++;
          } catch (err) {
            failedFiles.push({
              filePath: entry.relativePath,
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      ),
    );

    if (failedFiles.length > 0) {
      job.status = 'failed';
      job.errors = failedFiles;
      job.completedAt = new Date();
      return;
    }

    const totalInputSize = fileResults.reduce((s, f) => s + f.inputSize, 0);
    const totalOutputSize = fileResults.reduce((s, f) => s + f.outputSize, 0);
    const totalSavedBytes = totalInputSize - totalOutputSize;

    const manifest: JobManifest = {
      jobId,
      createdAt: job.createdAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: 'completed',
      totalInputSize,
      totalOutputSize,
      totalSavedBytes,
      totalSavedPercent:
        totalInputSize > 0 ? Math.round((totalSavedBytes / totalInputSize) * 100) : 0,
      fileCount: fileResults.length,
      files: fileResults,
    };

    const manifestPath = path.join(outputDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    const outputZipPath = path.join(jobDir, 'output.zip');
    await zipDirectory(outputDir, outputZipPath);

    job.outputZipPath = outputZipPath;
    job.manifest = manifest;
    job.status = 'completed';
    job.completedAt = new Date();
  } catch (err) {
    job.status = 'failed';
    job.errors = [
      {
        filePath: '',
        reason: err instanceof Error ? err.message : String(err),
      },
    ];
    job.completedAt = new Date();
  }
}

function replaceExtension(filePath: string, newExt: string): string {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  return dir === '.' ? `${base}${newExt}` : `${dir}/${base}${newExt}`;
}

function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
