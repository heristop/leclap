import { EventEmitter } from 'node:events';
import { singleton } from 'tsyringe';
import AbstractEventManager, { type IEventEmitter } from './AbstractEventManager';

@singleton()
export default class EventManager extends AbstractEventManager {
  private emitter: EventEmitter | null = null;

  public connect(): IEventEmitter {
    this.emitter = new EventEmitter();

    return this.emitter;
  }
}
