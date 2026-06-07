import 'reflect-metadata';
import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildCompileDirs,
  cleanupTempDir,
  copyOutputToPersistentLocation,
  handleCompileRequest,
} from './compile.js';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true,
});

// Register CORS plugin to allow cross-origin requests from web demo and mobile
fastify.register(fastifyCors, {
  origin: true, // Allow all origins for development and mobile access
  credentials: true,
});

// Register multipart plugin for file uploads
fastify.register(fastifyMultipart, {
  limits: {
    fieldNameSize: 100, // Max field name size in bytes
    fieldSize: 1000000, // Max field value size in bytes
    fields: 10, // Max number of non-file fields
    fileSize: 100000000, // Max file size (100MB)
    files: 10, // Max number of file fields
  },
});

// Register static plugin to serve the build directory
const serverBuildDir = path.resolve(__dirname, '../build');
fastify.register(fastifyStatic, {
  root: serverBuildDir,
  prefix: '/serve/', // Access files via http://<server>/serve/<filename>
});
fastify.log.info(`Serving static files from ${serverBuildDir} under /serve/`);

// --- GET /health Endpoint ---
fastify.get('/health', async (request, reply) => {
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    const healthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      version: '0.0.1',
      memory: {
        used: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100, // MB
        total: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100, // MB
      },
      pid: process.pid,
    };

    fastify.log.info('Health check requested - server is healthy');
    reply.status(200).send(healthResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fastify.log.error(`Health check failed: ${message}`);
    reply.status(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: message,
    });
  }
});

// --- GET /templates Endpoint ---
fastify.get('/templates', async (request, reply) => {
  try {
    const templatesDir = path.resolve(__dirname, '../templates');
    const files = await fs.readdir(templatesDir);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    const templates = await Promise.all(
      jsonFiles.map(async (fileName) => {
        const filePath = path.join(templatesDir, fileName);
        const fileContent = await fs.readFile(filePath, 'utf-8');

        try {
          const content = JSON.parse(fileContent);

          return { name: fileName, content };
        } catch (parseError) {
          fastify.log.error(`Error parsing JSON file ${fileName}: ${String(parseError)}`);

          return { name: fileName, content: null, error: 'Invalid JSON' };
        }
      })
    );
    const validTemplates = templates.filter((t) => t.content !== null);
    reply.send(validTemplates);
  } catch (error) {
    fastify.log.error(`Error reading templates directory: ${String(error)}`);
    reply.status(500).send({ error: 'Failed to load templates' });
  }
});

// --- POST /compile Endpoint ---
fastify.post('/compile', async (request, reply) => {
  fastify.log.info('Compile endpoint hit - beginning request processing');

  const requestUid = Date.now().toString();
  fastify.log.info(`Generated unique ID for this request: ${requestUid}`);

  const dirs = buildCompileDirs(requestUid);
  let compilationSuccessful = false;
  let outputPath: string | null = null;

  try {
    const result = await handleCompileRequest(request, dirs, fastify.log);

    if (!result.success) {
      reply.status(result.statusCode ?? 500).send({ error: result.errorMessage });

      return;
    }

    compilationSuccessful = true;
    outputPath = result.outputPath;
    reply.send({ success: true, outputPath: result.outputPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fastify.log.error(`Compilation error: ${message}`);
    reply.status(500).send({ error: 'Compilation failed', details: message });
  } finally {
    if (compilationSuccessful && outputPath !== null) {
      copyOutputToPersistentLocation(outputPath, dirs.buildDir, fastify.log);
    }

    cleanupTempDir(dirs.buildDir, requestUid, fastify.log);
  }
});

// --- Start Server ---
const start = async () => {
  try {
    // Listen on 0.0.0.0 to accept connections from network devices/emulators
    await fastify.listen({ port: 8082, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port 8082, accessible on all network interfaces`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start().catch((error: unknown) => {
  fastify.log.error(error);
  process.exit(1);
});
