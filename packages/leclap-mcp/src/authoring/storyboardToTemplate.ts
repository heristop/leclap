import type { TemplateDescriptor } from 'ffmpeg-video-composer';

import type { RemotionStoryboard } from './remotionStoryboard.js';

type Section = NonNullable<TemplateDescriptor['sections']>[number];
type Sequence = RemotionStoryboard['sequences'][number];

function translation(value: string | Record<string, string>): Record<string, string> {
  if (typeof value === 'string') {
    return { en: value };
  }

  return value;
}

function caption(sequence: Sequence): Section['caption'] | undefined {
  if (sequence.text.length === 0) {
    return undefined;
  }

  const [first] = sequence.text;

  return {
    text: translation(first.value),
    position: first.position,
    style: first.style,
  };
}

function transition(sequence: Sequence, index: number, total: number): Section['transition'] | undefined {
  if (index === total - 1) {
    return undefined;
  }

  return sequence.transitionAfter;
}

function commonFields(sequence: Sequence, index: number, total: number): Partial<Section> & { name: string } {
  const nextCaption = caption(sequence);
  const nextTransition = transition(sequence, index, total);

  return {
    name: sequence.id,
    ...(nextCaption ? { caption: nextCaption } : {}),
    ...(nextTransition ? { transition: nextTransition } : {}),
    ...(sequence.look ? { look: sequence.look } : {}),
  };
}

function sectionFor(sequence: Sequence, index: number, total: number): Section {
  const common = commonFields(sequence, index, total);

  if (sequence.background.type === 'color') {
    return {
      ...common,
      type: 'color_background',
      options: {
        duration: sequence.duration,
        backgroundColor: sequence.background.color,
      },
    };
  }

  if (sequence.background.type === 'image') {
    return {
      ...common,
      type: 'image_background',
      options: {
        duration: sequence.duration,
        pictureUrl: sequence.background.src,
      },
    };
  }

  if (sequence.background.userProvided) {
    return {
      ...common,
      type: 'project_video',
      options: {
        duration: sequence.duration,
      },
    };
  }

  return {
    ...common,
    type: 'video',
    options: {
      duration: sequence.duration,
      videoUrl: sequence.background.src,
    },
  };
}

function musicGlobal(storyboard: RemotionStoryboard): Partial<NonNullable<TemplateDescriptor['global']>> {
  if (!storyboard.music) {
    return {};
  }

  return {
    musicEnabled: true,
    music: { name: storyboard.music.src },
    audio: { musicVolume: storyboard.music.volume },
  };
}

export function storyboardToTemplate(storyboard: RemotionStoryboard): TemplateDescriptor {
  return {
    global: {
      orientation: storyboard.orientation,
      variables: storyboard.variables,
      ...musicGlobal(storyboard),
    },
    sections: storyboard.sequences.map((sequence, index) => sectionFor(sequence, index, storyboard.sequences.length)),
  };
}
