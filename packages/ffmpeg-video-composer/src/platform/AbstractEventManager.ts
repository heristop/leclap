export interface IEventEmitter {
  on(event: string, callback: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
  off?(event: string, callback: (...args: unknown[]) => void): this;
  removeAllListeners?(event?: string): this;
}

export default abstract class AbstractEventManager {
  abstract connect(): IEventEmitter;
}
