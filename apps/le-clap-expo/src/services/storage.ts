import AsyncStorage from '@react-native-async-storage/async-storage';
import { Template } from '@/src/types';

// Storage keys
const TEMPLATES_CACHE_KEY = 'ffmpeg_video_composer_templates_cache';
const TEMPLATES_METADATA_KEY = 'ffmpeg_video_composer_templates_metadata';
const COMPILATION_QUEUE_KEY = 'ffmpeg_video_composer_compilation_queue';

export interface TemplatesCacheMetadata {
  lastUpdated: string;
  version: string;
}

export interface CompilationQueueItem {
  id: string;
  projectId: string;
  templateDescriptor: any;
  recordedVideos: Record<string, { path: string; orientation: 'portrait' | 'landscape' }>;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  createdAt: string;
  retryCount: number;
  lastRetryAt?: string;
  error?: string;
}

/**
 * Cache templates to AsyncStorage for offline access
 */
export const cacheTemplates = async (templates: Template[]): Promise<void> => {
  try {
    const metadata: TemplatesCacheMetadata = {
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
    };

    await Promise.all([
      AsyncStorage.setItem(TEMPLATES_CACHE_KEY, JSON.stringify(templates)),
      AsyncStorage.setItem(TEMPLATES_METADATA_KEY, JSON.stringify(metadata)),
    ]);
  } catch (error) {
    console.error('Error caching templates:', error);
    throw error;
  }
};

/**
 * Get cached templates from AsyncStorage
 */
export const getCachedTemplates = async (): Promise<Template[] | null> => {
  try {
    const cachedData = await AsyncStorage.getItem(TEMPLATES_CACHE_KEY);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    console.error('Error getting cached templates:', error);
    return null;
  }
};

/**
 * Get templates cache metadata
 */
export const getTemplatesCacheMetadata = async (): Promise<TemplatesCacheMetadata | null> => {
  try {
    const metadata = await AsyncStorage.getItem(TEMPLATES_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : null;
  } catch (error) {
    console.error('Error getting templates cache metadata:', error);
    return null;
  }
};

/**
 * Check if templates cache is stale (older than 24 hours)
 */
export const isTemplatesCacheStale = async (): Promise<boolean> => {
  try {
    const metadata = await getTemplatesCacheMetadata();
    if (!metadata) return true;

    const lastUpdated = new Date(metadata.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    return hoursDiff > 24; // Stale if older than 24 hours
  } catch (error) {
    console.error('Error checking cache staleness:', error);
    return true;
  }
};

/**
 * Add item to compilation queue
 */
export const addToCompilationQueue = async (
  item: Omit<CompilationQueueItem, 'id' | 'createdAt' | 'retryCount'>
): Promise<string> => {
  try {
    const queueItem: CompilationQueueItem = {
      ...item,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const existingQueue = await getCompilationQueue();
    const updatedQueue = [...existingQueue, queueItem];

    await AsyncStorage.setItem(COMPILATION_QUEUE_KEY, JSON.stringify(updatedQueue));
    return queueItem.id;
  } catch (error) {
    console.error('Error adding to compilation queue:', error);
    throw error;
  }
};

/**
 * Get compilation queue
 */
export const getCompilationQueue = async (): Promise<CompilationQueueItem[]> => {
  try {
    const queueData = await AsyncStorage.getItem(COMPILATION_QUEUE_KEY);
    return queueData ? JSON.parse(queueData) : [];
  } catch (error) {
    console.error('Error getting compilation queue:', error);
    return [];
  }
};

/**
 * Update compilation queue item
 */
export const updateCompilationQueueItem = async (
  itemId: string,
  updates: Partial<CompilationQueueItem>
): Promise<void> => {
  try {
    const queue = await getCompilationQueue();
    const itemIndex = queue.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      throw new Error(`Queue item with id ${itemId} not found`);
    }

    queue[itemIndex] = { ...queue[itemIndex], ...updates };
    await AsyncStorage.setItem(COMPILATION_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error updating compilation queue item:', error);
    throw error;
  }
};

/**
 * Remove item from compilation queue
 */
export const removeFromCompilationQueue = async (itemId: string): Promise<void> => {
  try {
    const queue = await getCompilationQueue();
    const updatedQueue = queue.filter((item) => item.id !== itemId);
    await AsyncStorage.setItem(COMPILATION_QUEUE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    console.error('Error removing from compilation queue:', error);
    throw error;
  }
};

/**
 * Get pending compilation queue items
 */
export const getPendingCompilations = async (): Promise<CompilationQueueItem[]> => {
  try {
    const queue = await getCompilationQueue();
    return queue.filter((item) => item.status === 'pending' || item.status === 'failed');
  } catch (error) {
    console.error('Error getting pending compilations:', error);
    return [];
  }
};

/**
 * Clear completed compilation queue items older than 7 days
 */
export const cleanupCompilationQueue = async (): Promise<void> => {
  try {
    const queue = await getCompilationQueue();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const filteredQueue = queue.filter((item) => {
      if (item.status === 'completed') {
        const createdAt = new Date(item.createdAt);
        return createdAt > sevenDaysAgo;
      }
      return true; // Keep non-completed items
    });

    await AsyncStorage.setItem(COMPILATION_QUEUE_KEY, JSON.stringify(filteredQueue));
  } catch (error) {
    console.error('Error cleaning up compilation queue:', error);
  }
};
