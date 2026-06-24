import { injectable } from 'tsyringe';
import SegmentBuilder from '../SegmentBuilder';

@injectable()
class ColorBackground extends SegmentBuilder {
  // A blank-audio input is always prepended, so the color source (and its video) is input 1.
  protected override videoInputIndex(): number {
    return 1;
  }

  override configure = (): void => {
    this.command =
      ` -y ${this.addBlankAudio()} ` +
      ` ${this.hwaccelArg} ${this.sources.join(' ')} -t ${this.section.options?.duration} ` +
      ' -r 30 ' +
      ` -shortest ${this.pixFmtArg()} ${this.colorMetadataArgs()} -c:v ${this.videoCodec()} -c:a aac -ac 2 ` +
      ` ${this.filters} -map 0:a? ${this.buildAudioFadeArg()}${this.destination} `;
  };
}

export default ColorBackground;
