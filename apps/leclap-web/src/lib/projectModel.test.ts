import { describe, it, expect } from 'vitest';
import { modelToProject, projectToModel, type StoredClip, type StoredProject } from './projectModel';
import { EMPTY_MODEL, type WizardModel } from './wizardModel';
import type { Template } from '@/services/templateService';

const template = {
  id: 'tpl-1',
  name: 'Spotlight',
  description: '',
  orientation: 'portrait',
  hasForm: true,
  complexity: 'simple',
  source: 'sample',
  descriptor: {},
} as Template;

const baseModel: WizardModel = {
  ...EMPTY_MODEL,
  formData: { firstname: 'Ada' },
  musicChoice: { source: 'library', id: 'track-1' },
  editsBySection: { video_1: { trim: { start: 0, end: 5 } } },
  stepIndex: 2,
};

const clips: Record<string, StoredClip> = {
  video_1: { blobKey: 'blob-1', name: 'clip.mp4', type: 'video/mp4', size: 123 },
};

describe('modelToProject', () => {
  it('maps a model + template to a draft StoredProject', () => {
    const project = modelToProject({ id: 'p1', model: baseModel, template, clips, now: 1000 });

    expect(project).toMatchObject({
      id: 'p1',
      templateId: 'tpl-1',
      templateName: 'Spotlight',
      orientation: 'portrait',
      status: 'draft',
      stepIndex: 2,
      formData: { firstname: 'Ada' },
      musicChoice: { source: 'library', id: 'track-1' },
      clips,
      edits: { video_1: { trim: { start: 0, end: 5 } } },
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it('preserves createdAt and applies status + output', () => {
    const project = modelToProject({
      id: 'p1',
      model: baseModel,
      template,
      clips,
      now: 2000,
      createdAt: 500,
      status: 'completed',
      output: { blobKey: 'out-1', size: 9, duration: 12 },
    });

    expect(project.createdAt).toBe(500);
    expect(project.updatedAt).toBe(2000);
    expect(project.status).toBe('completed');
    expect(project.output).toEqual({ blobKey: 'out-1', size: 9, duration: 12 });
  });
});

describe('projectToModel', () => {
  it('rebuilds a WizardModel from a project + supplied clip Files', () => {
    const project = modelToProject({ id: 'p1', model: baseModel, template, clips, now: 1000 });
    const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

    const model = projectToModel(project, { video_1: file });

    expect(model.formData).toEqual({ firstname: 'Ada' });
    expect(model.musicChoice).toEqual({ source: 'library', id: 'track-1' });
    expect(model.editsBySection).toEqual({ video_1: { trim: { start: 0, end: 5 } } });
    expect(model.stepIndex).toBe(2);
    expect(model.clipsBySection.video_1).toBe(file);
  });

  it('seeds the selected clip as the sole take for a legacy project (no rushes)', () => {
    const project = modelToProject({ id: 'p1', model: baseModel, template, clips, now: 1000 });
    const a = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });

    const model = projectToModel(project, { video_1: a });

    expect(model.rushesBySection.video_1).toEqual([a]);
    expect(model.clipsBySection.video_1).toBe(a);
  });
});

describe('takes round-trip', () => {
  const take = (name: string, byte: number): File => new File([new Uint8Array([byte])], name, { type: 'video/webm' });

  it('persists all takes and the selected clip', () => {
    const a = take('a.webm', 1);
    const b = take('b.webm', 2);
    const model: WizardModel = {
      ...EMPTY_MODEL,
      clipsBySection: { intro: b },
      rushesBySection: { intro: [a, b] },
    };
    const selected: StoredClip = { blobKey: 'blob-b', name: 'b.webm', type: 'video/webm', size: b.size };
    const rushes: Record<string, StoredClip[]> = {
      intro: [
        { blobKey: 'blob-a', name: 'a.webm', type: 'video/webm', size: a.size },
        { blobKey: 'blob-b', name: 'b.webm', type: 'video/webm', size: b.size },
      ],
    };

    const project = modelToProject({
      id: 'p1',
      model,
      template,
      clips: { intro: selected },
      rushes,
      now: 1000,
    });

    expect(project.rushes?.intro).toHaveLength(2);
    expect(project.clips.intro).toEqual(selected);
  });

  it('restores both takes and the selection from rushFiles', () => {
    const a = take('a.webm', 1);
    const b = take('b.webm', 2);
    const selected: StoredClip = { blobKey: 'blob-b', name: 'b.webm', type: 'video/webm', size: b.size };
    const project = modelToProject({
      id: 'p1',
      model: { ...EMPTY_MODEL, clipsBySection: { intro: b }, rushesBySection: { intro: [a, b] } },
      template,
      clips: { intro: selected },
      rushes: {
        intro: [
          { blobKey: 'blob-a', name: 'a.webm', type: 'video/webm', size: a.size },
          { blobKey: 'blob-b', name: 'b.webm', type: 'video/webm', size: b.size },
        ],
      },
      now: 1000,
    });

    const model = projectToModel(project, { intro: b }, { intro: [a, b] });

    expect(model.rushesBySection.intro).toHaveLength(2);
    expect(model.clipsBySection.intro).toBe(b);
  });

  it('falls back to the first take when the selection matches none', () => {
    const a = take('a.webm', 1);
    const b = take('b.webm', 2);
    const project: StoredProject = {
      id: 'p1',
      name: 'Spotlight',
      templateId: 'tpl-1',
      templateName: 'Spotlight',
      orientation: 'portrait',
      status: 'draft',
      stepIndex: 0,
      formData: {},
      musicChoice: null,
      backgroundChoice: null,
      clips: { intro: { blobKey: 'blob-x', name: 'gone.webm', type: 'video/webm', size: 999 } },
      edits: {},
      createdAt: 1,
      updatedAt: 1,
    };

    const model = projectToModel(project, { intro: a }, { intro: [a, b] });

    expect(model.clipsBySection.intro).toBe(a);
    expect(model.rushesBySection.intro).toEqual([a, b]);
  });
});
