import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { OutputFormat, ConvertSingleResponse } from '@converter/shared';
import { convertBuffer, isSupportedFile } from '../converter.js';
import { config } from '../config.js';

interface ConvertQuery {
  format?: string;
  quality?: string;
  lossless?: string;
}

export async function convertRoutes(app: FastifyInstance): Promise<void> {
  app.post('/convert', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as ConvertQuery;
    const targetFormat = (query.format ?? 'auto') as OutputFormat;
    const quality = Math.min(100, Math.max(1, Number(query.quality ?? config.defaultQuality)));
    const lossless = query.lossless === 'true';

    const data = await req.file({ limits: { fileSize: config.maxSingleFileSize } });
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded.' });
    }

    if (!isSupportedFile(data.filename)) {
      return reply.status(415).send({
        error: `Unsupported file type: ${data.filename}. Supported: png, jpg, jpeg, gif, tiff, bmp, webp, avif, svg.`,
      });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const inputBuffer = Buffer.concat(chunks);

    const result = await convertBuffer(inputBuffer, data.filename, targetFormat, quality, lossless);

    const response: ConvertSingleResponse = {
      originalSize: result.inputSize,
      convertedSize: result.outputSize,
      savedBytes: result.savedBytes,
      savedPercent: result.savedPercent,
      format: result.format,
    };

    const ext = result.format === 'svg' ? 'svg' : result.format === 'avif' ? 'avif' : 'webp';
    const contentType =
      result.format === 'svg' ? 'image/svg+xml' : `image/${result.format}`;

    return reply
      .header('Content-Type', contentType)
      .header('X-Original-Size', String(result.inputSize))
      .header('X-Converted-Size', String(result.outputSize))
      .header('X-Saved-Bytes', String(result.savedBytes))
      .header('X-Saved-Percent', String(result.savedPercent))
      .header('X-Chosen-Format', result.format)
      .header(
        'Content-Disposition',
        `attachment; filename="${data.filename.replace(/\.[^.]+$/, '')}.${ext}"`,
      )
      .send(result.buffer);
  });
}
