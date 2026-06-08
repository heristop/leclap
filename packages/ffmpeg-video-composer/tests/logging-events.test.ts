import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock pino so PinoLogAdapter wraps our spies instead of the real logger ---
const { pinoLogger, pinoFactory } = vi.hoisted(() => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return { pinoLogger: logger, pinoFactory: vi.fn(() => logger) };
});

vi.mock('pino', () => ({
  default: pinoFactory,
}));

import PinoLogAdapter from '@/platform/logging/PinoLogAdapter';
import AbstractLogger from '@/platform/logging/AbstractLogger';
import EventManager from '@/platform/EventManager';
import BrowserEventManager from '@/platform/BrowserEventManager';

describe('PinoLogAdapter', () => {
  let adapter: PinoLogAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PinoLogAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards debug() to pino with params first, message second', () => {
    adapter.debug('dbg', { a: 1 });
    expect(pinoLogger.debug).toHaveBeenCalledWith({ a: 1 }, 'dbg');
  });

  it('forwards info() to pino', () => {
    adapter.info('inf', { b: 2 });
    expect(pinoLogger.info).toHaveBeenCalledWith({ b: 2 }, 'inf');
  });

  it('forwards warn() to pino', () => {
    adapter.warn('wrn', { c: 3 });
    expect(pinoLogger.warn).toHaveBeenCalledWith({ c: 3 }, 'wrn');
  });

  it('forwards error() to pino', () => {
    adapter.error('err', { d: 4 });
    expect(pinoLogger.error).toHaveBeenCalledWith({ d: 4 }, 'err');
  });

  it('spreads an empty object when params are omitted', () => {
    adapter.info('no-params');
    expect(pinoLogger.info).toHaveBeenCalledWith({}, 'no-params');
  });
});

describe('AbstractLogger contract', () => {
  it('can be implemented by a concrete subclass', () => {
    const calls: string[] = [];
    class TestLogger extends AbstractLogger {
      debug(message: string) {
        calls.push(`debug:${message}`);
      }
      info(message: string) {
        calls.push(`info:${message}`);
      }
      warn(message: string) {
        calls.push(`warn:${message}`);
      }
      error(message: string) {
        calls.push(`error:${message}`);
      }
    }

    const logger: AbstractLogger = new TestLogger();
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(calls).toEqual(['debug:a', 'info:b', 'warn:c', 'error:d']);
  });
});

/**
 * Shared behavior contract for both EventManager (Node) and BrowserEventManager.
 * Each exposes connect() which returns an IEventEmitter with on/emit/off/removeAllListeners.
 */
function runEmitterContract(name: string, makeManager: () => { connect: () => unknown }) {
  describe(`${name}.connect() emitter`, () => {
    it('emit() returns false when there are no listeners for the event', () => {
      const emitter = makeManager().connect() as {
        emit: (e: string, ...a: unknown[]) => boolean;
      };
      expect(emitter.emit('nothing')).toBe(false);
    });

    it('on() registers a listener that emit() invokes with args', () => {
      const emitter = makeManager().connect() as {
        on: (e: string, cb: (...a: unknown[]) => void) => unknown;
        emit: (e: string, ...a: unknown[]) => boolean;
      };
      const cb = vi.fn();
      emitter.on('progress', cb);
      expect(emitter.emit('progress', 42, 'x')).toBe(true);
      expect(cb).toHaveBeenCalledWith(42, 'x');
    });

    it('on() supports multiple listeners on the same event', () => {
      const emitter = makeManager().connect() as {
        on: (e: string, cb: (...a: unknown[]) => void) => unknown;
        emit: (e: string, ...a: unknown[]) => boolean;
      };
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      emitter.on('e', cb1);
      emitter.on('e', cb2);
      emitter.emit('e');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('on() returns the emitter for chaining', () => {
      const emitter = makeManager().connect() as {
        on: (e: string, cb: (...a: unknown[]) => void) => unknown;
      };
      const cb = vi.fn();
      expect(emitter.on('e', cb)).toBe(emitter);
    });

    it('off() removes a previously registered listener', () => {
      const emitter = makeManager().connect() as {
        on: (e: string, cb: (...a: unknown[]) => void) => unknown;
        off: (e: string, cb: (...a: unknown[]) => void) => unknown;
        emit: (e: string, ...a: unknown[]) => boolean;
      };
      const cb = vi.fn();
      emitter.on('e', cb);
      emitter.off('e', cb);
      emitter.emit('e');
      expect(cb).not.toHaveBeenCalled();
    });

    it('off() on an unknown event is a no-op and returns the emitter', () => {
      const emitter = makeManager().connect() as {
        off: (e: string, cb: (...a: unknown[]) => void) => unknown;
      };
      const cb = vi.fn();
      expect(emitter.off('never-registered', cb)).toBe(emitter);
    });

    it('off() with a callback that was never added leaves listeners intact', () => {
      const emitter = makeManager().connect() as {
        on: (e: string, cb: (...a: unknown[]) => void) => unknown;
        off: (e: string, cb: (...a: unknown[]) => void) => unknown;
        emit: (e: string, ...a: unknown[]) => boolean;
      };
      const registered = vi.fn();
      const stranger = vi.fn();
      emitter.on('e', registered);
      emitter.off('e', stranger); // index === -1 branch
      emitter.emit('e');
      expect(registered).toHaveBeenCalledTimes(1);
    });

    it('removeAllListeners(event) clears only that event', () => {
      const emitter = makeManager().connect() as {
        on: (e: string, cb: (...a: unknown[]) => void) => unknown;
        removeAllListeners: (e?: string) => unknown;
        emit: (e: string, ...a: unknown[]) => boolean;
      };
      const a = vi.fn();
      const b = vi.fn();
      emitter.on('a', a);
      emitter.on('b', b);
      emitter.removeAllListeners('a');
      emitter.emit('a');
      emitter.emit('b');
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('removeAllListeners() with no arg clears every event', () => {
      const emitter = makeManager().connect() as {
        on: (e: string, cb: (...a: unknown[]) => void) => unknown;
        removeAllListeners: (e?: string) => unknown;
        emit: (e: string, ...a: unknown[]) => boolean;
      };
      const a = vi.fn();
      const b = vi.fn();
      emitter.on('a', a);
      emitter.on('b', b);
      emitter.removeAllListeners();
      expect(emitter.emit('a')).toBe(false);
      expect(emitter.emit('b')).toBe(false);
    });

    it('removeAllListeners returns the emitter for chaining (both branches)', () => {
      const emitter = makeManager().connect() as {
        removeAllListeners: (e?: string) => unknown;
      };
      expect(emitter.removeAllListeners('x')).toBe(emitter);
      expect(emitter.removeAllListeners()).toBe(emitter);
    });
  });
}

runEmitterContract('EventManager', () => new EventManager());
runEmitterContract('BrowserEventManager', () => new BrowserEventManager());

describe('EventManager specifics', () => {
  it('connect() returns a fresh emitter each call', () => {
    const manager = new EventManager();
    expect(manager.connect()).not.toBe(manager.connect());
  });
});

describe('BrowserEventManager specifics', () => {
  it('connect() memoizes and returns the same emitter', () => {
    const manager = new BrowserEventManager();
    expect(manager.connect()).toBe(manager.connect());
  });
});
