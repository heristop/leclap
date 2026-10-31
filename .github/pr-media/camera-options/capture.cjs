const { chromium } = require(process.cwd() + '/apps/leclap-web/node_modules/@playwright/test');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  for (const width of [390, 1440]) {
    const c = await b.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      permissions: ['camera', 'microphone'],
      recordVideo: { dir: 'build/pr/camera-options/raw', size: { width: 1024, height: 768 } },
    });
    const p = await c.newPage();
    await p.goto('http://127.0.0.1:5412/');
    await p.getByRole('button', { name: 'Try it in your browser', exact: true }).click();
    await p.getByRole('button', { name: 'Create my intro', exact: true }).click();
    await p.getByRole('button', { name: 'Record an intro with your camera', exact: true }).click();
    await p.getByRole('button', { name: 'Front', exact: true }).waitFor();
    await p.waitForTimeout(2000);
    await p.screenshot({ path: `build/pr/camera-options/${process.env.PHASE}-${width}.png` });
    await c.close();
    await p.video().saveAs(`build/pr/camera-options/${process.env.PHASE}-${width}.webm`);
  }
  await b.close();
})();
