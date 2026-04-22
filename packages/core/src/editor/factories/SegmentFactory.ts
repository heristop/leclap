import ImageBackground from '../../editor/segments/ImageBackgroundSegment';
import ProjectVideo from '../../editor/segments/ProjectVideoSegment';
import Video from '../../editor/segments/VideoSegment';
import ColorBackground from '../../editor/segments/ColorBackgroundSegment';
import type { Section, ProjectConfig } from '@/core/types';
import type SegmentBuilder from '../SegmentBuilder';

import { container } from 'tsyringe';

type SegmentClass = typeof Video | typeof ProjectVideo | typeof ImageBackground | typeof ColorBackground;

class SegmentFactory {
  private projectConfig: ProjectConfig;

  constructor(projectConfig: ProjectConfig) {
    this.projectConfig = projectConfig;
  }

  create(section: Section) {
    const classesMapping: Record<string, SegmentClass> = {
      video: Video as SegmentClass,
      project_video: ProjectVideo as SegmentClass,
      image_background: ImageBackground as SegmentClass,
      color_background: ColorBackground as SegmentClass,
    };

    const SegmentClass = classesMapping[section.type];

    if (!SegmentClass) {
      throw new Error(`Unsupported segment type: ${section.type}`);
    }

    const segment = container.resolve<SegmentBuilder>(SegmentClass);

    // Attach projectConfig to segment before hydration (will be available in Project model)
    if (segment.project && section.type === 'project_video') {
      segment.project.config = this.projectConfig;
    }

    return segment.hydrate(section);
  }
}

export default SegmentFactory;
