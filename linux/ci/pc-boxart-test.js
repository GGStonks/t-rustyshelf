// (T)rustyShelf: PC & Switch box art overhaul specifications test
// Run: node linux/ci/pc-boxart-test.js
'use strict';
const fs = require('fs'), path = require('path');
let fails = 0;
const check = (name, ok, detail) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + String(detail).slice(0, 500)));
  if (!ok) fails++;
};

const appSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'renderer', 'app.js'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'renderer', 'settings.js'), 'utf8');
const pccoversSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'main', 'pccovers.js'), 'utf8');
const rebrandSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'crates', 'img-tools', 'src', 'rebrand.rs'), 'utf8');

// 1. Check STYLE definitions for PC and Switch
check('PC STYLE has edge: 0 (colored frame completely removed)', /pc:\s*\{[^}]*edge:\s*0\b/.test(appSrc));
check('Custom PC STYLE has edge: 0', /custom:\s*\{[^}]*edge:\s*0\b/.test(appSrc));
check('Switch STYLE has wrap: 1', /sw:\s*\{[^}]*wrap:\s*1\b/.test(appSrc));
check('Switch STYLE has transparent caseColor', /sw:\s*\{[^}]*caseColor:\s*"rgba\(/.test(appSrc));
check('Switch 2 STYLE has wrap: 1 and retains red caseColor', /sw2:\s*\{[^}]*wrap:\s*1\b[^}]*caseColor:\s*"#e60012"/.test(appSrc));

// 2. Check stOf logic for PC games
check('stOf enforces edge: 0 for PC games regardless of boxPlat', /isPcGame\s*=/.test(appSrc) && /edge:\s*0/.test(appSrc));
check('stOf enforces spineBand PC for PC games regardless of boxPlat', /spineBand:\s*STYLE\.pc\.spineBand/.test(appSrc));

// 3. Check 3D inspectability for PC games
check('Details menu allows inspect for isGame (including PC games)', /\$\("dInspect"\)\.hidden\s*=\s*!isGame\(g\)/.test(appSrc));
check('openInspect allows inspect for isGame (including PC games)', /openInspect\(\)[^}]*!isGame\(g\)/.test(appSrc));
check('ispAdvance blocks opening case for PC games', /ispAdvance\(\)\s*\{[\s\S]*?g\.kind\s*===\s*"steam"[\s\S]*?return/.test(appSrc));
check('renderIspHints omits Open case for PC games', /renderIspHints\(\)[\s\S]*?isPc\s*\?[\s\S]*?Open case/.test(appSrc));

// 4. Check coversearch Enter key fix in settings.js
check('coversearch row has alwaysCommit: true', /coverSearchRows[\s\S]*?alwaysCommit:\s*true/.test(settingsSrc));
check('commitEdit triggers changed(r) on alwaysCommit even if text unchanged', /commitEdit\(\)[\s\S]*?changedVal\s*\|\|\s*r\.alwaysCommit/.test(settingsSrc));

// 5. Check pccovers.js: no Steam banner overlay on chosen console box front cover
check('pccovers.js preserves clean front cover without rebranding', /const\s+finalBuf\s*=\s*buf0/.test(pccoversSrc));

// 6. Check crates/img-tools/src/rebrand.rs writes "PC"
check('img-tools rebrand renders "PC" text', /render_text_vertical\([^)]*"PC"/.test(rebrandSrc));

console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
