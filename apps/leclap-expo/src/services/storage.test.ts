import { reconcileStuckCompilations, getCompilationQueue, type CompilationQueueItem } from './storage';
import { storage, appStorage } from './mmkv';

// The app's type program uses vitest globals (declarations.d.ts), but this colocated test executes
// under jest (ts-jest, transpile-only), so the jest runtime value is typed locally — same pattern
// as CoreCompilationService.test.ts.
declare const jest: {
  mock(moduleName: string, factory: () => unknown): void;
  clearAllMocks(): void;
};

// MMKV is a native module that can't load under ts-jest/node, so back it with an in-memory store —
// the same reason the previous AsyncStorage mock existed. `storage`/`appStorage` (from ./mmkv) run
// against this instance, so the queue helpers under test exercise the real persistence code path.
jest.mock('react-native-mmkv', () => {
  class MMKV {
    private store: Record<string, string> = {};

    getString(key: string): string | undefined {
      return this.store[key];
    }

    set(key: string, value: string): void {
      this.store[key] = value;
    }

    delete(key: string): void {
      delete this.store[key];
    }

    clearAll(): void {
      this.store = {};
    }
  }

  return { MMKV };
});

const COMPILATION_QUEUE_KEY = 'le_clap_compilation_queue';

const seedQueue = async (items: CompilationQueueItem[]): Promise<void> => {
  await appStorage.setItem(COMPILATION_QUEUE_KEY, JSON.stringify(items));
};

const makeItem = (overrides: Partial<CompilationQueueItem>): CompilationQueueItem => ({
  id: 'id-1',
  projectId: 'project-1',
  templateDescriptor: {},
  recordedVideos: {},
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  retryCount: 0,
  ...overrides,
});

describe('reconcileStuckCompilations', () => {
  beforeEach(() => {
    storage.clearAll();
    jest.clearAllMocks();
  });

  it('resets a stuck processing item with retries left back to pending', async () => {
    await seedQueue([makeItem({ id: 'stuck', status: 'processing', retryCount: 1 })]);

    const reset = await reconcileStuckCompilations(3);

    expect(reset).toEqual(['stuck']);

    const queue = await getCompilationQueue();
    expect(queue[0].status).toBe('pending');
  });

  it('marks a stuck processing item as failed when retries are exhausted', async () => {
    await seedQueue([makeItem({ id: 'exhausted', status: 'processing', retryCount: 3 })]);

    const reset = await reconcileStuckCompilations(3);

    expect(reset).toEqual(['exhausted']);

    const queue = await getCompilationQueue();
    expect(queue[0].status).toBe('failed');
    expect(queue[0].error).toBeTruthy();
  });

  it('leaves pending, failed and completed items untouched', async () => {
    await seedQueue([
      makeItem({ id: 'pending', status: 'pending' }),
      makeItem({ id: 'failed', status: 'failed', retryCount: 2 }),
      makeItem({ id: 'completed', status: 'completed' }),
    ]);

    const reset = await reconcileStuckCompilations(3);

    expect(reset).toEqual([]);

    const queue = await getCompilationQueue();
    expect(queue.map((item) => item.status)).toEqual(['pending', 'failed', 'completed']);
  });

  it('reconciles multiple stuck items in a single pass and returns their ids', async () => {
    await seedQueue([
      makeItem({ id: 'requeue', status: 'processing', retryCount: 0 }),
      makeItem({ id: 'giveup', status: 'processing', retryCount: 5 }),
      makeItem({ id: 'pending', status: 'pending' }),
    ]);

    const reset = await reconcileStuckCompilations(3);

    expect(reset).toEqual(['requeue', 'giveup']);

    const queue = await getCompilationQueue();
    const byId = Object.fromEntries(queue.map((item) => [item.id, item.status]));
    expect(byId).toEqual({ requeue: 'pending', giveup: 'failed', pending: 'pending' });
  });

  it('defaults maxRetries to 3 when no threshold is provided', async () => {
    await seedQueue([makeItem({ id: 'borderline', status: 'processing', retryCount: 3 })]);

    await reconcileStuckCompilations();

    const queue = await getCompilationQueue();
    expect(queue[0].status).toBe('failed');
  });
});
