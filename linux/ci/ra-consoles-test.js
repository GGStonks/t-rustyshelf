// RetroAchievements on the desktop covers the same consoles as on Android (upstream beta.11 widened the desktop's list
// from GameCube, Wii, PSP and PS2 to every console RA covers). Run: node linux/ci/ra-consoles-test.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + JSON.stringify(detail))); if (!ok) fails++; };
const desk = require(path.join(ROOT, 'main', 'ra.js')).CONSOLE_ID;
const src = fs.readFileSync(path.join(ROOT, 'android-app', 'web-extras', 'android-ra.js'), 'utf8');
const m = /const CONSOLE_ID = (\{[\s\S]*?\});/.exec(src), droid = m ? Function('return ' + m[1])() : {};
check('Android\'s list was read', Object.keys(droid).length > 20, Object.keys(droid).length);
const diff = [...new Set([...Object.keys(desk), ...Object.keys(droid)])].filter(k => desk[k] !== droid[k]).map(k => `${k}: desktop ${desk[k]}, Android ${droid[k]}`);
check('The desktop and Android have the same consoles, with the same RA ids', !diff.length, diff);
check('The retro consoles are covered on the desktop (NES, PlayStation, Neo Geo Pocket, WonderSwan)', desk.nes === 7 && desk.psx === 12 && desk.ngp === 14 && desk.wonderswan === 53, desk);
check('Consoles RA doesn\'t cover have no list (Switch, Wii U, 3DS, PS3, Xbox 360, DOS)', ['sw', 'wiiu', 'n3ds', 'ps3', 'x360', 'dos'].every(k => !(k in desk)));
console.log(fails ? `\n${fails} failed` : '\nAll passed'); process.exit(fails ? 1 : 0);
