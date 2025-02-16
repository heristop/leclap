import ImageBackground from '@/editor/segments/ImageBackgroundSegment';
import ProjectVideo from '@/editor/segments/ProjectVideoSegment';
import Video from '@/editor/segments/VideoSegment';
import ColorBackground from '@/editor/segments/ColorBackgroundSegment';
import { Section } from '@/core/types';

class SegmentFactory {
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

    return new SegmentClass().hydrate(section);
  }
}

export default SegmentFactory;
