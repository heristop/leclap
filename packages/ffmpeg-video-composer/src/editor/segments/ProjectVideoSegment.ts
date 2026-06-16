import { injectable } from 'tsyringe';
import SegmentBuilder from '../SegmentBuilder';
import { assertSafeArgToken } from '@/core/argGuard';

@injectable()
class ProjectVideo extends SegmentBuilder {
  // A blank-audio input is prepended only when the section is muted, which shifts the user video to
  // input 1; otherwise the user video is input 0.
  protected override videoInputIndex(): number {
    return this.section.options?.muteSection === true ? 1 : 0;
  }

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

    // Resolved source path (userVideoPaths/staged) interpolated unquoted as a `-i` source token.
    const sourceVideo = `-i ${assertSafeArgToken(this.source, 'source')}`;

    let duration = '';

    if ((this.section.options?.duration ?? 0) > 0) {
      duration = ` -t ${this.section.options?.duration} `;
    }

    this.command +=
      ` ${this.hwaccelArg} ${sourceVideo} ${this.sources.join(' ')} ` +
      ` -r 30 ${duration} ` +
      ` ${this.videoEncoderArgs()} -c:a aac -ac 2 ${this.pixFmtArg()} -movflags +faststart -shortest ` +
      ` ${this.filters} -map 0:a? ${this.buildAudioFadeArg()}${this.destination} `;
  };
}

export default ProjectVideo;
