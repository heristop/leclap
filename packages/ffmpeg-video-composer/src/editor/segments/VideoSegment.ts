import { injectable } from 'tsyringe';
import SegmentBuilder from '../SegmentBuilder';
import { assertSafeArgToken } from '@/core/arg-guard';
import {
  buildColorMetadataArgs,
  buildVideoEncoderArgs,
  buildPixFmtArg,
  usesLgplEngine,
  resolveSoftwareTier,
} from '@/core/encoding';
import type { ProjectConfig } from '@/core/types';
import { buildAudioFadeChain } from '../utils/audio-fade';
import { footageArgs, footagePlan, type FootageHost } from '../footage/section-footage';

// Encoder args for a re-encoded video segment (bumper / videoUrl / useVideoSection). Routes through
// the shared codec resolution so the on-device LGPL engine uses libopenh264 — NOT libx264 (GPL),
// which `typeof window !== 'undefined'` wrongly selected on React Native (Hermes defines `window`).
function videoSegmentEncoding(config: ProjectConfig, ffmpegVersion: string | null): string {
  // Tag every re-encoded segment Rec.709/limited-range; the stream-copy concat inherits it.
  const colorArgs = buildColorMetadataArgs(config, ffmpegVersion);

  if (usesLgplEngine(config)) {
    return `${buildVideoEncoderArgs(config)} -c:a aac -ac 2 ${buildPixFmtArg(config)} ${colorArgs} -movflags +faststart`;
  }

  // Browser WASM: a light encode to stay within the in-memory FS budget. crf comes from the quality
  // tier (23 = standard, matching the historical hardcoded value); `preset ultrafast` stays fixed
  // regardless of tier — it's a WASM-speed choice (the in-browser encode must stay fast), not a
  // quality knob, so tiers don't touch it here.
  if (typeof window !== 'undefined') {
    const { crf } = resolveSoftwareTier(config);

    return `-c:v libx264 -c:a aac -ac 2 -pix_fmt yuv420p -crf ${crf} -preset ultrafast ${colorArgs} -movflags +faststart`;
  }

  // Node / server: high-quality software encode, tier-aware crf/bitrate/preset.
  const { crf, bitrate, preset: tierPreset } = resolveSoftwareTier(config);
  const preset = config.hardwareConfig?.preset ?? tierPreset;

  return `-c:v h264 -c:a aac -ac 2 -pix_fmt yuv420p -crf ${crf} -b:v ${bitrate} -profile:v high ${colorArgs} -movflags +faststart -preset ${preset}`;
}

@injectable()
class Video extends SegmentBuilder {
  // A blank-audio input is prepended (shifting the video to input 1) unless the section is explicitly
  // unmuted (`muteSection === false`), which drops the blank audio and leaves the video at input 0.
  protected override videoInputIndex(): number {
    return this.section.options?.muteSection === false ? 0 : 1;
  }

  // The clip's audio for footage edits: input 0 is the blank track (muted, the default) or the clip
  // itself (unmuted); an unmuted clip probed without audio gets generated silence instead.
  private footageAudioInput(): string | null {
    const unmuted = this.section.options?.muteSection === false;

    return unmuted && footagePlan({ project: this.project, section: this.section })?.hasAudio === false ? null : '0:a';
  }

  private footageHost(): FootageHost {
    return {
      section: this.section,
      project: this.project,
      segment: this.segment,
      assetManager: this.assetManager,
      videoIn: this.videoInputIndex(),
    };
  }

  // The source inputs of the three video variants: an asset videoUrl (staged as the first asset input),
  // a reused project clip, or the section's own uploaded clip.
  private videoInputs(): string {
    const options = this.section.options;

    if (options?.videoUrl) {
      return ` ${this.hwaccelArg} ${this.sources.join(' ')} `;
    }

    if (options?.useVideoSection) {
      // Resolved source path/url (useVideoSection -> getSource) interpolated unquoted as a `-i` token.
      const sourceVideo = `-i ${assertSafeArgToken(this.filesystemAdapter.getSource(options.useVideoSection), 'useVideoSection source')}`;

      return ` ${this.hwaccelArg} ${sourceVideo} ${this.sources.join(' ')} `;
    }

    // Default: drive the segment from its primary (e.g. uploaded) source video. Without this, a `video`
    // section that has neither videoUrl nor useVideoSection produced an input-only command (no output),
    // which FFmpeg rejects with "At least one output file must be specified".
    return ` ${this.hwaccelArg} -i ${assertSafeArgToken(this.source, 'source')} ${this.sources.join(' ')} `;
  }

  override configure = (): void => {
    this.command = ` -y ${this.addBlankAudio()} `;

    // Is there a mute option?
    if (this.section.options?.muteSection === false) {
      this.command = ' -y ';
    }

    this.filters += ' -map 0:a? ';

    const encodingParams = videoSegmentEncoding(this.project.config, this.project.ffmpegVersion);
    const inputs = this.videoInputs();
    // Footage edits (keep/trimSilence, HDR tone-map, cutaways) fold the audio map and -af into one graph.
    const host = this.footageHost();
    const footage = footageArgs(host, this.command, inputs, {
      input: this.footageAudioInput(),
      chain: (options) => buildAudioFadeChain(options),
    });
    const outputs = footage?.filters ?? ` ${this.filters} ${this.buildAudioFadeArg()}`;

    this.command +=
      (footage?.inputs ?? inputs) +
      ` -r ${this.fps()} -t ${this.section.options?.duration} ` +
      ` ${encodingParams} ` +
      `${outputs}${this.destination} `;
  };
}

export default Video;
