import { recorderModes } from './recorder-modes';

describe('recorderModes', () => {
  it('offers both cameras and an upload when the section sets nothing', () => {
    expect(recorderModes(undefined)).toEqual({ modes: ['front', 'back', 'upload'], initial: 'front' });
  });

  it('starts on the authored capture mode', () => {
    expect(recorderModes({ captureMode: 'upload' })).toEqual({ modes: ['front', 'back', 'upload'], initial: 'upload' });
  });

  it('keeps an authored lock to one mode', () => {
    expect(recorderModes({ allowedCaptureModes: ['upload'] })).toEqual({ modes: ['upload'], initial: 'upload' });
  });

  it('drops screen capture, which the phone recorder does not offer', () => {
    expect(recorderModes({ allowedCaptureModes: ['screen', 'back'] })).toEqual({ modes: ['back'], initial: 'back' });
    expect(recorderModes({ allowedCaptureModes: ['screen'] })).toEqual({
      modes: ['front', 'back', 'upload'],
      initial: 'front',
    });
  });

  it('ignores an authored start mode that is not allowed', () => {
    expect(recorderModes({ captureMode: 'front', allowedCaptureModes: ['back', 'upload'] })).toEqual({
      modes: ['back', 'upload'],
      initial: 'back',
    });
  });
});
