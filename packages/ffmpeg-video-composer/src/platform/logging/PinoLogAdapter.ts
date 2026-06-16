import pino from 'pino';
import { injectable } from 'tsyringe';
import type AbstractLogger from './AbstractLogger';
import type { LogParams } from '@/core/types';

// Resolve the pino level from the environment so a consumer (e.g. the `leclap` CLI) can quiet the
// engine — `LECLAP_LOG_LEVEL=silent`. Defaults to `info`, preserving existing library behavior.
export function resolveLogLevel(env: Record<string, string | undefined> = process.env): string {
  const level = env.LECLAP_LOG_LEVEL;

  if (level) return level;

  return 'info';
}

@injectable()
class PinoLogAdapter implements AbstractLogger {
  private readonly logger = pino({ level: resolveLogLevel() });

  debug(message: string, params?: LogParams): void {
    this.logger.debug({ ...params }, message);
  }

  info(message: string, params?: LogParams): void {
    this.logger.info({ ...params }, message);
  }

  warn(message: string, params?: LogParams): void {
    this.logger.warn({ ...params }, message);
  }

  error(message: string, params?: LogParams): void {
    this.logger.error({ ...params }, message);
  }
}

export default PinoLogAdapter;
