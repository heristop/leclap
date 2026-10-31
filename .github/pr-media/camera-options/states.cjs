const { chromium } = require(process.cwd() + '/apps/leclap-web/node_modules/@playwright/test');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  for (const width of [390, 1440]) {
    const p = await b.newPage({
      viewport: { width, height: width === 390 ? 844 : 900 },
      permissions: ['camera', 'microphone'],
      reducedMotion: 'reduce',
    });
    await p.goto('http://127.0.0.1:5412/');
    await p.getByRole('button', { name: 'Try it in your browser', exact: true }).click();
    await p.getByRole('button', { name: 'Create my intro', exact: true }).click();
    await p.getByRole('button', { name: 'Record an intro with your camera', exact: true }).click();
    const g = p.getByRole('group', { name: 'Video source', exact: true });
    await g.getByRole('button', { name: 'Screen', exact: true }).click();
    await p.getByRole('heading', { name: 'Record your screen', exact: true }).waitFor();
    await p.screenshot({ path: `build/pr/camera-options/screen-${width}.png` });
    await g.getByRole('button', { name: 'Upload', exact: true }).click();
    await p.getByRole('heading', { name: 'Choose a video to use', exact: true }).waitFor();
    await p.screenshot({ path: `build/pr/camera-options/upload-${width}.png` });
    const chooser = p.waitForEvent('filechooser');
    await p.getByRole('button', { name: 'Choose a video', exact: true }).click();
    await (await chooser).setFiles('apps/leclap-web/public/videos/drink-and-coffee.mp4');
    await p.locator('video[src^="blob:"]').waitFor();
    await p.waitForTimeout(800);
    await p.screenshot({ path: `build/pr/camera-options/review-${width}.png` });
    await p.close();
  }
  await b.close();
})();
