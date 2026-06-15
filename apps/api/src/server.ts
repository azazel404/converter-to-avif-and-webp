import fs from 'node:fs/promises';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { convertRoutes } from './routes/convert.js';
import { jobRoutes } from './routes/jobs.js';

const app = Fastify({ logger: true });

await app.register(fastifyCors, {
  origin: config.corsOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
});

await app.register(fastifyMultipart, {
  limits: {
    fileSize: config.maxZipSize,
  },
});

await app.register(healthRoutes);
await app.register(convertRoutes);
await app.register(jobRoutes);

await fs.mkdir(config.tempDir, { recursive: true });

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`API server listening on http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
