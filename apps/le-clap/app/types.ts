// Type definitions for the application

export interface Template {
  name: string;
  content: TemplateDescriptor;
}

export interface TemplateDescriptor {
  global?: {
    variables?: Record<string, string | string[]>;
    orientation?: 'portrait' | 'landscape';
    colorsList?: string[];
    musicEnabled?: boolean;
    audioVolumeLevel?: number;
    transitionDuration?: number;
    music?: {
      name: string;
      url?: string;
    };
  };
  sections?: Section[];
}

export interface Section {
  name: string;
  type: string;
  options?: {
    upperCase?: boolean;
    lowerCase?: boolean;
    useVideoSection?: string;
    duration?: number;
    musicVolumeLevel?: number;
    fields?: Field[];
    speed?: number;
    muteSection?: boolean;
    videoUrl?: string;
    logoUrl?: string;
    backgroundUrl?: string;
    backgroundColor?: string;
    forceAspectRatio?: boolean;
    forceOriginalAspectRatio?: boolean;
  };
  inputs?: { name: string; url: string }[];
  maps?: any[]; // Maps for FFMPEG operations
  filters?: any[]; // Filters for FFMPEG operations
  title?: { [key: string]: string };
  description?: { [key: string]: string }; // Section description for UI display
}

export interface Field {
  name: string;
  maxLength: number;
  label: { [key: string]: string };
  description?: { [key: string]: string }; // Field description for UI display
}

export interface Project {
  id: string;
  name: string;
  templateName: string;
  templateContent: TemplateDescriptor;
  status: 'draft' | 'processing' | 'completed';
  formData: Record<string, string>;
  recordedVideos: Record<
    string,
    {
      path: string;
      orientation: 'portrait' | 'landscape';
    }
  >;
  outputVideoUri?: string;
  thumbnailUri?: string | null;
  createdAt: string;
  updatedAt: string;
}

const TypesExport = {
  name: 'Types',
};
export default TypesExport;
