import { chromium } from '@playwright/test';
const browser = await chromium.launch({channel:'msedge'});
try {
  const page = await browser.newPage({viewport:{width:390,height:900}});
  await page.goto('http://127.0.0.1:5197/#/home');
  await page.getByRole('button', {name:'Open navigation'}).click();
  await page.getByRole('navigation').getByRole('link',{name:'About us'}).click();
  await page.waitForTimeout(1200);
  const measure = () => page.evaluate(()=>({scrollY, title:document.querySelector('h1').getBoundingClientRect().top,header:document.querySelector('header').getBoundingClientRect().toJSON()}));
  console.log('Before screenshot', await measure());
  await page.screenshot({path:'.taste-skill/route-about.png'});
  console.log('After screenshot', await measure());
  await page.reload();
  await page.waitForTimeout(1200);
  await page.screenshot({path:'.taste-skill/direct-about.png'});
  console.log('Direct load', await measure());
} finally { await browser.close(); }
