import ImageBackground from '../../editor/segments/ImageBackgroundSegment';
import ProjectVideo from '../../editor/segments/ProjectVideoSegment';
import Video from '../../editor/segments/VideoSegment';
import ColorBackground from '../../editor/segments/ColorBackgroundSegment';
import type { Section, ProjectConfig } from '@/core/types';
import type SegmentBuilder from '../SegmentBuilder';

import { container } from 'tsyringe';

type SegmentClass = typeof Video | typeof ProjectVideo | typeof ImageBackground | typeof ColorBackground;

class SegmentFactory {
  private readonly projectConfig: ProjectConfig;

  constructor(projectConfig: ProjectConfig) {
    this.projectConfig = projectConfig;
  }

  create(section: Section) {
    const classesMapping: Partial<Record<string, SegmentClass>> = {
      video: Video,
      project_video: ProjectVideo,
      image_background: ImageBackground,
      color_background: ColorBackground,
    };

    const SegmentClass = classesMapping[section.type];

    if (!SegmentClass) {
      throw new Error(`Unsupported segment type: ${section.type}`);
    }

    const segment = container.resolve<SegmentBuilder>(SegmentClass);

    // Attach projectConfig to segment before hydration (will be available in Project model)
    if (section.type === 'project_video') {
      segment.getProject().config = this.projectConfig;
    }

    return segment.hydrate(section);
  }
}

export default SegmentFactory;
