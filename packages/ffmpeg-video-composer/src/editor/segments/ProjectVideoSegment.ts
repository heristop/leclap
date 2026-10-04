import { injectable } from 'tsyringe';
import SegmentBuilder from '../SegmentBuilder';
import { assertSafeArgToken } from '@/core/arg-guard';
import { usesLgplEngine } from '@/core/encoding';
import { buildAudioFadeArg, buildAudioFadeChain } from '../utils/audio-fade';
import { footageArgs, type FootageHost } from '../footage/section-footage';

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

  // The clip's own audio is padded (utils/audio-fade.ts) so `-shortest` can never end the segment before
  // its video. Not on the LGPL on-device engine, whose filter set has no `apad`; a muted section or a
  // video-only clip already maps an endless silent source.
  private padsSourceAudio(noSourceAudio: boolean): boolean {
    return this.section.options?.muteSection !== true && !noSourceAudio && !usesLgplEngine(this.project.config);
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

    const { inputs, outputs } = this.ioArgs(sourceVideo);

    this.command +=
      inputs +
      ` -r ${this.fps()} ${duration} ` +
      ` ${this.videoEncoderArgs()} -c:a aac -ac 2 ${this.pixFmtArg()} ${this.colorMetadataArgs()} -movflags +faststart -shortest ` +
      `${outputs}${this.destination} `;
  };

  // The input part and the filter/map/-af part of the command. Footage edits (keep/trimSilence, HDR
  // tone-map, cutaways) add the cutaway inputs and fold the audio map and -af into one graph.
  private ioArgs(sourceVideo: string): { inputs: string; outputs: string } {
    // A video-only source has no audio, so map a silent track instead. The blank input is APPENDED
    // after the source + asset inputs (it must NOT shift the video to input 1 — animation/overlay maps
    // reference the source as `[0:v]`). `-shortest` trims the infinite anullsrc to the video length.
    const noSourceAudio = this.sourceHasNoAudio();
    const silentInput = noSourceAudio ? this.addBlankAudio() : '';
    // Source video is input 0, asset inputs follow, the appended silent leg is the last input.
    const audioIn = noSourceAudio ? `${this.sources.length + 1}:a` : '0:a';
    const audioMap = noSourceAudio ? `-map ${audioIn}` : '-map 0:a?';
    const inputs = ` ${this.hwaccelArg} ${sourceVideo} ${this.sources.join(' ')} ${silentInput} `;
    const pad = this.padsSourceAudio(noSourceAudio);
    const host: FootageHost = {
      section: this.section,
      project: this.project,
      segment: this.segment,
      assetManager: this.assetManager,
      videoIn: this.videoInputIndex(),
    };
    const footage = footageArgs(host, this.command, inputs, {
      input: audioIn,
      chain: (options) => buildAudioFadeChain(options),
      pad,
    });

    return {
      inputs: footage?.inputs ?? inputs,
      outputs: footage?.filters ?? ` ${this.filters} ${audioMap} ${buildAudioFadeArg(this.section.options, pad)}`,
    };
  }
}

export default ProjectVideo;
