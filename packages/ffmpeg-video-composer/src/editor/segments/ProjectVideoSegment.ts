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

  // True when the source clip carries no audio of its own (a video-only upload). The director probes
  // this; when set, configure() appends a silent track so the segment always has an audio stream —
  // otherwise the transition assembly's acrossfade later aborts on a missing `[k:a]`.
  private sourceHasNoAudio(): boolean {
    const muted = this.section.options?.muteSection ?? false;
    // Indexed access is `boolean` per the type, but an unprobed section (e.g. a reused clip) is absent
    // at runtime — only an explicit `false` means "probed, no audio", so widen to distinguish it.
    const hasAudio = this.project.buildInfos.sourceHasAudio[this.section.name] as boolean | undefined;

    return !muted && hasAudio === false;
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

    // A video-only source has no audio, so map a silent track instead. The blank input is APPENDED
    // after the source + asset inputs (it must NOT shift the video to input 1 — animation/overlay maps
    // reference the source as `[0:v]`). `-shortest` trims the infinite anullsrc to the video length.
    const noSourceAudio = this.sourceHasNoAudio();
    const silentInput = noSourceAudio ? this.addBlankAudio() : '';
    // Source video is input 0, asset inputs follow, the appended silent leg is the last input.
    const audioMap = noSourceAudio ? `-map ${this.sources.length + 1}:a` : '-map 0:a?';

    this.command +=
      ` ${this.hwaccelArg} ${sourceVideo} ${this.sources.join(' ')} ${silentInput} ` +
      ` -r 30 ${duration} ` +
      ` ${this.videoEncoderArgs()} -c:a aac -ac 2 ${this.pixFmtArg()} -movflags +faststart -shortest ` +
      ` ${this.filters} ${audioMap} ${this.buildAudioFadeArg()}${this.destination} `;
  };
}

export default ProjectVideo;
