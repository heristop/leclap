import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Terminal } from '@/utils/terminal';

function joinMockCalls(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.map((call: unknown[]) => call[0]).join('\n');
}

describe('Terminal', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    clear: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      clear: vi.spyOn(console, 'clear').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('showWelcomeBanner', () => {
    it('should clear console and show welcome message', () => {
      Terminal.showWelcomeBanner();

      expect(consoleSpy.clear).toHaveBeenCalledOnce();
      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('FFmpeg Video Composer'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Setting up'));
    });
  });

  describe('showSystemInfo', () => {
    it('should display system information in grid format', () => {
      const systemInfo = {
        os: 'darwin',
        arch: 'arm64',
        nodeVersion: 'v24.11.1',
        packageManager: 'pnpm',
        memoryGB: 16,
      };

      Terminal.showSystemInfo(systemInfo);

      expect(consoleSpy.log).toHaveBeenCalledOnce();
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('darwin');
      expect(output).toContain('arm64');
      expect(output).toContain('v24.11.1');
      expect(output).toContain('pnpm');
      expect(output).toContain('16GB');
    });
  });

  describe('showFFmpegStatus', () => {
    it('should display FFmpeg status with available system version', () => {
      const detection = {
        system: { available: true, version: '8.0' },
        static: { available: false },
        wasm: { available: false },
      };

      Terminal.showFFmpegStatus(detection);

      expect(consoleSpy.log).toHaveBeenCalledOnce();
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('FFmpeg');
      expect(output).toContain('sys');
      expect(output).toContain('8.0');
    });

    it('should display FFmpeg status when nothing is available', () => {
      const detection = {
        system: { available: false },
        static: { available: false },
        wasm: { available: false },
      };

      Terminal.showFFmpegStatus(detection);

      expect(consoleSpy.log).toHaveBeenCalledOnce();
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('FFmpeg');
    });

    it('should display all FFmpeg implementations when available', () => {
      const detection = {
        system: { available: true, version: '8.0' },
        static: { available: true, version: '6.0' },
        wasm: { available: true, version: '0.12.x' },
      };

      Terminal.showFFmpegStatus(detection);

      expect(consoleSpy.log).toHaveBeenCalledOnce();
      const output = consoleSpy.log.mock.calls[0][0];
      expect(output).toContain('sys');
      expect(output).toContain('static');
      expect(output).toContain('wasm');
    });
  });

  describe('showInstallationOptions', () => {
    it('should display installation options and prompt for choice', () => {
      Terminal.showInstallationOptions();

      expect(consoleSpy.log).toHaveBeenCalledTimes(5);
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Choice [1-4]:'));
    });
  });

  describe('spinner', () => {
    it('should start and stop spinner with success', () => {
      vi.useFakeTimers();

      Terminal.startSpinner('Testing...');

      expect(stdoutSpy).toHaveBeenCalled();

      Terminal.stopSpinner('success', 'Done!');

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Done!'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('✅'));

      vi.useRealTimers();
    });

    it('should stop spinner with error', () => {
      Terminal.startSpinner('Processing...');
      Terminal.stopSpinner('error', 'Failed!');

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Failed!'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('❌'));
    });

    it('should stop spinner with message but no result type', () => {
      Terminal.startSpinner('Testing...');
      Terminal.stopSpinner(undefined, 'Just a message');

      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Just a message'));
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('✅'));
      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('❌'));
    });

    it('should stop spinner without message', () => {
      Terminal.startSpinner('Testing...');
      Terminal.stopSpinner();

      // Should clear interval but not log anything
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should animate spinner frames', () => {
      vi.useFakeTimers();

      Terminal.startSpinner('Loading...');

      // Initial write
      expect(stdoutSpy).toHaveBeenCalledWith('Loading... ');

      // Advance time to trigger spinner update
      vi.advanceTimersByTime(80);

      // Should write with first frame
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('⠋'));

      // Advance more to check frame rotation
      vi.advanceTimersByTime(80);
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('⠙'));

      Terminal.stopSpinner();
      vi.useRealTimers();
    });

    it('should stop previous spinner when starting new one', () => {
      vi.useFakeTimers();

      Terminal.startSpinner('First...');
      Terminal.startSpinner('Second...');

      // Only the second spinner should be active
      expect(stdoutSpy).toHaveBeenLastCalledWith('Second... ');

      Terminal.stopSpinner();
      vi.useRealTimers();
    });
  });

  describe('showError', () => {
    it('should display error with suggestions', () => {
      const suggestions = ['Install ffmpeg via Homebrew', 'Use ffmpeg-static package'];

      Terminal.showError('FFmpeg not found', suggestions);

      expect(consoleSpy.log).toHaveBeenCalled();
      const calls = joinMockCalls(consoleSpy.log);
      expect(calls).toContain('FFmpeg not found');
      expect(calls).toContain('Install ffmpeg via Homebrew');
      expect(calls).toContain('Use ffmpeg-static package');
    });

    it('should display error without suggestions', () => {
      Terminal.showError('Something went wrong', []);

      expect(consoleSpy.log).toHaveBeenCalledOnce();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'));
    });
  });

  describe('showSuccess', () => {
    it('should display success message', () => {
      Terminal.showSuccess('Installation completed successfully');

      expect(consoleSpy.log).toHaveBeenCalledOnce();
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Installation completed successfully'));
    });
  });

  describe('showProgressBar', () => {
    it('should display progress bar at 0%', () => {
      Terminal.showProgressBar(0, 100, 'Downloading');

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Downloading'));
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('0%'));
    });

    it('should display progress bar at 50%', () => {
      Terminal.showProgressBar(50, 100, 'Installing');

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Installing'));
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('50%'));
    });

    it('should display progress bar at 100% and add newline', () => {
      Terminal.showProgressBar(100, 100, 'Complete');

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Complete'));
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('100%'));
      expect(consoleSpy.log).toHaveBeenCalledOnce(); // newline
    });
  });

  describe('showInstallationCommands', () => {
    it('should display macOS installation commands', () => {
      Terminal.showInstallationCommands('darwin');

      expect(consoleSpy.log).toHaveBeenCalled();
      const calls = joinMockCalls(consoleSpy.log);
      expect(calls).toContain('brew install ffmpeg');
      expect(calls).toContain('darwin Installation');
    });

    it('should display macOS installation commands with "mac" keyword', () => {
      Terminal.showInstallationCommands('mac');

      expect(consoleSpy.log).toHaveBeenCalled();
      const calls = joinMockCalls(consoleSpy.log);
      expect(calls).toContain('brew install ffmpeg');
    });

    it('should display Linux installation commands', () => {
      Terminal.showInstallationCommands('linux');

      expect(consoleSpy.log).toHaveBeenCalled();
      const calls = joinMockCalls(consoleSpy.log);
      expect(calls).toContain('apt install ffmpeg');
      expect(calls).toContain('dnf install ffmpeg');
    });

    it('should display Windows installation commands', () => {
      Terminal.showInstallationCommands('windows');

      expect(consoleSpy.log).toHaveBeenCalled();
      const calls = joinMockCalls(consoleSpy.log);
      expect(calls).toContain('choco install ffmpeg');
      expect(calls).toContain('winget install ffmpeg');
    });

    it('should display fallback commands for unknown platform', () => {
      Terminal.showInstallationCommands('unknown-os');

      expect(consoleSpy.log).toHaveBeenCalled();
      const calls = joinMockCalls(consoleSpy.log);
      expect(calls).toContain('pnpm add ffmpeg-static');
      expect(calls).toContain('Universal static binary solution');
    });
  });

  describe('typeText', () => {
    it('should type text character by character', async () => {
      vi.useFakeTimers();

      const promise = Terminal.typeText('Hello', 10);

      // Fast-forward time
      await vi.runAllTimersAsync();
      await promise;

      expect(stdoutSpy).toHaveBeenCalledTimes(5); // 5 characters
      expect(consoleSpy.log).toHaveBeenCalledOnce(); // newline at end

      vi.useRealTimers();
    });
  });

  describe('showLoadingSequence', () => {
    it('should show loading sequence with spinners', async () => {
      vi.useFakeTimers();

      const steps = ['Step 1', 'Step 2'];
      const promise = Terminal.showLoadingSequence(steps);

      // Fast-forward time
      await vi.runAllTimersAsync();
      await promise;

      expect(stdoutSpy).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
