// (T)rustyShelf's museum lighting and fog visibility test (issue 30). Run: node linux/ci/museum-lighting-test.js
'use strict';
const fs = require('fs');
const path = require('path');

let fails = 0;
const check = (name, ok, detail) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500)));
  if (!ok) fails++;
};

const srcPath = path.join(__dirname, '..', '..', 'renderer', 'museum.js');
const androidPath = path.join(__dirname, '..', '..', 'android-app', 'www', 'museum.js');

const src = fs.readFileSync(srcPath, 'utf8');
const androidSrc = fs.readFileSync(androidPath, 'utf8');

check('android museum.js matches renderer museum.js', src === androidSrc);

// Extract LIGHTS definition
const lightsMatch = src.match(/const LIGHTS = \{([\s\S]*?)\n  \};/);
check('LIGHTS table exists in museum.js', !!lightsMatch);

if (lightsMatch) {
  const lightsFn = new Function(`return {${lightsMatch[1]}};`);
  const LIGHTS = lightsFn();

  check('Classic (gallery) ambient >= 0.2', LIGHTS.gallery.amb >= 0.2, LIGHTS.gallery.amb);
  check('Classic (gallery) fill >= 0.35', LIGHTS.gallery.fill >= 0.35, LIGHTS.gallery.fill);
  check('Spotlit gallery ambient >= 0.08', LIGHTS.spotlit.amb >= 0.08, LIGHTS.spotlit.amb);
  check('Spotlit gallery fill >= 0.3', LIGHTS.spotlit.fill >= 0.3, LIGHTS.spotlit.fill);
  check('Evening (night) ambient >= 0.1', LIGHTS.night.amb >= 0.1, LIGHTS.night.amb);
  check('Neon night ambient >= 0.08', LIGHTS.neon.amb >= 0.08, LIGHTS.neon.amb);
}

// Check fog distance settings
check('Initial scene.fog has near >= 24 and far >= 80', /scene\.fog\s*=\s*new THREE\.Fog\(0x05060a,\s*28,\s*90\)/.test(src));
check('Dynamic fog near has minimum near >= 28', /fn\s*=\s*Math\.max\(28,\s*d\s*\+\s*14\)/.test(src));
check('Dynamic fog far extends by at least 60 units', /scene\.fog\.far\s*=\s*fn\s*\+\s*60/.test(src));

// Check wide view fill lift
check('Fill light lifted in wide/intro view', /wide\s*\|\|\s*intro\.on\s*\?\s*1\.4\s*:\s*1/.test(src));

// Check evenFill baseline
check('evenFill k0 baseline is >= 0.25', /k0\s*=\s*0?\.26/.test(src));

// Check environmentIntensity baseline
check('environmentIntensity baseline has lifted lit factor', /0?\.06\s*\+\s*0?\.22\s*\*\s*lit/.test(src));

console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
