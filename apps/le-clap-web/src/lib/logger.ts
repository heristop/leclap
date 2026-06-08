/// <reference types="vite/client" />
import { createConsola } from 'consola';

// Create base logger instance
const baseLogger = createConsola({
  level: import.meta.env.DEV ? 4 : 3, // Debug in dev, Info in prod
  formatOptions: {
    date: import.meta.env.DEV,
    colors: true,
  },
});

// Export tagged loggers for different modules
export const compilationLogger = baseLogger.withTag('CoreCompilation');
export const templateLogger = baseLogger.withTag('Template');
export const ffmpegLogger = baseLogger.withTag('FFmpeg');

// Export default logger for general use
export const logger = baseLogger;
