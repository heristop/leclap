import AsyncStorage from '@react-native-async-storage/async-storage';
import { reconcileStuckCompilations, getCompilationQueue, type CompilationQueueItem } from './storage';

// The app's type program uses vitest globals (declarations.d.ts), but this colocated test executes
// under jest (ts-jest, transpile-only), so the jest runtime value is typed locally — same pattern
// as CoreCompilationService.test.ts.
type MockFn = ((...args: never[]) => unknown) & {
  mock: { calls: unknown[][] };
};

declare const jest: {
  mock(moduleName: string, factory: () => unknown): void;
  fn<T extends (...args: never[]) => unknown>(impl?: T): MockFn;
  clearAllMocks(): void;
};

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;

      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];

      return Promise.resolve();
    }),
    __reset: () => {
      store = {};
    },
  };
});

const COMPILATION_QUEUE_KEY = 'le_clap_compilation_queue';

const seedQueue = async (items: CompilationQueueItem[]): Promise<void> => {
  await AsyncStorage.setItem(COMPILATION_QUEUE_KEY, JSON.stringify(items));
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
    (AsyncStorage as unknown as { __reset: () => void }).__reset();
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
