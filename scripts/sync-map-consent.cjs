// Sync the shared consent implementation to the two original source projects.
// Usage: node scripts/sync-map-consent.cjs <stockholm-3d root> <Anderslov root>
// Narrow, idempotent changes preserve unrelated source work. No commit or publish.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const [stockholm,agro]=process.argv.slice(2).map(p=>path.resolve(p));
if(!stockholm||!agro)throw Error('Supply both source project roots.');
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>{if(!fs.existsSync(p)||read(p)!==s){fs.writeFileSync(p,s);console.log(path.relative(path.dirname(p),p)+' updated in '+path.dirname(p));}};
const replace=(s,from,to)=>{if(!s.includes(from))throw Error('Expected source anchor missing: '+from.slice(0,90));return s.replace(from,to);};
const sharedJS=read(path.join(root,'scripts/map-consent.js')),sharedCSS=read(path.join(root,'assets/map-consent.css'));
function head(html,tool,name){
  if(html.includes('data-map-tool='))return html;
  html=replace(html,'<body','<body data-map-tool="'+tool+'" data-map-name="'+name+'"');
  return replace(html,'</head>','<meta name="referrer" content="strict-origin-when-cross-origin">\n<link rel="stylesheet" href="map-consent.css">\n<script src="map-consent.js"></script>\n</head>');
}
// Stockholm is maintained as a buildless dist directory, including its source JS.
for(const filename of ['explorer.js','app.js']){
  const file=path.join(stockholm,'dist',filename);let js=read(file);
  if(!js.includes('GISLabPrivacy?.bindMapLibre')){
    const match=js.match(/sources:\{basemap:\{type:'raster',tiles:\['https:\/\/tile\.openstreetmap\.org[^\n]+?\}\},layers:\[\{id:'background',type:'background',paint:\{[^}]+\}\},\{id:'basemap',type:'raster',source:'basemap',paint:(\{[^}]+\})\}\]/);
    if(!match)throw Error('Stockholm raster style not recognized: '+filename);
    const paint=match[1];
    js=js.replace(match[0],"sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#0a1522'}}]");
    const anchor=js.match(/window\.stockholmMap\s*=\s*map;/)?.[0];if(!anchor)throw Error('Missing map anchor');
    js=js.replace(anchor,anchor+'\n  window.GISLabPrivacy?.bindMapLibre(map,'+paint+');');
  }
  write(file,js);
}
write(path.join(stockholm,'dist/index.html'),head(read(path.join(stockholm,'dist/index.html')),'stockholm-torsboda','Stockholm × Torsboda'));
for(const [name,content]of [['map-consent.js',sharedJS],['map-consent.css',sharedCSS]])write(path.join(stockholm,'dist',name),content);

function background(js){
  if(js.includes('bindLeafletChoices'))return js;
  js=replace(js,"$('basemap').onchange = () => {",'const setBackground = (background) => {');
  js=replace(js,"if($('basemap').value==='none')return;",'if(!background)return;');
  js=replace(js,"if($('basemap').value==='osm'","if(background==='osm'");
  js=replace(js,"const choice=backgrounds[$('basemap').value]",'const choice=backgrounds[background]');
  return replace(js,'  const download =',"  window.GISLabPrivacy?.bindLeafletChoices(map, $('basemap'), setBackground);\n  const download =");
}
const published=read(path.join(root,'lab/agroforestry/index.html'));
const saveBlock=published.slice(published.indexOf('  const persist='),published.indexOf('  const showHandles='));
const saveControls=published.match(/<div class="buttons"><button type="button" id="save-planting-local"[\s\S]*?<p id="planting-save-note"[^>]*>[^<]*<\/p>/)?.[0];
if(!saveControls||!saveBlock)throw Error('Missing published explicit-save controls');
function planting(js){
  if(js.includes("$('save-planting-local').onclick"))return js;
  js=js.replace(/^.*try \{const saved=JSON\.parse\(localStorage\.getItem\(key\)\).*\r?\n/m,'');
  return js.replace(/  const persist=\(\)=>\{[^\n]+\r?\n/,saveBlock);
}
function controls(html){
  if(html.includes('id="save-planting-local"'))return html;
  return replace(html,html.match(/<p id="planting-save-note"[^>]*>[^<]*<\/p>/)[0],saveControls);
}
write(path.join(agro,'map/property_app.js'),background(read(path.join(agro,'map/property_app.js'))));
write(path.join(agro,'map/planting_app.js'),planting(read(path.join(agro,'map/planting_app.js'))));
write(path.join(agro,'map/property_template.html'),controls(head(read(path.join(agro,'map/property_template.html')),'agroforestry','Agroforestry')));
write(path.join(agro,'map/sorby_plantering.html'),controls(planting(background(head(read(path.join(agro,'map/sorby_plantering.html')),'agroforestry','Agroforestry')))));
for(const [name,content]of [['map-consent.js',sharedJS],['map-consent.css',sharedCSS]])write(path.join(agro,'map',name),content);
const publish=path.join(agro,'scripts/prepare_agroforestry_publication.cjs');let script=read(publish);
if(!script.includes("['map-consent.js','map-consent.css']")){
  script=script.replace(/^html=html\.replace\('<\/body>',`<script>document\.getElementById\('basemap'\).*\r?\n/m,'');
  script=replace(script,"fs.writeFileSync(path.join(folder,'index.html'),html,'utf8');","for(const asset of ['map-consent.js','map-consent.css'])fs.copyFileSync(path.join(root,'map',asset),path.join(folder,asset));\nfs.writeFileSync(path.join(folder,'index.html'),html,'utf8');");
}
write(publish,script);
for(const sourceRoot of [stockholm,agro]){
 const file=path.join(sourceRoot,'README.md');let text=read(file);
 if(!text.includes('GISLab map consent (2026-11-04)'))text+='\n\n## GISLab map consent (2026-11-04)\n\nThe shared `map-consent.js` and `map-consent.css` come from `gislab-se/gislab_hemsida` (`scripts/` and `assets/`). Sync with `node scripts/sync-map-consent.cjs <stockholm-3d root> <Anderslov root>` in that repository after shared changes. Publish these assets with the app. External backgrounds stay off until an explicit or valid saved yes. Yes and no expire after 180 days and are scoped by tool, provider and information version. Keep the first-visit dialog, keyboard handling and provider confirmation in future builds. Run the website’s `tests/map-consent.browser.cjs` before publication.\n';
 write(file,text);
}
