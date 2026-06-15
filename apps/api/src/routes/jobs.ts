import fs from 'node:fs';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CreateJobResponse, JobStatusResponse, OutputFormat } from '@converter/shared';
import { createJob, getJob, processJob } from '../jobs.js';
import { config } from '../config.js';

interface JobQuery {
  format?: string;
  quality?: string;
  lossless?: string;
}

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.post('/jobs', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as JobQuery;
      const targetFormat = (query.format ?? 'auto') as OutputFormat;
      const quality = Math.min(100, Math.max(1, Number(query.quality ?? config.defaultQuality)));
      const lossless = query.lossless === 'true';

      const data = await req.file({ limits: { fileSize: config.maxZipSize } });
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded.' });
      }

      if (!data.filename.endsWith('.zip')) {
        return reply.status(415).send({ error: 'Only .zip archives are accepted for batch jobs.' });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      const zipBuffer = Buffer.concat(chunks);

      const job = createJob(data.filename);

      const response: CreateJobResponse = {
        jobId: job.id,
        status: job.status,
        message: 'Job created. Processing started asynchronously.',
      };

      reply.status(202).send(response);

      processJob(job.id, zipBuffer, targetFormat, quality, lossless).catch((err) => {
        app.log.error({ jobId: job.id, err }, 'Unhandled job processing error');
      });
    } catch (err) {
      app.log.error({ err }, 'Error in POST /jobs');
      const errorMessage = err instanceof Error ? err.message : 'Failed to process upload';
      return reply.status(500).send({ error: errorMessage });
    }
  });

  app.get('/jobs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const job = getJob(id);

    if (!job) {
      return reply.status(404).send({ error: `Job ${id} not found or has expired.` });
    }

    const response: JobStatusResponse = {
      jobId: job.id,
      status: job.status,
      progress:
        job.totalFiles > 0 ? Math.round((job.processedFiles / job.totalFiles) * 100) : 0,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      manifest: job.manifest,
      errors: job.errors,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };

    return reply.send(response);
  });

  app.get('/jobs/:id/download', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const job = getJob(id);

    if (!job) {
      return reply.status(404).send({ error: `Job ${id} not found or has expired.` });
    }

    if (job.status !== 'completed' || !job.outputZipPath) {
      return reply.status(409).send({
        error: `Job is not completed yet. Current status: ${job.status}`,
        status: job.status,
        errors: job.errors,
      });
    }

    const baseName = job.inputZipName.replace(/\.zip$/i, '');
    const downloadName = `${baseName}-optimized.zip`;

    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${downloadName}"`)
      .send(fs.createReadStream(job.outputZipPath));
  });
}
