import Constants from 'expo-constants';
import { Template, Project } from '../types';
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
    const response = await fetch(`${API_URL}/templates`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
};

/**
 * Fetches a specific template by name
 */
export const fetchTemplateByName = async (templateName: string): Promise<Template> => {
  try {
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
 * Sends videos and template to server for compilation
 */
export const compileVideo = async (
  templateDescriptor: any,
  recordedVideos: Record<string, { path: string; orientation: 'portrait' | 'landscape' }>
): Promise<{ success: boolean; outputUri?: string; error?: string }> => {
  try {
    const formData = new FormData();

    // Add template descriptor
    formData.append('template', JSON.stringify(templateDescriptor));

    // Add video files
    Object.entries(recordedVideos).forEach(([sectionName, videoData]) => {
      const filename = `${sectionName}-${Date.now()}.mp4`;
      const videoUri = videoData.path.startsWith('file://') ? videoData.path : `file://${videoData.path}`;

      formData.append('file', {
        uri: videoUri,
        name: filename,
        type: 'video/mp4',
      } as any);
    });

    // Send request to server
    const response = await fetch(`${API_URL}/compile`, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }

    if (result.success && result.outputPath) {
      // Construct the playable URL using the server's static path
      const pathParts = result.outputPath.split(/[\\\/]/); // Split by / or \\
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
    return {
      success: false,
      error: (error as Error).message || 'An unknown error occurred',
    };
  }
};

const ApiServices = {
  name: 'ApiServices',
};
export default ApiServices;
