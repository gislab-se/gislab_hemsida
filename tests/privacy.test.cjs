const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts/privacy.js'), 'utf8');

function setup(hasControls = true) {
  const show = { addEventListener: (_, fn) => { show.click = fn; } };
  const hide = { addEventListener: (_, fn) => { hide.click = fn; } };
  const status = {};
  const host = { hidden: true, querySelector: selector => ({ '[data-map-enable]': show, '[data-map-disable]': hide, '[data-map-status]': status })[selector] };
  const context = { window: {}, document: { querySelector: () => hasControls ? host : null, getElementById: () => null } };
  vm.runInNewContext(source, context);
  return { api: context.window.GISLabPrivacy, show, hide, status, host };
}

test('Leaflet makes no external layer active until an explicit choice and removes it on withdrawal', () => {
  const { api, show, hide, status, host } = setup();
  let active = false;
  const layer = { addTo: () => { active = true; } };
  api.bindLeaflet(layer, { removeLayer: () => { active = false; } });
  assert.equal(active, false);
  assert.equal(host.hidden, false);
  show.click();
  assert.equal(active, true);
  assert.equal(show.disabled, true);
  hide.click();
  assert.equal(active, false);
  assert.equal(hide.disabled, true);
  assert.equal(status.textContent, 'Extern bakgrund av');
});

test('MapLibre adds the background beneath local data and removes its source on withdrawal', () => {
  const { api, show, hide } = setup();
  let source, layer, before;
  const map = {
    isStyleLoaded: () => true,
    getSource: () => source,
    getLayer: () => layer,
    addSource: (_, value) => { source = value; },
    getStyle: () => ({ layers: [{ id: 'background', type: 'background' }, { id: 'population', type: 'fill' }] }),
    addLayer: (value, id) => { layer = value; before = id; },
    removeLayer: () => { layer = undefined; },
    removeSource: () => { source = undefined; }
  };
  api.bindMapLibre(map, { 'raster-opacity': .72 });
  assert.equal(source, undefined);
  show.click();
  assert.equal(before, 'population');
  assert.equal(source.tiles[0], 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  hide.click();
  assert.equal(source, undefined);
  assert.equal(layer, undefined);
  show.click();
  assert.ok(source);
});

test('missing choice controls keep the external map disabled', () => {
  const { api } = setup(false);
  api.bindLeaflet({ addTo: () => assert.fail('External map enabled without controls') }, {});
});

test('MapLibre waits for the local style before installing the choice controls', () => {
  const { api, host } = setup();
  let ready;
  api.bindMapLibre({ isStyleLoaded: () => false, once: (event, callback) => { assert.equal(event, 'load'); ready = callback; } }, {});
  assert.equal(host.hidden, true);
  ready();
  assert.equal(host.hidden, false);
});

test('public pages contain privacy information and no automatically loaded third-party resources', () => {
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor') continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(html|css)$/.test(file)) {
        const content = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(content, /(?:href|src)="https:\/\/fonts\.(?:googleapis|gstatic)\.com|@import\s*["']https?:/i, file);
        assert.doesNotMatch(content, /<(?:iframe|script|img)\b[^>]*\bsrc=["']https?:/i, file);
        if (entry.name === 'index.html' && !file.includes('klimatinitiativet')) {
          assert.match(content, /href="\/(?:integritet|en\/privacy)\//, file);
        }
      }
    }
  }
  walk(root);
});
