import 'reflect-metadata';
import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCompileDirs, cleanupTempDir, copyOutputToPersistentLocation, handleCompileRequest } from './compile.js';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true,
});

fastify.register(fastifyCors, {
  origin: true,
  credentials: true,
});

fastify.register(fastifyMultipart, {
  limits: {
    fieldNameSize: 100,
    fieldSize: 1000000,
    fields: 10,
    fileSize: 100000000, // 100MB
    files: 10,
  },
});

const serverBuildDir = path.resolve(__dirname, '../build');
fastify.register(fastifyStatic, {
  root: serverBuildDir,
  prefix: '/serve/',
});
fastify.log.info(`Serving static files from ${serverBuildDir} under /serve/`);

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
        used: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      },
      pid: process.pid,
    };

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

fastify.post('/compile', async (request, reply) => {
  const requestUid = Date.now().toString();

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

const start = async () => {
  try {
    // 0.0.0.0 so network devices / emulators can reach this server
    await fastify.listen({ port: 8082, host: '0.0.0.0' });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
};

start().catch((error: unknown) => {
  fastify.log.error(error);
  process.exit(1);
});
