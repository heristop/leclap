import { injectable } from 'tsyringe';
import type { Section } from '../types';

@injectable()
class Segment {
  public currentSection?: Section;

  public filtersList: string[] = [];
  public filtersMapList: string[] = [];
  public mapsList: string[] = [];
  public assetsDir = '';
  public fontsDir = '';
  public animationsDir = '';
  public tempFonts: string[] = [];
  public inputsAsset: string[] = [];
  public inputsMapCount = 0;
}

export default Segment;
