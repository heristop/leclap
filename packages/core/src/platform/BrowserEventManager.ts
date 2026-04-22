import { singleton } from 'tsyringe';
import AbstractEventManager, { type IEventEmitter } from './AbstractEventManager';

type EventCallback = (...args: unknown[]) => void;

class SimpleEventEmitter implements IEventEmitter {
  private events: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const callbacks = this.events.get(event);
    if (!callbacks) return false;

    for (const callback of callbacks) {
      callback(...args);
    }
    return true;
  }

  off(event: string, callback: EventCallback): this {
    const callbacks = this.events.get(event);
    if (!callbacks) return this;

    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }
}

@singleton()
export default class BrowserEventManager extends AbstractEventManager {
  private emitter: SimpleEventEmitter | null = null;

  public connect(): IEventEmitter {
    if (!this.emitter) {
      this.emitter = new SimpleEventEmitter();
    }
    return this.emitter;
  }
}
