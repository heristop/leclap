import ImageBackground from '../../editor/segments/ImageBackgroundSegment';
import ProjectVideo from '../../editor/segments/ProjectVideoSegment';
import Video from '../../editor/segments/VideoSegment';
import ColorBackground from '../../editor/segments/ColorBackgroundSegment';
import { Section, ProjectConfig } from '@/core/types'; // Import ProjectConfig

class SegmentFactory {
  private projectConfig: ProjectConfig;

  constructor(projectConfig: ProjectConfig) {
    this.projectConfig = projectConfig;
  }

  create(section: Section) {
    const classesMapping = {
      video: Video,
      project_video: ProjectVideo,
      image_background: ImageBackground,
      color_background: ColorBackground,
    };

    const SegmentClass = classesMapping[section.type];

    if (!SegmentClass) {
      throw new Error(`Unsupported segment type: ${section.type}`);
    }

    const segment = new SegmentClass();

    // Attach projectConfig to segment before hydration (will be available in Project model)
    if (segment.project && section.type === 'project_video') {
      segment.project.config = this.projectConfig;
    }

    return segment.hydrate(section);
  }
}

export default SegmentFactory;
