import { injectable } from 'tsyringe';
import SegmentBuilder from '../SegmentBuilder';

@injectable()
class Video extends SegmentBuilder {
  override configure = (): void => {
    this.command = ` -y ${this.addBlankAudio()} `;

    // Is there a mute option?
    if (this.section.options?.muteSection === false) {
      this.command = ' -y ';
    }

    this.filters += ' -map 0:a? ';

    // Detect if running in browser/WASM - use simpler encoding to avoid memory issues
    const isWasm = typeof window !== 'undefined';
    const encodingParams = isWasm
      ? '-c:v libx264 -c:a aac -ac 2 -pix_fmt yuv420p -crf 28 -preset ultrafast -movflags +faststart'
      : `-c:v h264 -c:a aac -ac 2 -pix_fmt yuv420p -crf 23 -b:v 12M -profile:v high -movflags +faststart -preset ${this.project.config.hardwareConfig?.preset ?? 'medium'}`;

    if (this.section.options?.videoUrl) {
      // Use a video as second input
      this.command +=
        ` ${this.hwaccelArg} ${this.sources.join(' ')} ` +
        ` -r 30 -t ${this.section.options.duration} ` +
        ` ${encodingParams} ` +
        ` ${this.filters} ${this.destination} `;

      return;
    }

    if (this.section.options?.useVideoSection) {
      // Use a project video as second input
      const videoSegment = this.section.options.useVideoSection;
      const sourceVideo = `-i ${this.filesystemAdapter.getSource(videoSegment)}`;

      this.command +=
        ` ${this.hwaccelArg} ${sourceVideo} ${this.sources.join(' ')} ` +
        ` -r 30 -t ${this.section.options.duration} ` +
        ` ${encodingParams} ` +
        ` ${this.filters} ${this.destination} `;

      return;
    }

    // Default: drive the segment from its primary (e.g. uploaded) source video.
    // Without this, a `video` section that has neither videoUrl nor
    // useVideoSection produced an input-only command (no output), which FFmpeg
    // rejects with "At least one output file must be specified".
    this.command +=
      ` ${this.hwaccelArg} -i ${this.source} ${this.sources.join(' ')} ` +
      ` -r 30 -t ${this.section.options?.duration} ` +
      ` ${encodingParams} ` +
      ` ${this.filters} ${this.destination} `;
  };
}

export default Video;
