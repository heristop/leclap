import SegmentBuilder from '../SegmentBuilder';

class ProjectVideo extends SegmentBuilder {
  configure = (): void => {
    this.command = ' -y ';

    // Is there a mute option?
    if (true === this.section.options.muteSection) {
      this.command = ` -y ${this.addBlankAudio()} `;
    }

    this.logger.info(`[ProjectVideo] Configuring project_video section: ${this.section.name}`);

    // First try to use section-specific video from userVideoPaths
    if (this.project.config.userVideoPaths) {
      this.logger.info('[ProjectVideo] Available userVideoPaths:', {
        paths: Object.keys(this.project.config.userVideoPaths),
      });
    }

    if (this.project.config.userVideoPaths && this.project.config.userVideoPaths[this.section.name]) {
      this.source = this.project.config.userVideoPaths[this.section.name];
      this.logger.info(`[ProjectVideo] Using section-specific video for ${this.section.name}: ${this.source}`);
    }
    // Fall back to general userVideoPath (for backwards compatibility)
    else if (this.project.config.userVideoPath) {
      this.source = this.project.config.userVideoPath;
      this.logger.info(`[ProjectVideo] Using general userVideoPath for ${this.section.name}: ${this.source}`);
    } else {
      this.logger.info(
        `[ProjectVideo] No user video found for section ${this.section.name}, using default: ${this.source}`
      );
    }

    const sourceVideo = `-i ${this.source}`;

    let duration = '';

    if (this.section.options.duration > 0) {
      duration = ` -t ${this.section.options.duration} `;
    }

    this.command +=
      ` ${this.hwaccelArg} ${sourceVideo} ${this.sources.join(' ')} ` +
      ` -r 30 ${duration} ` +
      ` -c:v h264 -c:a aac -ac 2 -pix_fmt yuv420p -crf 23 -tune film -b:v 12M -profile:v high -movflags +faststart -shortest -preset ${this.project.config.hardwareConfig.preset} ` +
      ` ${this.filters} -map 0:a ${this.destination} `;
  };
}

export default ProjectVideo;
