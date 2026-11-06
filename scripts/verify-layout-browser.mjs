// Run npm run build and npm start, then node scripts/verify-layout-browser.mjs.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const dir = new URL('../work/screenshots', import.meta.url).pathname;
await mkdir(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
const report = [];
try {
  const page = await browser.newPage();
  await page.emulateTimezone('America/Chicago');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setRequestInterception(true);
  page.on('request', req => new URL(req.url()).hostname === '127.0.0.1' || req.url().startsWith('data:') || req.url().startsWith('blob:') ? req.continue() : req.abort());
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.profile-welcome');
  assert.match(await page.$eval('h1', e=>e.textContent), /Huntrr Organizer/);
  await page.screenshot({path:dir+'/login.png'});
  await page.type('#welcome-nickname', 'Layout QA');
  await page.click('.profile-welcome .profile-primary');
  await page.waitForSelector('.planner-welcome');
  for (const [name,width,height] of [['desktop',1440,1000],['iphone',390,844],['ipad',820,1180]]) {
    await page.setViewport({ width, height });
    for (const route of ['agenda','month','log','habits','goals_streaks','notes','jobs','reminders','pinterest','printing','minifurniture','keychains','models','wiki','blog','receipts','shopping','settings']) {
      await page.evaluate(route=>{location.hash=route;},route);
      await page.waitForFunction(route=>document.querySelector('.planner-page')?.dataset.page===route,{},route);
      await new Promise(r=>setTimeout(r,250));
      const state = await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth>innerWidth+2,
        bodyBackground:getComputedStyle(document.body).backgroundColor,
        colorScheme:getComputedStyle(document.documentElement).colorScheme,
        error:document.body.textContent.includes('Something went wrong'),
        dark:[...document.querySelectorAll('main,section,div,nav,header,aside,input,textarea,button')].filter(e=>{
          const r=e.getBoundingClientRect();if(r.width<40||r.height<25||r.bottom<0||r.top>innerHeight)return false;
          const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden')return false;
          if(!c.backgroundColor.startsWith('rgb'))return false;
          const rgb=c.backgroundColor.match(/[\d.]+/g)?.map(Number);return rgb?.length>=3&&(rgb.length<4||rgb[3]>.5)&&Math.max(...rgb.slice(0,3))<130;
        }).map(e=>({tag:e.tagName,cls:e.className,bg:getComputedStyle(e).backgroundColor})).slice(0,10)
      }));
      report.push({name,route,...state});
      if (['agenda','notes','settings'].includes(route)) await page.screenshot({path:dir+`/${name}-${route}.png`});
    }
  }
  assert.equal(report.filter(x=>x.overflow||x.error||x.dark.length).length,0,'layout/theme failures');
  assert.deepEqual(errors,[],'uncaught browser errors');
  await writeFile('work/browser-report.json',JSON.stringify({report,errors},null,2));
  console.log(JSON.stringify({pages:report.length,overflow:report.filter(x=>x.overflow),dark:report.filter(x=>x.dark.length),routeErrors:report.filter(x=>x.error),errors},null,2));
} finally { await browser.close(); }
