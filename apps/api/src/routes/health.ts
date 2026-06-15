import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import type { HealthResponse } from '@converter/shared';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>('/health', async (_req, reply) => {
    const sharpVersions = sharp.versions;
    return reply.send({
      status: 'ok',
      version: '1.0.0',
      sharp: {
        version: sharpVersions.sharp ?? 'unknown',
        libvips: sharpVersions.vips ?? 'unknown',
      },
      timestamp: new Date().toISOString(),
    });
  });
}
