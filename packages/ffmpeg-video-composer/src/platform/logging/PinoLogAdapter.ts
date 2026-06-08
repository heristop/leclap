import pino from 'pino';
import { injectable } from 'tsyringe';
import type AbstractLogger from './AbstractLogger';
import type { LogParams } from '@/core/types';

@injectable()
class PinoLogAdapter implements AbstractLogger {
  private readonly logger = pino();

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
