import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MusicComposer from '@/editor/MusicComposer';
import { Section, MusicConfig } from '@/core/types';
import Project from '@/core/models/Project';
import Template from '@/core/models/Template';

// Mock dependencies
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockFFmpegAdapter = {
  execute: vi.fn().mockResolvedValue({ rc: 0 }),
};

const mockFilesystemAdapter = {
  getBuildPath: vi.fn().mockResolvedValue('/build/path'),
  getAssetsPath: vi.fn().mockResolvedValue('/assets/path'),
  move: vi.fn(),
  fetch: vi.fn(),
  stat: vi.fn(),
  getTempDir: vi.fn().mockReturnValue('/temp'),
  unlink: vi.fn(),
};

const mockMusicAdapter = {
  process: vi.fn().mockResolvedValue({ rc: 0 }),
};

// Mock Project and Template
const createMockProject = (musicConfig?: MusicConfig) => ({
  config: {
    music: musicConfig,
    audioConfig: {
      sampleRate: 44100,
    },
  },
  buildInfos: {
    musicPath: '',
    currentLength: 0,
    currentIncrement: 0,
    totalSegments: 1,
    musicFilters: [],
    durations: {},
  },
});

const createMockTemplate = () => ({
  descriptor: {
    global: {
      transitionDuration: 0.3,
      audioVolumeLevel: 1,
      music: undefined as MusicConfig | undefined,
    },
  },
});

describe('MusicComposer', () => {
  let musicComposer: MusicComposer;
  let mockProject: Project;
  let mockTemplate: Template;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    mockProject = createMockProject() as Project;
    mockTemplate = createMockTemplate() as Template;

    musicComposer = new MusicComposer(
      mockProject,
      mockTemplate,
      mockLogger,
      mockFFmpegAdapter,
      mockFilesystemAdapter,
      mockMusicAdapter
    );
  });

  describe('loadMusic', () => {
    it('should load music from cache if it exists', async () => {
      // Arrange
      const musicConfig = { name: 'test', url: 'http://test.com/test.mp3' };
      mockProject.config.music = musicConfig;
      mockFilesystemAdapter.stat.mockResolvedValue(true);

      // Act
      await musicComposer.loadMusic();

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded from cache'));
      expect(mockFilesystemAdapter.fetch).not.toHaveBeenCalled();
    });

    it('should download music if not in cache', async () => {
      // Arrange
      const musicConfig = { name: 'test', url: 'http://test.com/test.mp3' };
      mockProject.config.music = musicConfig;
      mockFilesystemAdapter.stat.mockResolvedValue(false);
      mockFilesystemAdapter.fetch.mockResolvedValue('/temp/downloaded.mp3');

      // Act
      await musicComposer.loadMusic();

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Fetching'));
      expect(mockFilesystemAdapter.fetch).toHaveBeenCalledWith(musicConfig.url);
      expect(mockFilesystemAdapter.move).toHaveBeenCalled();
    });

    it('should use template music if project music is not defined', async () => {
      // Arrange
      const templateMusic = { name: 'template', url: 'http://test.com/template.mp3' };
      mockTemplate.descriptor.global.music = templateMusic;
      mockFilesystemAdapter.stat.mockResolvedValue(false);

      // Act
      await musicComposer.loadMusic();

      // Assert
      expect(mockProject.config.music).toBe(templateMusic);
    });
  });

  describe('prepareMusicTrack', () => {
    it('should prepare first section with fade in', () => {
      // Arrange
      mockProject.buildInfos.currentIncrement = -1;
      mockProject.buildInfos.totalSegments = 3;
      const section: Section = {
        name: 'section1',
        type: 'video',
        visibility: ['video_segment'],
        options: {
          duration: 5,
          musicVolumeLevel: 0.7,
        },
      };

      // Act
      musicComposer.prepareMusicTrack(section);

      // Assert
      const filter = mockProject.buildInfos.musicFilters[0];
      expect(filter).toContain('atrim=start=0:duration=5.3');
      expect(filter).toContain('volume=0.7');
    });

    it('should prepare last section with fade out', () => {
      // Arrange
      mockProject.buildInfos.currentIncrement = 1;
      mockProject.buildInfos.totalSegments = 2;
      const section: Section = {
        name: 'section2',
        type: 'video',
        visibility: ['video_segment'],
        options: {
          duration: 5,
        },
      };

      // Act
      musicComposer.prepareMusicTrack(section);

      // Assert
      const filter = mockProject.buildInfos.musicFilters[0];
      expect(filter).toContain('atrim=start=0:duration=5.3');
      expect(filter).toContain('afade=t=out');
    });

    it('should add crossfade for consecutive sections', () => {
      // Arrange
      mockProject.buildInfos.currentIncrement = 0;
      mockProject.buildInfos.totalSegments = 2;

      // First section
      const firstSection: Section = {
        name: 'section1',
        type: 'video',
        visibility: ['video_segment'],
        options: {
          duration: 5,
        },
      };
      musicComposer.prepareMusicTrack(firstSection);

      // Second section (will be last section)
      const secondSection: Section = {
        name: 'section2',
        type: 'video',
        visibility: ['video_segment'],
        options: {
          duration: 5,
        },
      };

      // Act
      musicComposer.prepareMusicTrack(secondSection);

      // Assert
      expect(mockProject.buildInfos.musicFilters.length).toBeGreaterThanOrEqual(2);

      const allFilters = mockProject.buildInfos.musicFilters.join(' ');

      // Check main filter components
      expect(allFilters).toContain('[section1]');     // First section
      expect(allFilters).toContain('[lastsection]');  // Last section
      expect(allFilters).toContain('acrossfade=d=0.3:c1=tri:c2=tri'); // Crossfade
      expect(allFilters).toContain('[lastcrossed]');  // Crossfade output

      // Verify the sequence of operations
      const filters = mockProject.buildInfos.musicFilters;
      expect(filters[0]).toContain('atrim=start=0'); // First section starts at 0
      expect(filters[1]).toContain('atrim=start=5'); // Second section starts at 5 (duration of first)
      expect(filters[2]).toContain('acrossfade');    // Crossfade is last operation
    });

    it('should accumulate correct timestamps', () => {
      // Arrange
      mockProject.buildInfos.currentIncrement = 0;
      mockProject.buildInfos.currentLength = 10;
      mockProject.buildInfos.totalSegments = 2;
      const section: Section = {
        name: 'section2',
        type: 'video',
        visibility: ['video_segment'],
        options: {
          duration: 5,
        },
      };

      // Act
      musicComposer.prepareMusicTrack(section);

      // Assert
      const filter = mockProject.buildInfos.musicFilters[0];
      expect(filter).toContain('atrim=start=10:duration=5.3');
    });

    it('should respect custom volume levels', () => {
      // Arrange
      const customVolume = 0.3;
      const section: Section = {
        name: 'section1',
        type: 'video',
        visibility: ['video_segment'],
        options: {
          duration: 5,
          musicVolumeLevel: customVolume,
        },
      };

      // Act
      musicComposer.prepareMusicTrack(section);

      // Assert
      const filter = mockProject.buildInfos.musicFilters[0];
      expect(filter).toContain(`volume=${customVolume}`);
    });

    it('should use default volume if not specified', () => {
      // Arrange
      const section: Section = {
        name: 'section1',
        type: 'video',
        visibility: ['video_segment'],
        options: {
          duration: 5,
        },
      };

      // Act
      musicComposer.prepareMusicTrack(section);

      // Assert
      const filter = mockProject.buildInfos.musicFilters[0];
      expect(filter).toContain('volume=0.5'); // Default value
    });
});

  describe('appendMusic', () => {
    it('should mix audio for single segment', async () => {
      // Arrange
      const segments: Section[] = [{
        name: 'section1',
        type: 'video',
        visibility: ['video_segment'],
        options: {
          duration: 5,
        },
      }];

      // Act
      await musicComposer.appendMusic(segments, 'output.mp4');

      // Assert
      expect(mockFFmpegAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining('amix=inputs=2:duration=first')
      );
    });

    it('should handle multiple segments with filters', async () => {
      // Arrange
      const segments: Section[] = [
        { name: 'section1', type: 'video', visibility: ['video_segment'], options: { duration: 5 } },
        { name: 'section2', type: 'video', visibility: ['video_segment'], options: { duration: 5 } },
      ];
      mockProject.buildInfos.musicFilters = ['[filter1]', '[filter2]'];

      // Act
      await musicComposer.appendMusic(segments, 'output.mp4');

      // Assert
      expect(mockFFmpegAdapter.execute).toHaveBeenCalledWith(
        expect.stringContaining('[lastcrossed]')
      );
    });

    it('should throw error if ffmpeg fails', async () => {
      // Arrange
      mockFFmpegAdapter.execute.mockResolvedValue({ rc: 1 });
      const segments: Section[] = [{ name: 'section1', type: 'video', visibility: ['video_segment'], options: { duration: 5 } }];

      // Act & Assert
      await expect(musicComposer.appendMusic(segments, 'output.mp4')).rejects.toThrow('Error on music add');
    });
  });

  describe('loopMusic', () => {
    it('should process music if total length requires looping', async () => {
      // Arrange
      mockProject.buildInfos.totalLength = 10;
      mockProject.buildInfos.musicPath = 'music.mp3';

      // Act
      await musicComposer.loopMusic();

      // Assert
      expect(mockMusicAdapter.process).toHaveBeenCalledWith(
        mockLogger,
        mockFilesystemAdapter,
        10,
        'music.mp3'
      );
    });
  });
});
