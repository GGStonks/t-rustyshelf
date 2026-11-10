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

// 7. Check Switch transparency and spine frame on shelf
const styleCss = fs.readFileSync(path.join(__dirname, '..', '..', 'renderer', 'style.css'), 'utf8');
const setupCss = fs.readFileSync(path.join(__dirname, '..', '..', 'renderer', 'setup.css'), 'utf8');
check('Switch STYLE has transparent caseSide', /sw:\s*\{[^}]*caseSide:\s*"rgba\(/.test(appSrc));
check('Shelf f-left has edge padding for top/bottom spine frame', /\.f-left\{[^}]*padding-top:\s*var\(--edge\)[^}]*padding-bottom:\s*var\(--edge\)/.test(styleCss));
check('Shelf spine-img respects top and bottom edge inset', /\.f-left\s+\.spine-img[^\{]*\{[^}]*top:\s*var\(--edge\)[^}]*bottom:\s*var\(--edge\)/.test(setupCss));



// 8. Check 3D dual living hinge model and transparency in Inspect3D
const inspect3dSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'renderer', 'inspect3d.js'), 'utf8');
check('Inspect3D has dual-hinge pivots (lidPivot, backPivot, spineG)', /lidPivot[\s\S]*?backPivot[\s\S]*?spineG/.test(inspect3dSrc));
check('Inspect3D handles clear polypropylene transparency', /isClear\s*=\s*o\.sys\s*===\s*["']sw["']/.test(inspect3dSrc) && /transmission:/.test(inspect3dSrc));
check('Inspect3D interiorTexture has clearBg transparent clear mode', /clearBg\s*=\s*sys\s*===\s*["']sw["']/.test(inspect3dSrc));
check('Inspect3D spine has top and bottom structural flap caps', /topCap[\s\S]*?btmCap/.test(inspect3dSrc));
check('Inspect3D spine has two parallel living hinge score line grooves', /groove1[\s\S]*?groove2/.test(inspect3dSrc));
check('Inspect3D back cover has cartridge dock with two retaining tabs', /dockFrame[\s\S]*?tab1[\s\S]*?tab2/.test(inspect3dSrc));
check('Inspect3D lid cover has molded booklet clips', /clip\.position\.set\(-w\s*\/\s*2/.test(inspect3dSrc));
check('Inspect3D opens flat with dual-hinge book kinematics', /lidPivot\.rotation\.y\s*=\s*\(1\s*-\s*k\)\s*\*\s*\(Math\.PI\s*\/\s*2\)/.test(inspect3dSrc) && /backPivot\.rotation\.y\s*=\s*-\(1\s*-\s*k\)\s*\*\s*\(Math\.PI\s*\/\s*2\)/.test(inspect3dSrc));


// 9. Check PC black cuboid model and Universal case.glb integration
check('Inspect3D PC model is black cuboid with front, spine and back covers', /o\.sys\s*===\s*["']pc["'][\s\S]*?BoxGeometry[\s\S]*?caseG\.add\(pcBox\)/.test(inspect3dSrc));
check('Universal case.glb exists in renderer', fs.existsSync(path.join(__dirname, '..', '..', 'renderer', 'case.glb')));
check('Universal case.blend exists in renderer', fs.existsSync(path.join(__dirname, '..', '..', 'renderer', 'case.blend')));
check('Inspect3D uses universal case.glb model', /ensureUniversalModel\(\)[\s\S]*?loadAsync\(["']case\.glb["']\)/.test(inspect3dSrc));

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
