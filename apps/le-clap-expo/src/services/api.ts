import Constants from 'expo-constants';
import type { Template, Project } from '@/src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables
const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:3000';

// Storage keys
const PROJECTS_STORAGE_KEY = 'ffmpeg_video_composer_projects';

/**
 * Fetches all available templates from the server
 */
export const fetchTemplates = async (): Promise<Template[]> => {
  try {
    // First check if server is healthy
    const healthCheck = await checkServerHealth();
    if (!healthCheck.isHealthy) {
      throw new Error(healthCheck.error || 'Server is not available');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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
    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new Error('Request timeout - server took too long to respond (10s). Please try again.');
    }

    let errorMessage = 'Failed to fetch templates';

    if (err.message?.includes('Network request failed')) {
      errorMessage =
        'Network connection failed. Please check your internet connection and ensure the server is running.';
    } else if (err.message?.includes('timeout')) {
      errorMessage = 'Request timeout. The server may be overloaded. Please try again.';
    } else if (err.message?.includes('Server is unreachable')) {
      errorMessage = err.message;
    } else {
      errorMessage = err.message || errorMessage;
    }

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
      throw new Error(healthCheck.error || 'Server is not available');
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
    } else {
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
    return projects.find((p) => p.id === projectId) || null;
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
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

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
    } else {
      return { isHealthy: false, error: `Server responded with status: ${response.status}` };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { isHealthy: false, error: 'Server connection timeout (5s)' };
    }
    return {
      isHealthy: false,
      error: error.message?.includes('Network request failed')
        ? 'Server is unreachable. Please check if the ffmpeg-video-composer server is running.'
        : `Server health check failed: ${error.message}`,
    };
  }
};

/**
 * Retries a function with exponential backoff
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain types of errors
      if (lastError.message?.includes('404') || lastError.message?.includes('400')) {
        throw error;
      }

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
};

/**
 * Sends videos and template to server for compilation
 */
export const compileVideo = async (
  templateDescriptor: unknown,
  recordedVideos: Record<string, { path: string; orientation: 'portrait' | 'landscape' }>
): Promise<{ success: boolean; outputUri?: string; error?: string }> => {
  try {
    // First check if server is healthy
    const healthCheck = await checkServerHealth();
    if (!healthCheck.isHealthy) {
      return {
        success: false,
        error: healthCheck.error || 'Server is not available',
      };
    }

    const formData = new FormData();

    // Add template descriptor
    formData.append('template', JSON.stringify(templateDescriptor));

    // Add video files
    for (const [sectionName, videoData] of Object.entries(recordedVideos)) {
      const filename = `${sectionName}-${Date.now()}.mp4`;
      const videoUri = videoData.path.startsWith('file://') ? videoData.path : `file://${videoData.path}`;

      formData.append('file', {
        uri: videoUri,
        name: filename,
        type: 'video/mp4',
      } as unknown as Blob);
    }

    // Send request to server with retry logic
    const result = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for compilation

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
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }

        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - compilation took too long (30s). Please try again.');
        }
        throw error;
      }
    }, 2); // Retry up to 2 times

    if (result.success && result.outputPath) {
      // Construct the playable URL using the server's static path
      const pathParts = result.outputPath.split(/[\\/]/); // Split by / or \\
      const filename = pathParts.pop(); // Get last part
      const url = `${API_URL}/serve/${filename}`;

      return {
        success: true,
        outputUri: url,
      };
    } else {
      throw new Error(result.message || 'Compilation failed on server.');
    }
  } catch (error) {
    console.error('Error compiling video:', error);
    const err = error as Error;

    let errorMessage = 'An unknown error occurred';

    if (err.message?.includes('Network request failed')) {
      errorMessage =
        'Network connection failed. Please check your internet connection and ensure the server is running.';
    } else if (err.message?.includes('timeout')) {
      errorMessage = 'Request timeout. The server may be overloaded. Please try again.';
    } else if (err.message?.includes('Server is unreachable')) {
      errorMessage = err.message;
    } else {
      errorMessage = err.message || errorMessage;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

const ApiServices = {
  name: 'ApiServices',
};
export default ApiServices;
