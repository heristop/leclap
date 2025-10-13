import 'reflect-metadata';
import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { compile as coreCompile } from 'ffmpeg-video-composer';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define interfaces for stronger typing
interface VideoFile {
  path: string;
  section: string;
  dir?: string; // Optional: Only for temporary files
  tempDir?: string; // Directory for temporary request-specific files
  permanent?: boolean; // Flag to indicate if file should be kept
}

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
    fastify.log.error(`Health check failed: ${error.message}`);
    reply.status(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
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
          fastify.log.error(`Error parsing JSON file ${fileName}: ${parseError}`);
          return { name: fileName, content: null, error: 'Invalid JSON' };
        }
      })
    );
    const validTemplates = templates.filter((t) => t.content !== null);
    reply.send(validTemplates);
  } catch (error) {
    fastify.log.error(`Error reading templates directory: ${error}`);
    reply.status(500).send({ error: 'Failed to load templates' });
  }
});

// --- POST /compile Endpoint ---
fastify.post('/compile', async (request, reply) => {
  fastify.log.info('Compile endpoint hit - beginning request processing');

  // Generate a unique ID for this request
  const requestUid = Date.now().toString();
  fastify.log.info(`Generated unique ID for this request: ${requestUid}`);

  let videoFiles: VideoFile[] = [];
  let tempVideoPaths: Record<string, string> = {}; // Map of section names to video paths
  let compilationSuccessful = false;
  let outputPath = null;

  try {
    // Process all parts (files and fields)
    fastify.log.info('Starting to process multipart data');
    const parts = request.parts();
    let templateJson = null;

    // Debug counter for incoming parts
    let partCount = 0;
    let fileCount = 0;
    let fieldCount = 0;

    for await (const part of parts) {
      partCount++;

      // Handle template field
      if (part.type === 'field' && part.fieldname === 'template') {
        fieldCount++;
        try {
          const valueString = String(part.value);
          templateJson = JSON.parse(valueString);
          fastify.log.info('Received template JSON');
        } catch (e) {
          fastify.log.error(`Error parsing template JSON: ${e.message}`);
          return reply.status(400).send({ error: 'Invalid template JSON format' });
        }
      }
      // Handle video files
      else if (part.type === 'file') {
        fileCount++;
        // Extract section name from filename (format: sectionName-timestamp.ext)
        const filenameMatch = part.filename.match(/^([^-]+)-\d+\.(\w+)$/);
        const sectionName = filenameMatch ? filenameMatch[1] : 'unknown_section';

        fastify.log.info(`Received video file #${fileCount} for section ${sectionName}: ${part.filename}`);

        try {
          // Create directory structure synchronously
          const serverBuildDir = path.resolve(__dirname, '../build');

          // Create tmp directory
          const tmpDir = path.join(serverBuildDir, 'tmp');
          if (!fsSync.existsSync(tmpDir)) {
            fsSync.mkdirSync(tmpDir, { recursive: true });
          }

          // Create request-specific directory with UUID
          const requestTempDir = path.join(tmpDir, requestUid);
          if (!fsSync.existsSync(requestTempDir)) {
            fsSync.mkdirSync(requestTempDir, { recursive: true });
          }

          // Create videos subdirectory
          const videosDir = path.join(requestTempDir, 'videos');
          if (!fsSync.existsSync(videosDir)) {
            fsSync.mkdirSync(videosDir, { recursive: true });
          }

          // Define simplified filename with original extension
          const fileExtension = filenameMatch ? filenameMatch[2] : 'mov';
          const simplifiedFileName = `${sectionName}.${fileExtension}`;
          const videoPath = path.join(videosDir, simplifiedFileName);

          // Get the file buffer and write it
          const fileBuffer = await part.toBuffer();
          fsSync.writeFileSync(videoPath, fileBuffer);

          // Store the file path with its section name
          tempVideoPaths[sectionName] = videoPath;
          videoFiles.push({
            path: videoPath,
            section: sectionName,
            tempDir: requestTempDir,
          });

          fastify.log.info(`Saved video for section ${sectionName} to ${videoPath}`);
        } catch (error) {
          fastify.log.error(`Error processing file for section ${sectionName}: ${error.message}`);
          throw new Error(`Failed to process file for section ${sectionName}: ${error.message}`);
        }
      }
    }

    // Summary of processed parts
    fastify.log.info(
      `Multipart processing complete: ${partCount} total parts, ${fieldCount} fields, ${fileCount} files`
    );

    // Verify that we received a template
    if (!templateJson) {
      return reply.status(400).send({ error: 'Template JSON missing in request' });
    }

    // If no videos were uploaded, return an error
    if (videoFiles.length === 0) {
      return reply.status(400).send({ error: 'No video files uploaded' });
    }

    // --- Prepare Project Configuration ---
    // Set up paths
    const serverBuildDir = path.resolve(__dirname, '../build');
    const tmpDir = path.join(serverBuildDir, 'tmp');
    const requestTempDir = path.join(tmpDir, requestUid);
    const videosDir = path.join(requestTempDir, 'videos');

    // Ensure directories exist
    if (!fsSync.existsSync(tmpDir)) {
      fsSync.mkdirSync(tmpDir, { recursive: true });
    }

    if (!fsSync.existsSync(requestTempDir)) {
      fsSync.mkdirSync(requestTempDir, { recursive: true });
    }

    if (!fsSync.existsSync(videosDir)) {
      fsSync.mkdirSync(videosDir, { recursive: true });
    }

    const projectConfig = {
      buildDir: serverBuildDir,
      assetsDir: requestTempDir,
      userVideoPaths: tempVideoPaths,
    };

    fastify.log.info(
      'Project configuration prepared with videos for sections: ' + Object.keys(tempVideoPaths).join(', ')
    );

    // --- Call Core Compilation Function ---
    fastify.log.info('Starting compilation process...');
    const success = await coreCompile(projectConfig, templateJson);

    // Handle compilation result
    if (success) {
      fastify.log.info(`Compilation successful. Output: ${success}`);
      compilationSuccessful = true;
      outputPath = success;

      // Send the response with the output path
      reply.send({ success: true, outputPath: success });
    } else {
      fastify.log.error('Compilation failed.');
      reply.status(500).send({ error: 'Compilation failed internally' });
    }
  } catch (error) {
    fastify.log.error(`Compilation error: ${error.message || error}`);
    reply.status(500).send({ error: 'Compilation failed', details: error.message || error });
  } finally {
    // Copy the output file to a persistent location if compilation was successful
    if (compilationSuccessful && outputPath) {
      try {
        const fileName = path.basename(outputPath);
        const persistentPath = path.join(serverBuildDir, fileName);

        // Only copy if the output isn't already in the build directory
        if (outputPath !== persistentPath) {
          fastify.log.info(`Copying output file from ${outputPath} to ${persistentPath}`);
          fsSync.copyFileSync(outputPath, persistentPath);
        }
      } catch (copyError) {
        fastify.log.error(`Error copying output file: ${copyError.message}`);
      }
    }

    // Clean up temporary directory
    try {
      const tmpDir = path.join(serverBuildDir, 'tmp');
      const tempDir = path.join(tmpDir, requestUid);

      if (fsSync.existsSync(tempDir)) {
        fastify.log.info(`Removing temporary directory: ${tempDir}`);
        fsSync.rmSync(tempDir, { recursive: true, force: true });
        fastify.log.info('Temporary directory removed successfully');
      }
    } catch (cleanupError) {
      fastify.log.error(`Error cleaning up temporary directory: ${cleanupError.message}`);
    }
  }
});

// --- Start Server ---
const start = async () => {
  try {
    // Listen on 0.0.0.0 to accept connections from network devices/emulators
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info(`Server listening on port 3000, accessible on all network interfaces`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
