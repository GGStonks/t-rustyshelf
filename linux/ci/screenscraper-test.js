// ScreenScraper credentials and developer login fallback. Run: node linux/ci/screenscraper-test.js
'use strict';
const path = require('path');
const ss = require(path.join(__dirname, '..', '..', 'main', 'screenscraper.js'));

let fails = 0;
const check = (name, ok, detail) => {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + JSON.stringify(detail)));
  if (!ok) fails++;
};

// 1. Developer password provided with blank developer ID: falls back to username
ss.init({
  creds: () => ({ user: 'retrofan', pass: 'secret1', devId: '', devPass: 'devsecret' }),
  log: () => {}
});
let url = ss._t.apiUrl('jeuInfos.php', { romnom: 'game.iso' });
let u = new URL(url);
check('Developer login fallback: devid defaults to username when devPass is set', u.searchParams.get('devid') === 'retrofan', url);
check('Developer login fallback: devpassword is included', u.searchParams.get('devpassword') === 'devsecret', url);
check('Developer login fallback: ssid is user', u.searchParams.get('ssid') === 'retrofan', url);
check('Developer login fallback: state reports devLogin is true', ss.state().devLogin === true, ss.state());

// 2. Explicit developer ID provided
ss.init({
  creds: () => ({ user: 'retrofan', pass: 'secret1', devId: 'customdev', devPass: 'devsecret' }),
  log: () => {}
});
url = ss._t.apiUrl('jeuInfos.php', { romnom: 'game.iso' });
u = new URL(url);
check('Explicit devid: uses provided devId', u.searchParams.get('devid') === 'customdev', url);
check('Explicit devid: devpassword is included', u.searchParams.get('devpassword') === 'devsecret', url);

// 3. Only developer ID and developer password provided
ss.init({
  creds: () => ({ user: '', pass: '', devId: 'devonly', devPass: 'devpassonly' }),
  log: () => {}
});
check('Only dev credentials: configured is true', ss.configured() === true);
check('Only dev credentials: state reports devLogin is true', ss.state().devLogin === true);
url = ss._t.apiUrl('jeuInfos.php', { romnom: 'game.iso' });
u = new URL(url);
check('Only dev credentials: ssid defaults to devId', u.searchParams.get('ssid') === 'devonly', url);
check('Only dev credentials: sspassword defaults to devPass', u.searchParams.get('sspassword') === 'devpassonly', url);
check('Only dev credentials: devid is included', u.searchParams.get('devid') === 'devonly', url);
check('Only dev credentials: devpassword is included', u.searchParams.get('devpassword') === 'devpassonly', url);

// 4. No developer credentials
ss.init({
  creds: () => ({ user: 'retrofan', pass: 'secret1', devId: '', devPass: '' }),
  log: () => {}
});
url = ss._t.apiUrl('jeuInfos.php', { romnom: 'game.iso' });
u = new URL(url);
check('No developer credentials: devid omitted', u.searchParams.get('devid') == null, url);
check('No developer credentials: devpassword omitted', u.searchParams.get('devpassword') == null, url);

// 5. No credentials
ss.init({
  creds: () => ({}),
  log: () => {}
});
check('No credentials: not configured', ss.configured() === false);

console.log(fails ? `${fails} check(s) failed` : 'all passed');
process.exit(fails ? 1 : 0);
