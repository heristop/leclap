import type AbstractLogger from './AbstractLogger';
import type { CompileReporter, LogParams } from '@/core/types';

type OnLog = NonNullable<CompileReporter['onLog']>;

// Wraps a base logger and additionally forwards every call to an `onLog` sink, tagged with its level.
// The sink fires regardless of the base logger's own level filtering (e.g. a Pino adapter set to
// `silent` writes nothing to stdout, yet the host still receives the line) so a CLI can paint a live
// tail and persist a full log file while the terminal stdout stays clean for the progress region.
class TeeLogAdapter implements AbstractLogger {
  constructor(
    private readonly base: AbstractLogger,
    private readonly onLog: OnLog
  ) {}

  debug(message: string, params?: LogParams): void {
    this.base.debug(message, params);
    this.onLog({ level: 'debug', message });
  }

  info(message: string, params?: LogParams): void {
    this.base.info(message, params);
    this.onLog({ level: 'info', message });
  }

  warn(message: string, params?: LogParams): void {
    this.base.warn(message, params);
    this.onLog({ level: 'warn', message });
  }

  error(message: string, params?: LogParams): void {
    this.base.error(message, params);
    this.onLog({ level: 'error', message });
  }
}

export default TeeLogAdapter;
