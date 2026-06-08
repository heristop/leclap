import { injectable } from 'tsyringe';
import SegmentBuilder from '../SegmentBuilder';

@injectable()
class ProjectVideo extends SegmentBuilder {
  override configure = (): void => {
    this.command = ' -y ';

    // Is there a mute option?
    if (this.section.options?.muteSection === true) {
      this.command = ` -y ${this.addBlankAudio()} `;
    }

    this.logger.info(`[ProjectVideo] Configuring project_video section: ${this.section.name}`);

    if (this.project.config.userVideoPaths) {
      this.logger.info('[ProjectVideo] Available userVideoPaths:', {
        paths: Object.keys(this.project.config.userVideoPaths),
      });
    }

    if (this.project.config.userVideoPaths?.[this.section.name]) {
      this.source = this.project.config.userVideoPaths[this.section.name];
    }

    const sourceVideo = `-i ${this.source}`;

    let duration = '';

    if ((this.section.options?.duration ?? 0) > 0) {
      duration = ` -t ${this.section.options?.duration} `;
    }

    this.command +=
      ` ${this.hwaccelArg} ${sourceVideo} ${this.sources.join(' ')} ` +
      ` -r 30 ${duration} ` +
      ` -c:v h264 -c:a aac -ac 2 -pix_fmt yuv420p -crf 23 -tune film -b:v 12M -profile:v high -movflags +faststart -shortest -preset ${this.project.config.hardwareConfig?.preset} ` +
      ` ${this.filters} -map 0:a? ${this.destination} `;
  };
}

export default ProjectVideo;
