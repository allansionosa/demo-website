import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = 'http://127.0.0.1:5197';
const output = '.taste-skill/page-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const checks = [];
try {
  const context = await browser.newContext();
  await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['home', 'services', 'doctors', 'about', 'contact', 'faq', 'privacy', 'portal']) {
      await page.goto(`${origin}/#/${route}`);
      await page.waitForTimeout(1000);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        images: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
        title: document.querySelector('h1')?.textContent,
        titleTop: document.querySelector('h1')?.getBoundingClientRect().top,
        headerBottom: document.querySelector('header')?.getBoundingClientRect().bottom || 0,
      }));
      assert.equal(result.overflow, false, `${route} at ${width}px overflows`);
      assert.equal(result.images, true, `${route} at ${width}px has an unloaded image`);
      assert.ok(result.title, `${route} has no h1`);
      assert.ok(result.titleTop >= result.headerBottom, `${route} title is behind the header at ${width}px`);
      if ([1440, 390].includes(width)) await page.screenshot({ path: `${output}/${route}-${width}.png` });
      checks.push({ route, width, ...result });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${origin}/#/home`);
  const moving = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length);
  assert.equal(moving, 0, 'Reduced motion still animates');
  assert.deepEqual(errors, [], 'Browser runtime errors');
  await page.screenshot({ path: `${output}/home-reduced-motion.png` });
  await writeFile(`${output}/checks.json`, JSON.stringify({ checks, reducedMotionAnimations: moving, errors }, null, 2));
  console.log(`${checks.length} production page/viewport checks passed; reduced motion passed; no runtime errors. All external requests blocked.`);
} finally {
  await browser.close();
}
