import { singleton } from 'tsyringe';
import AbstractEventManager, { type IEventEmitter } from './AbstractEventManager';

type EventCallback = (...args: unknown[]) => void;

class NodeEventEmitter extends EventTarget implements IEventEmitter {
  private readonly callbacks: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback): this {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    (this.callbacks.get(event) as EventCallback[]).push(callback);

    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const listeners = this.callbacks.get(event);

    if (!listeners) return false;

    for (const listener of listeners) {
      listener(...args);
    }

    return true;
  }

  off(event: string, callback: EventCallback): this {
    const listeners = this.callbacks.get(event);

    if (!listeners) return this;

    const index = listeners.indexOf(callback);

    if (index > -1) {
      listeners.splice(index, 1);
    }

    return this;
  }

  removeAllListeners(event?: string): this {
    if (!event) {
      this.callbacks.clear();

      return this;
    }

    this.callbacks.delete(event);

    return this;
  }
}

@singleton()
export default class EventManager extends AbstractEventManager {
  private emitter: NodeEventEmitter | null = null;

  public connect(): IEventEmitter {
    this.emitter = new NodeEventEmitter();

    return this.emitter;
  }
}
