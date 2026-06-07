import { ProjectStatus, ProjectStatusHelper } from './ProjectStatus';

describe('ProjectStatus', () => {
  it('exposes the four lifecycle states', () => {
    expect(ProjectStatus.DRAFT).toBe('draft');
    expect(ProjectStatus.PROCESSING).toBe('processing');
    expect(ProjectStatus.COMPLETED).toBe('completed');
    expect(ProjectStatus.FAILED).toBe('failed');
  });
});

describe('ProjectStatusHelper.canTransitionTo', () => {
  it('allows draft -> processing but not draft -> completed/failed', () => {
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.DRAFT, ProjectStatus.PROCESSING)).toBe(true);
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.DRAFT, ProjectStatus.COMPLETED)).toBe(false);
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.DRAFT, ProjectStatus.FAILED)).toBe(false);
  });

  it('allows processing -> completed and processing -> failed, not processing -> draft', () => {
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.PROCESSING, ProjectStatus.COMPLETED)).toBe(true);
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.PROCESSING, ProjectStatus.FAILED)).toBe(true);
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.PROCESSING, ProjectStatus.DRAFT)).toBe(false);
  });

  it('allows re-editing from completed and retry from failed', () => {
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.COMPLETED, ProjectStatus.DRAFT)).toBe(true);
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.FAILED, ProjectStatus.DRAFT)).toBe(true);
    expect(ProjectStatusHelper.canTransitionTo(ProjectStatus.FAILED, ProjectStatus.PROCESSING)).toBe(true);
  });
});

describe('ProjectStatusHelper.isTerminal', () => {
  it('treats completed and failed as terminal', () => {
    expect(ProjectStatusHelper.isTerminal(ProjectStatus.COMPLETED)).toBe(true);
    expect(ProjectStatusHelper.isTerminal(ProjectStatus.FAILED)).toBe(true);
  });

  it('treats draft and processing as non-terminal', () => {
    expect(ProjectStatusHelper.isTerminal(ProjectStatus.DRAFT)).toBe(false);
    expect(ProjectStatusHelper.isTerminal(ProjectStatus.PROCESSING)).toBe(false);
  });
});
