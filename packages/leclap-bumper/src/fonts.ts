import { continueRender, delayRender, staticFile } from 'remotion';

// Load the bundled brand fonts (the same TTFs the engine/web use) so the rendered bumper matches the
// app splash. delayRender holds the render until the FontFace objects are ready.
export const BEBAS = 'LeclapBebasNeue';
export const OSWALD = 'LeclapOswald';

const handle = delayRender('load-brand-fonts');

const load = async (): Promise<void> => {
  const fonts = [
    new FontFace(BEBAS, `url(${staticFile('BebasNeue.ttf')}) format('truetype')`),
    new FontFace(OSWALD, `url(${staticFile('Oswald.ttf')}) format('truetype')`),
  ];

  const loaded = await Promise.all(fonts.map((font) => font.load()));

  for (const font of loaded) {
    document.fonts.add(font);
  }

  continueRender(handle);
};

load().catch(() => {
  continueRender(handle);
});
