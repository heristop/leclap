import { injectable } from 'tsyringe';
import SegmentBuilder from '../SegmentBuilder';
import { assertSafeArgToken } from '@/core/argGuard';
import { buildVideoEncoderArgs, buildPixFmtArg, usesLgplEngine } from '@/core/encoding';
import type { ProjectConfig } from '@/core/types';

// Encoder args for a re-encoded video segment (bumper / videoUrl / useVideoSection). Routes through
// the shared codec resolution so the on-device LGPL engine uses libopenh264 — NOT libx264 (GPL),
// which `typeof window !== 'undefined'` wrongly selected on React Native (Hermes defines `window`).
function videoSegmentEncoding(config: ProjectConfig): string {
  if (usesLgplEngine(config)) {
    return `${buildVideoEncoderArgs(config)} -c:a aac -ac 2 ${buildPixFmtArg(config)} -movflags +faststart`;
  }

  // Browser WASM: a lighter encode to stay within the in-memory FS budget.
  if (typeof window !== 'undefined') {
    return '-c:v libx264 -c:a aac -ac 2 -pix_fmt yuv420p -crf 28 -preset ultrafast -movflags +faststart';
  }

  // Node / server: high-quality software encode.
  const preset = config.hardwareConfig?.preset ?? 'medium';

  return `-c:v h264 -c:a aac -ac 2 -pix_fmt yuv420p -crf 23 -b:v 12M -profile:v high -movflags +faststart -preset ${preset}`;
}

@injectable()
class Video extends SegmentBuilder {
  // A blank-audio input is prepended (shifting the video to input 1) unless the section is explicitly
  // unmuted (`muteSection === false`), which drops the blank audio and leaves the video at input 0.
  protected override videoInputIndex(): number {
    return this.section.options?.muteSection === false ? 0 : 1;
  }

  override configure = (): void => {
    this.command = ` -y ${this.addBlankAudio()} `;

    // Is there a mute option?
    if (this.section.options?.muteSection === false) {
      this.command = ' -y ';
    }

    this.filters += ' -map 0:a? ';

    const encodingParams = videoSegmentEncoding(this.project.config);

    const audioFadeArg = this.buildAudioFadeArg();

    if (this.section.options?.videoUrl) {
      // Use a video as second input
      this.command +=
        ` ${this.hwaccelArg} ${this.sources.join(' ')} ` +
        ` -r 30 -t ${this.section.options.duration} ` +
        ` ${encodingParams} ` +
        ` ${this.filters} ${audioFadeArg}${this.destination} `;

      return;
    }

    if (this.section.options?.useVideoSection) {
      // Use a project video as second input
      const videoSegment = this.section.options.useVideoSection;
      // Resolved source path/url (useVideoSection -> getSource) interpolated unquoted as a `-i` token.
      const sourceVideo = `-i ${assertSafeArgToken(this.filesystemAdapter.getSource(videoSegment), 'useVideoSection source')}`;

      this.command +=
        ` ${this.hwaccelArg} ${sourceVideo} ${this.sources.join(' ')} ` +
        ` -r 30 -t ${this.section.options.duration} ` +
        ` ${encodingParams} ` +
        ` ${this.filters} ${audioFadeArg}${this.destination} `;

      return;
    }

    // Default: drive the segment from its primary (e.g. uploaded) source video.
    // Without this, a `video` section that has neither videoUrl nor
    // useVideoSection produced an input-only command (no output), which FFmpeg
    // rejects with "At least one output file must be specified".
    this.command +=
      ` ${this.hwaccelArg} -i ${assertSafeArgToken(this.source, 'source')} ${this.sources.join(' ')} ` +
      ` -r 30 -t ${this.section.options?.duration} ` +
      ` ${encodingParams} ` +
      ` ${this.filters} ${audioFadeArg}${this.destination} `;
  };
}

export default Video;
