import AsyncStorage from '@react-native-async-storage/async-storage';
import { Project } from '@/src/domain/entities/Project';
import { IProjectRepository } from '@/src/domain/repositories/IProjectRepository';

const PROJECTS_STORAGE_KEY = 'ffmpeg_video_composer_projects';

export class ProjectRepository implements IProjectRepository {
  private async getStoredProjects(): Promise<Project[]> {
    try {
      const stored = await AsyncStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!stored) return [];

      const projectsData = JSON.parse(stored);
      return projectsData.map((data: Record<string, unknown>) => Project.fromJSON(data));
    } catch (error) {
      console.error('Error loading projects from storage:', error);
      return [];
    }
  }

  private async storeProjects(projects: Project[]): Promise<void> {
    try {
      const projectsData = projects.map((project) => project.toJSON());
      await AsyncStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectsData));
    } catch (error) {
      console.error('Error storing projects:', error);
      throw error;
    }
  }

  async findAll(): Promise<Project[]> {
    return this.getStoredProjects();
  }

  async findById(id: string): Promise<Project | null> {
    const projects = await this.getStoredProjects();
    return projects.find((project) => project.id === id) || null;
  }

  async findByStatus(status: string): Promise<Project[]> {
    const projects = await this.getStoredProjects();
    return projects.filter((project) => project.status === status);
  }

  async save(project: Project): Promise<Project> {
    const projects = await this.getStoredProjects();
    const existingIndex = projects.findIndex((p) => p.id === project.id);

    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    await this.storeProjects(projects);
    return project;
  }

  async delete(id: string): Promise<void> {
    const projects = await this.getStoredProjects();
    const filteredProjects = projects.filter((project) => project.id !== id);
    await this.storeProjects(filteredProjects);
  }

  async deleteAll(): Promise<void> {
    await AsyncStorage.removeItem(PROJECTS_STORAGE_KEY);
  }
}
