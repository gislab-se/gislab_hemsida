// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
// MAP_TEST_ORIGIN defaults to the local preview. MAP_TEST_LIVE=1 uses real tiles.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.MAP_TEST_ORIGIN || 'http://127.0.0.1:8876';
const live = process.env.MAP_TEST_LIVE === '1';
const lifetime = 180 * 86400000;
const output = process.env.MAP_TEST_OUTPUT;
const report = { origin, live, results: [] };
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mNkAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
const tileHost = host => ['tile.openstreetmap.org','server.arcgisonline.com','clarity.maptiles.arcgis.com'].includes(host);
let browser;
const record = (name, details={}) => { report.results.push({name,...details}); console.log('PASS',name); };
async function fixture(tool, seed, blocked, viewport={width:1440,height:1000}) {
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
  if(!live) await context.route('**/*', route => {
    const u=new URL(route.request().url());
    return tileHost(u.hostname) ? route.fulfill({status:200,contentType:'image/png',body:pixel}) : route.continue();
  });
  const key='gislab:'+tool+':map-background';
  await context.addInitScript(({key,seed,blocked})=>{
    if(seed!==undefined && !sessionStorage.getItem('seeded')) {
      localStorage.setItem(key,typeof seed==='string'?seed:JSON.stringify(seed));
      sessionStorage.setItem('seeded','1');
    }
    if(blocked) for(const method of ['getItem','setItem','removeItem']) Storage.prototype[method]=()=>{throw new DOMException('Blocked','SecurityError');};
  },{key,seed,blocked});
  const page=await context.newPage(), tiles=[], tileResponses=[], external=[], errors=[], failures=[];
  page.on('request',r=>{const u=new URL(r.url());if(tileHost(u.hostname))tiles.push(r.url());if(/^https?:/.test(u.protocol)&&u.origin!==origin)external.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});if(tileHost(new URL(r.url()).hostname))tileResponses.push({url:r.url(),status:r.status()});});
  page.on('requestfailed',r=>{if(!/ABORTED|CANCELLED/i.test(r.failure()?.errorText||''))failures.push({url:r.url(),error:r.failure()?.errorText});});
  const response=await page.goto(origin+'/lab/'+tool+'/');
  assert.equal(response.status(),200);
  await page.locator('[data-map-settings]').waitFor();
  return {context,page,key,tiles,tileResponses,external,errors,failures,close:async()=>{
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);await context.close();
  }};
}
const modal=p=>p.locator('[data-map-privacy]');
const stored=f=>f.page.evaluate(k=>JSON.parse(localStorage.getItem(k)),f.key);
const opened=async p=>assert.equal(await modal(p).evaluate(d=>d.open),true);
const closed=async p=>assert.equal(await modal(p).evaluate(d=>d.open),false);
const settle=p=>p.waitForTimeout(live?1200:180);
async function tileResponse(f,after=0){const end=Date.now()+20000;while(f.tileResponses.length<=after&&Date.now()<end)await f.page.waitForTimeout(100);assert.ok(f.tileResponses.slice(after).some(r=>r.status===200),'Successful map image response');}
async function reload(f){await f.page.reload();await f.page.locator('[data-map-settings]').waitFor();await settle(f.page);}
function saved(tool,enabled=true){const now=Date.now();return {version:1,tool,providers:[tool==='agroforestry'?'esri':'osm'],background:tool==='agroforestry'?'imagery':'osm',enabled,savedAt:now,expiresAt:now+lifetime};}
async function zoom(f){
  if(await f.page.locator('.leaflet-control-zoom-in').count())await f.page.locator('.leaflet-control-zoom-in').click();
  else await f.page.evaluate(()=>window.stockholmMap.zoomIn({duration:0}));
  await settle(f.page);
}
(async()=>{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const tool of ['stockholm-torsboda','agroforestry']){
    const f=await fixture(tool),p=f.page;
    await opened(p);await settle(p);assert.equal(f.external.length,0);
    assert.equal(await p.locator('h2#map-privacy-title').evaluate(e=>e===document.activeElement),true);
    await p.keyboard.press('Escape');await closed(p);assert.equal(await stored(f),null);
    assert.equal(await p.locator('[data-map-settings]').evaluate(e=>e===document.activeElement),true);
    await p.locator('[data-map-settings]').click();
    await p.locator('[data-map-close]').click();assert.equal(await stored(f),null);
    await p.locator('[data-map-settings]').click();
    for(let i=0;i<14;i++){await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>!!document.activeElement.closest('dialog')),true);}
    await p.locator('[data-map-disable]').click();
    assert.equal((await stored(f)).enabled,false);
    await reload(f);await closed(p);assert.equal(f.external.length,0);
    await zoom(f);assert.equal(f.external.length,0);
    record(tool+': first visit, Escape, close, focus trap, saved no, map without background');
    await p.locator('[data-map-settings]').click();await p.locator('[data-map-enable]').click();
    await p.waitForFunction(()=>document.querySelector('[data-map-status]').textContent==='Bakgrund på');await settle(p);
    assert.ok(f.tiles.length>0);await tileResponse(f);const choice=await stored(f);assert.equal(choice.enabled,true);assert.equal(choice.expiresAt-choice.savedAt,lifetime);
    const beforeReload=f.tiles.length;await reload(f);await closed(p);assert.ok(f.tiles.length>beforeReload);
    await p.locator('[data-map-settings]').click();await p.locator('[data-map-close]').click();assert.deepEqual(await stored(f),choice);
    await p.locator('[data-map-settings]').click();await p.keyboard.press('Escape');assert.deepEqual(await stored(f),choice);
    await p.locator('[data-map-settings]').click();await p.locator('[data-map-disable]').click();
    await settle(p);const withdrawn=f.tiles.length;await zoom(f);assert.equal(f.tiles.length,withdrawn);
    await reload(f);await closed(p);assert.equal(f.tiles.length,withdrawn);assert.equal((await stored(f)).enabled,false);
    record(tool+': consent, saved yes, unchanged choice on close/Escape, withdrawal stops tile requests',{hosts:[...new Set(f.tiles.map(u=>new URL(u).hostname))],requests:f.tiles.length,successfulResponses:f.tileResponses.filter(r=>r.status===200).length});
    await f.close();

    const invalids={expired:{savedAt:Date.now()-lifetime-2000,expiresAt:Date.now()-2000},oldVersion:{version:0},wrongTool:{tool:'klimatverkstad'},wrongProvider:{providers:['unrelated']},extraProvider:{providers:['osm','esri']},wrongType:{enabled:'true'},future:{savedAt:Date.now()+86400000,expiresAt:Date.now()+86400000+lifetime},invalidDuration:{expiresAt:Date.now()+2*lifetime},unknownBackground:{background:'unknown'}};
    for(const [label,change]of Object.entries(invalids)){
      const f=await fixture(tool,{...saved(tool),...change});await opened(f.page);await settle(f.page);assert.equal(f.external.length,0);assert.equal(await stored(f),null);await f.close();
      record(tool+': rejects '+label);
    }
    const malformed=await fixture(tool,'{bad json');await opened(malformed.page);assert.equal(malformed.external.length,0);await malformed.close();record(tool+': malformed JSON');
    const b=await fixture(tool,undefined,true);await opened(b.page);assert.equal(b.external.length,0);
    await b.page.locator('[data-map-enable]').click();await settle(b.page);assert.ok(b.tiles.length>0);
    assert.match(await b.page.locator('[data-map-storage-status]').textContent(),/bara under/);
    await b.page.locator('[data-map-settings]').click();await b.page.locator('[data-map-disable]').click();await settle(b.page);
    const count=b.tiles.length;await zoom(b);assert.equal(b.tiles.length,count);await reload(b);await opened(b.page);assert.equal(b.tiles.length,count);await b.close();record(tool+': blocked storage still allows yes and withdrawal for this visit');
    const w=await fixture(tool,saved(tool));await closed(w.page);await w.page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('quota')};});
    await w.page.locator('[data-map-settings]').click();await w.page.locator('[data-map-disable]').click();assert.equal(await stored(w),null);await reload(w);await opened(w.page);await w.close();record(tool+': failed withdrawal write removes old yes');

    for(const viewport of [{width:320,height:700},{width:390,height:844},{width:1440,height:1000}]){
      const f=await fixture(tool,undefined,false,viewport),p=f.page;
      await opened(p);
      assert.ok(await modal(p).evaluate(e=>e.scrollWidth<=e.clientWidth+1));
      const yes=p.locator('[data-map-enable]'),no=p.locator('[data-map-disable]');
      const y=await yes.boundingBox(),n=await no.boundingBox();assert.equal(Math.round(y.width),Math.round(n.width));assert.ok(y.height>=44&&n.height>=44);
      assert.ok(y.y>=0&&y.y+y.height<=viewport.height&&n.y>=0&&n.y+n.height<=viewport.height,'Both choices visible before scrolling');
      await no.focus();await p.keyboard.press('Enter');await closed(p);
      const box=await p.locator('[data-map-settings]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0&&box.y+box.height<=viewport.height);
      assert.equal(await p.locator('[data-map-settings]').evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
      for(const selector of ['.leaflet-control-zoom','.maplibregl-ctrl-group','#settings-reopen','#activate-presentation'])for(const element of await p.locator(selector).all()){
        if(!await element.isVisible())continue;const r=await element.boundingBox();assert.ok(r.x+r.width<=box.x||r.x>=box.x+box.width||r.y+r.height<=box.y||r.y>=box.y+box.height,tool+' overlap '+selector);
      }
      if(output){fs.mkdirSync(output,{recursive:true});await p.screenshot({path:path.join(output,tool+'-'+viewport.width+'.png')});await p.locator('[data-map-settings]').click();await p.screenshot({path:path.join(output,tool+'-dialog-'+viewport.width+'.png')});}
      await f.close();record(tool+': keyboard and unobstructed controls '+viewport.width+'px');
    }
  }
  const a=await fixture('agroforestry'),p=a.page;
  await p.locator('[data-map-background]').selectOption('osm');assert.match(await p.locator('[data-map-provider]').textContent(),/OpenStreetMap Foundation/);assert.equal(a.external.length,0);
  await p.locator('[data-map-enable]').click();await settle(p);
  assert.ok(a.tiles.every(u=>new URL(u).hostname==='tile.openstreetmap.org'));
  await p.locator('#basemap').selectOption('imagery');await opened(p);await settle(p);
  assert.ok(a.tiles.every(u=>new URL(u).hostname==='tile.openstreetmap.org'));
  await p.keyboard.press('Escape');assert.equal(await p.locator('#basemap').inputValue(),'osm');assert.deepEqual((await stored(a)).providers,['osm']);
  for(const id of ['imagery','clarity','topo','streets','gray']){
    await p.locator('#basemap').selectOption(id);await opened(p);assert.match(await p.locator('[data-map-provider]').textContent(),/Esri/);
    const before=a.tileResponses.length;await p.locator('[data-map-enable]').click();await settle(p);await tileResponse(a,before);assert.equal((await stored(a)).background,id);assert.deepEqual((await stored(a)).providers,['esri']);
  }
  assert.ok(a.tiles.some(u=>new URL(u).hostname==='clarity.maptiles.arcgis.com'));
  await p.locator('#basemap').selectOption('none');assert.equal((await stored(a)).enabled,false);
  record('Agroforestry: all six backgrounds, provider change requires confirmation, cancel preserves OSM, direct none withdraws',{hosts:[...new Set(a.tiles.map(u=>new URL(u).hostname))]});await a.close();

  for(const slug of ['havsniva-klimatanpassning','salenfjallen-3d','vattenforbrukning']){
    const c=await browser.newContext(),p=await c.newPage(),external=[],errors=[];p.on('request',r=>{const u=new URL(r.url());if(/^https?:/.test(u.protocol)&&u.origin!==origin)external.push(r.url());});p.on('pageerror',e=>errors.push(e.message));
    await p.goto(origin+'/lab/'+slug+'/');await p.waitForTimeout(1500);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.equal(await p.locator('[data-map-privacy]').count(),0);await c.close();record(slug+': own resources only, no consent dialog');
  }
})().then(()=>{report.passed=true;}).catch(e=>{report.passed=false;report.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}await browser?.close();});
