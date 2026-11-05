// Build test frontend only: VITE_SUPABASE_URL=https://organizer-test.invalid VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_browser_fixture node node_modules/vite/bin/vite.js build --outDir work/browser-auth-dist
// Then node scripts/verify-auth-browser.mjs. NEVER deploy the fixture build. No real Supabase calls.
// Deterministic browser integration test. Hosted email/Realtime still require real configuration.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
await mkdir('work/screenshots',{recursive:true});
const root=path.resolve('work/browser-auth-dist');
const server=http.createServer(async(req,res)=>{
  try { const file=path.join(root,req.url.split('?')[0].startsWith('/assets/')?req.url.split('?')[0]:'index.html');
    res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(file));
  } catch {res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(3001,'127.0.0.1',r));
const ids={alice:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',bob:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
const user=name=>({id:ids[name],aud:'authenticated',role:'authenticated',email:name+'@example.com',email_confirmed_at:'2026-01-01T00:00:00Z',confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'});
const token=name=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:ids[name],aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test-signature'].join('.');
const session=name=>({access_token:token(name),refresh_token:name+'-refresh',token_type:'bearer',expires_in:3600,user:user(name)});
const actor=req=>{try{return JSON.parse(Buffer.from(req.headers().authorization.split('.')[1],'base64url')).sub;}catch{return null;}};
const docs=new Map(),files=new Map(),calls=[];
const browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
async function pageFor(){
 const context=await browser.createBrowserContext(),page=await context.newPage();
 await page.setViewport({width:1440,height:1000});
 await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
 await page.setRequestInterception(true);
 page.on('request',async req=>{
  const url=new URL(req.url());if(url.hostname==='127.0.0.1'||req.url().startsWith('data:')||req.url().startsWith('blob:'))return req.continue();
  if(url.hostname!=='organizer-test.invalid')return req.abort();
  calls.push({path:url.pathname,method:req.method()});
  const answer=(body,status=200)=>req.respond({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},body:status===204?undefined:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return answer({});
  const body=req.postData()&&req.headers()['content-type']?.includes('json')?JSON.parse(req.postData()):{};
  if(url.pathname==='/auth/v1/signup')return answer(user('alice'));
  if(url.pathname==='/auth/v1/recover')return answer({});
  if(url.pathname==='/auth/v1/token')return answer(session(body.email?.startsWith('bob')?'bob':'alice'));
  if(url.pathname==='/auth/v1/logout')return answer(null,204);
  if(url.pathname==='/auth/v1/user')return answer(user(actor(req)===ids.bob?'bob':'alice'));
  const owner=actor(req);
  if(url.pathname==='/rest/v1/rpc/planner_apply'){
   if(body.p_owner!==owner)return answer({code:'42501',message:'Denied'},403);
   for(const c of body.p_changes){const key=owner+':'+c.path;const prev=docs.get(key);if((prev?.version??0)!==c.expected)return answer({code:'40001',message:'Conflict'},409);}
   for(const c of body.p_changes)docs.set(owner+':'+c.path,{owner,path:c.path,version:c.expected+1,data:c.data});
   return answer(null,204);
  }
  if(url.pathname==='/rest/v1/planner_documents'){
   let rows=[...docs.values()].filter(r=>r.owner===owner);
   const filters=url.searchParams.getAll('path');
   for(const f of filters){if(f.startsWith('eq.'))rows=rows.filter(r=>r.path===f.slice(3));if(f.startsWith('gte.'))rows=rows.filter(r=>r.path>=f.slice(4));if(f.startsWith('lt.'))rows=rows.filter(r=>r.path<f.slice(3));if(f.startsWith('in.'))rows=rows.filter(r=>f.slice(3).includes(r.path));}
   return answer(rows);
  }
  if(url.pathname.startsWith('/storage/v1/object/')){
   const key=url.pathname.replace('/storage/v1/object/authenticated/','').replace('/storage/v1/object/','');
   if(!key.startsWith('planner-files/'+owner+'/'))return answer({message:'Denied'},403);
   if(req.method()==='POST'){files.set(key,true);return answer({Key:key,Id:'test'});}
   return req.respond({status:200,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XcAAAAASUVORK5CYII=','base64')});
  }
  return answer({message:'Unexpected fixture request: '+url.pathname},404);
 });
 return page;
}
async function clickText(page,text,selector='button'){
 const handle=await page.waitForFunction((text,selector)=>[...document.querySelectorAll(selector)].find(e=>e.textContent.trim()===text),{},text,selector);await handle.asElement().click();
}
async function login(page,name){
 await page.goto('http://127.0.0.1:3001/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('input[type=email]');await page.type('input[type=email]',name+'@example.com');await page.type('input[type=password]','OrganizerTest123!');await page.click('.email-account-primary');await page.waitForSelector('.planner-welcome');
}
const result=[];
try{
 const p=await pageFor();await p.goto('http://127.0.0.1:3001/');await p.waitForSelector('.email-account-card');
 assert.match(await p.$eval('h1',e=>e.textContent),/Huntrr Organizer/);
 await p.screenshot({path:'work/screenshots/email-login.png'});
 await clickText(p,'Create account','.email-account-actions button');
 await p.type('input[type=email]','alice@example.com');
 const passwords=await p.$$('input[type=password]');await passwords[0].type('OrganizerTest123!');await passwords[1].type('OrganizerTest123!');await p.click('.email-account-primary');
 await p.waitForFunction(()=>document.body.textContent.includes('Check your inbox'));result.push('registration request and confirmation feedback');
 await clickText(p,'Back to log in');await clickText(p,'Forgot password?');await p.click('.email-account-primary');
 await p.waitForFunction(()=>document.body.textContent.includes('reset link is on its way'));
 await p.goto('http://127.0.0.1:3001/?code=recovery-fixture');
 await p.waitForFunction(()=>document.querySelector('h2')?.textContent==='Choose a new password');
 const recovery=await p.$$('input[type=password]');await recovery[0].type('UpdatedOrganizer123!');await recovery[1].type('UpdatedOrganizer123!');await p.click('.email-account-primary');
 await p.waitForFunction(()=>document.body.textContent.includes('Password updated'));result.push('PKCE recovery callback and password update');
 await login(p,'alice');
 await p.click('[aria-label="Open notebook"]');await p.waitForSelector('[aria-label="Add note"]');await p.click('[aria-label="Add note"]');await p.waitForSelector('[aria-label="Note content"]');await p.type('[aria-label="Note content"]','Organizer browser sample');
 for(let i=0;i<60&&!docs.get(ids.alice+':preferences/notesData')?.data.notes.some(n=>n.content==='Organizer browser sample');i++)await new Promise(r=>setTimeout(r,100));
 assert.ok(docs.get(ids.alice+':preferences/notesData')?.data.notes.some(n=>n.content==='Organizer browser sample'));result.push('automatic note saving through Supabase HTTP adapter');
 await p.reload();await p.waitForFunction(()=>document.querySelector('[aria-label="Note content"]')?.value==='Organizer browser sample');result.push('refresh restores session and note');
 const second=await pageFor();await login(second,'alice');await second.click('[aria-label="Open notebook"]');await second.waitForFunction(()=>document.querySelector('[aria-label="Note content"]')?.value==='Organizer browser sample');result.push('fresh browser context loads cloud note after login');
 const bob=await pageFor();await login(bob,'bob');await bob.click('[aria-label="Open notebook"]');await bob.waitForSelector('[aria-label="Add note"]');assert.ok(!(await bob.$eval('body',e=>e.textContent)).includes('Organizer browser sample'));result.push('second account renders a separate notebook');
 await p.click('[aria-label="Open settings"]');await p.waitForSelector('.account-settings input[type=file]');
 const fixture={format:'huntrr.organizer',version:1,data:{appointments:{sample:{title:'Organizer sample event',date:'2026-11-05',startTime:'12:00',endTime:'13:00'}},photos:{sample:{url:'idb://photo_sample',name:'Sample photo'}}},files:{photo_sample:{kind:'photo',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XcAAAAASUVORK5CYII='}}};
 await writeFile('work/sample-import.json',JSON.stringify(fixture));await (await p.$('.account-settings input[type=file]')).uploadFile(path.resolve('work/sample-import.json'));await clickText(p,'Confirm import');await p.waitForFunction(()=>document.body.textContent.includes('2 imported and verified'));
 assert.equal(docs.get(ids.alice+':appointments/sample').data.title,'Organizer sample event');assert.match(docs.get(ids.alice+':photos/sample').data.url,/^supabase:\/\//);assert.equal(files.size,1);result.push('reviewed import verifies event and private attachment');
 await clickText(p,'Log out','.account-settings button');await p.waitForSelector('.email-account-card');await login(p,'alice');await p.click('[aria-label="Open notebook"]');await p.waitForFunction(()=>document.querySelector('[aria-label="Note content"]')?.value==='Organizer browser sample');result.push('logout and subsequent login preserve saved note');
 await p.screenshot({path:'work/screenshots/email-account-notes.png'});
 console.log(JSON.stringify({mode:'mocked Supabase HTTP; actual browser application',passed:result,requests:calls.length},null,2));
}catch(error){console.error(error);await writeFile('work/auth-browser-calls.json',JSON.stringify(calls,null,2));throw error;}
finally{await browser.close();await new Promise(r=>server.close(r));}
