import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import type { Template, Project } from '@/src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables
const API_URL = Constants.expoConfig?.extra?.API_URL ?? 'http://localhost:3000';

// Storage keys
const PROJECTS_STORAGE_KEY = 'ffmpeg_video_composer_projects';

/**
 * Resolves an error message from a caught error value
 */
const resolveErrorMessage = (error: unknown, defaultMessage: string): string => {
  const err = error instanceof Error ? error : new Error(String(error));

  return err.message || defaultMessage;
};

/**
 * Maps common network/server error messages to user-friendly text, falling back to the
 * original message or `defaultMessage`. Shared by the template-fetch and compile flows.
 */
const resolveNetworkErrorMessage = (err: Error, defaultMessage: string): string => {
  if (err.message.includes('Network request failed')) {
    return 'Network connection failed. Please check your internet connection and ensure the server is running.';
  }

  if (err.message.includes('timeout')) {
    return 'Request timeout. The server may be overloaded. Please try again.';
  }

  if (err.message.includes('Server is unreachable')) {
    return err.message;
  }

  return err.message || defaultMessage;
};

/**
 * Fetches all available templates from the server
 */
export const fetchTemplates = async (): Promise<Template[]> => {
  try {
    // First check if server is healthy
    const healthCheck = await checkServerHealth();

    if (!healthCheck.isHealthy) {
      throw new Error(healthCheck.error ?? 'Server is not available');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() =>{  controller.abort(); }, 10000); // 10 second timeout

    const response = await fetch(`${API_URL}/templates`, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (err.name === 'AbortError') {
      throw new Error('Request timeout - server took too long to respond (10s). Please try again.');
    }

    const errorMessage = resolveNetworkErrorMessage(err, 'Failed to fetch templates');

    console.error('Error fetching templates:', error);

    throw new Error(errorMessage);
  }
};

/**
 * Fetches a specific template by name
 */
export const fetchTemplateByName = async (templateName: string): Promise<Template> => {
  try {
    // First check if server is healthy
    const healthCheck = await checkServerHealth();

    if (!healthCheck.isHealthy) {
      throw new Error(healthCheck.error ?? 'Server is not available');
    }

    const templates = await fetchTemplates();
    const template = templates.find((t) => t.name === templateName);

    if (!template) {
      throw new Error(`Template with name ${templateName} not found`);
    }

    return template;
  } catch (error) {
    console.error(`Error fetching template ${templateName}:`, error);

    throw error;
  }
};

/**
 * Saves a project to local storage
 */
export const saveProject = async (project: Project): Promise<void> => {
  try {
    // Get existing projects
    const projectsJson = await AsyncStorage.getItem(PROJECTS_STORAGE_KEY);
    const projects: Project[] = projectsJson ? JSON.parse(projectsJson) : [];

    // Update or add the project
    const existingIndex = projects.findIndex((p) => p.id === project.id);

    if (existingIndex !== -1) {
      projects[existingIndex] = project;
    }

    if (existingIndex === -1) {
      projects.push(project);
    }

    // Save back to storage
    await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    console.error('Error saving project:', error);

    throw error;
  }
};

/**
 * Gets all projects from local storage
 */
export const getProjects = async (): Promise<Project[]> => {
  try {
    const projectsJson = await AsyncStorage.getItem(PROJECTS_STORAGE_KEY);

    return projectsJson ? JSON.parse(projectsJson) : [];
  } catch (error) {
    console.error('Error getting projects:', error);

    throw error;
  }
};

/**
 * Gets a project by ID from local storage
 */
export const getProjectById = async (projectId: string): Promise<Project | null> => {
  try {
    const projects = await getProjects();

    return projects.find((p) => p.id === projectId) ?? null;
  } catch (error) {
    console.error(`Error getting project ${projectId}:`, error);

    throw error;
  }
};

/**
 * Deletes a project from local storage
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    const projects = await getProjects();
    const updatedProjects = projects.filter((p) => p.id !== projectId);
    await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedProjects));
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);

    throw error;
  }
};

/**
 * Deletes all projects from local storage
 */
export const deleteAllProjects = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([]));
  } catch (error) {
    console.error('Error deleting all projects:', error);

    throw error;
  }
};

/**
 * Checks if the server is reachable
 */
export const checkServerHealth = async (): Promise<{ isHealthy: boolean; error?: string }> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() =>{  controller.abort(); }, 5000); // 5 second timeout

    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { isHealthy: true };
    }

    return { isHealthy: false, error: `Server responded with status: ${response.status}` };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (err.name === 'AbortError') {
      return { isHealthy: false, error: 'Server connection timeout (5s)' };
    }

    return {
      isHealthy: false,
      error: err.message.includes('Network request failed')
        ? 'Server is unreachable. Please check if the ffmpeg-video-composer server is running.'
        : `Server health check failed: ${err.message}`,
    };
  }
};

/**
 * Executes a single retry attempt with delay
 */
const executeRetryAttempt = async <T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelay: number,
  attempt: number
): Promise<T> => {
  const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

  console.warn(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);

  await new Promise<void>((resolve) => setTimeout(resolve, delay));

  return retryWithBackoff(fn, maxRetries, baseDelay, attempt + 1);
};

/**
 * Retries a function with exponential backoff (recursive to avoid await-in-loop)
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  attempt = 0
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Don't retry on certain types of errors
    if (err.message.includes('404') || err.message.includes('400')) {
      throw err;
    }

    if (attempt >= maxRetries) {
      throw err;
    }

    return executeRetryAttempt(fn, maxRetries, baseDelay, attempt);
  }
};

/**
 * Performs the actual compile fetch request
 */
const performCompileFetch = async (formData: FormData): Promise<{ success: boolean; outputPath?: string; message?: string; error?: string }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() =>{  controller.abort(); }, 30000); // 30 second timeout for compilation

  try {
    const response = await fetch(`${API_URL}/compile`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? `HTTP error! status: ${response.status}`);
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    const err = error instanceof Error ? error : new Error(String(error));

    if (err.name === 'AbortError') {
      throw new Error('Request timeout - compilation took too long (30s). Please try again.');
    }

    throw err;
  }
};

/**
 * Builds the output URI from a server output path
 */
const buildOutputUri = (outputPath: string): string => {
  const pathParts = outputPath.split(/[\\/]/); // Split by / or \\
  const filename = pathParts.pop(); // Get last part

  return `${API_URL}/serve/${filename}`;
};

/**
 * Recorded clips passed to compilation, keyed by section name. `trim`/`crop` are the
 * user-selected edits applied server-side before compilation (crop is normalized 0..1).
 */
export type CompileRecordedVideos = Record<
  string,
  {
    path: string;
    orientation: 'portrait' | 'landscape';
    trim?: { start: number; end: number };
    crop?: { x: number; y: number; w: number; h: number };
  }
>;

type CompileResult = { success: boolean; outputUri?: string; error?: string };

/**
 * Builds the per-section trim/crop edits the user selected on the preview screen.
 * The server applies these with ffmpeg before compiling.
 */
const buildVideoEdits = (
  sectionName: string,
  videoData: CompileRecordedVideos[string]
): Record<string, { trimStart?: number; trimEnd?: number; crop?: typeof videoData.crop }> => {
  if (!videoData.trim && !videoData.crop) {
    return {};
  }

  return {
    [sectionName]: { trimStart: videoData.trim?.start, trimEnd: videoData.trim?.end, crop: videoData.crop },
  };
};

/**
 * Uploads a single recorded clip via expo-file-system's native `uploadAsync`.
 *
 * React Native 0.85's new-architecture networking rejects `{ uri, name, type }`
 * FormData file parts ("Unsupported FormDataPart implementation"), so recorded videos
 * are uploaded with `uploadAsync` instead. The server maps each upload to a section by
 * its filename (`<section>-<timestamp>.<ext>`), so the recording is copied to that name
 * before being sent.
 */
const uploadRecordedVideo = async (
  templateDescriptor: unknown,
  sectionName: string,
  videoData: CompileRecordedVideos[string]
): Promise<CompileResult> => {
  const srcUri = videoData.path.startsWith('file://') ? videoData.path : `file://${videoData.path}`;
  const namedUri = `${FileSystem.cacheDirectory ?? ''}${sectionName}-${Date.now()}.mp4`;
  await FileSystem.copyAsync({ from: srcUri, to: namedUri });

  const videoEdits = buildVideoEdits(sectionName, videoData);
  const upload = await FileSystem.uploadAsync(`${API_URL}/compile`, namedUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'video/mp4',
    parameters: { template: JSON.stringify(templateDescriptor), videoEdits: JSON.stringify(videoEdits) },
  });
  const uploadResult = JSON.parse(upload.body || '{}') as { outputPath?: string; error?: string; message?: string };

  if (upload.status >= 200 && upload.status < 300 && uploadResult.outputPath) {
    return { success: true, outputUri: buildOutputUri(uploadResult.outputPath) };
  }

  throw new Error(uploadResult.error ?? uploadResult.message ?? `Compilation failed (HTTP ${upload.status}).`);
};

/**
 * Compiles a template that has no recorded videos: a string-only multipart works fine
 * over the standard fetch path.
 */
const compileWithoutVideos = async (templateDescriptor: unknown): Promise<CompileResult> => {
  const formData = new FormData();
  formData.append('template', JSON.stringify(templateDescriptor));

  const result = await retryWithBackoff(() => performCompileFetch(formData), 2);

  if (result.success && result.outputPath) {
    return { success: true, outputUri: buildOutputUri(result.outputPath) };
  }

  throw new Error(result.message ?? 'Compilation failed on server.');
};

/**
 * Sends videos and template to server for compilation
 */
export const compileVideo = async (
  templateDescriptor: unknown,
  recordedVideos: CompileRecordedVideos
): Promise<CompileResult> => {
  try {
    // First check if server is healthy
    const healthCheck = await checkServerHealth();

    if (!healthCheck.isHealthy) {
      return { success: false, error: healthCheck.error ?? 'Server is not available' };
    }

    const videoEntries = Object.entries(recordedVideos);

    if (videoEntries.length > 1) {
      // uploadAsync sends one file per request; multi-clip templates need a different path.
      throw new Error('Templates with multiple recorded videos are not supported yet.');
    }

    if (videoEntries.length === 1) {
      const [sectionName, videoData] = videoEntries[0];

      return await uploadRecordedVideo(templateDescriptor, sectionName, videoData);
    }

    return await compileWithoutVideos(templateDescriptor);
  } catch (error) {
    console.error('Error compiling video:', error);

    const err = error instanceof Error ? error : new Error(resolveErrorMessage(error, 'An unknown error occurred'));
    const errorMessage = resolveNetworkErrorMessage(err, 'An unknown error occurred');

    return { success: false, error: errorMessage };
  }
};

const ApiServices = {
  name: 'ApiServices',
};
export default ApiServices;
