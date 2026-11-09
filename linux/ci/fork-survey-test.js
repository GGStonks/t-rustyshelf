// scripts/fork-survey.js and scripts/credits.js on made-up repositories (no network: --offline, the "GitHub" repositories are
// local folders). Run: node linux/ci/fork-survey-test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const SCRIPTS = path.join(__dirname, '..', '..', 'scripts'), credits = require(path.join(SCRIPTS, 'credits.js'));
let fails = 0; const check = (name, ok, detail) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail == null ? '' : '  -> ' + JSON.stringify(detail).slice(0, 600))); if (!ok) fails++; };

// ---------- credits.js ----------
check('noreply: id+login', JSON.stringify(credits.noreply('123+Some-One@users.noreply.github.com')) === '{"id":123,"login":"Some-One"}');
check('noreply: login only', JSON.stringify(credits.noreply('someone@users.noreply.github.com')) === '{"id":null,"login":"someone"}');
check('noreply: an ordinary address is not one', credits.noreply('a@b.c') === null);
check('credit: the no-reply address when the account is known', credits.credit({ name: 'Ann', login: 'ann', id: 7, email: 'ann@home.example' }).author === 'Ann <7+ann@users.noreply.github.com>');
check('credit: their own address when it isn\'t', credits.credit({ name: 'Bob', email: 'bob@x.example' }).trailer === 'Co-authored-by: Bob <bob@x.example>');
const broken = { name: '{\r  "message": "Requires authentication",\r  "status": "401"\r}TrapEmAll', email: 'TrapEmAll@users.noreply.github.com', login: 'TrapEmAll' };
check('A broken author name (an error message saved as the name) gives way to the login', credits.displayName(broken) === 'TrapEmAll' && credits.credit(broken).author === 'TrapEmAll <TrapEmAll@users.noreply.github.com>', credits.credit(broken));
const msg = 'Fix it\n\nBody.\n\n(cherry picked from commit abcdef1234)\nPorted-from: https://github.com/o/r/commit/0123456789abcdef0123456789abcdef01234567\nCo-authored-by: Ann <7+ann@users.noreply.github.com>\nCo-Authored-By: Claude <noreply@anthropic.com>';
const src = credits.sources(msg);
check('sources: Ported-from and cherry-pick -x', src.length === 2 && src[0].repo === 'o/r' && src[0].sha.length === 40 && src[1].sha === 'abcdef1234', src);
const ppl = credits.people({ name: 'Bob', email: 'bob@x.example', msg: msg + '\nCo-authored-by: Ann again <7+ann@users.noreply.github.com>' });
check('people: author first, co-authors once each', ppl.map(p => p.login || p.name).join(',') === 'Bob,ann,Claude', ppl);
const me = { logins: ['ggstonks'], emails: ['me@x.example'] };
check('isUs: you, Claude, bots', credits.isUs({ login: 'GGStonks' }, me) && credits.isUs({ email: 'me@x.example' }, me) && credits.isUs({ name: 'Claude', email: 'noreply@anthropic.com' }, me) && credits.isUs({ name: 'dependabot[bot]' }, me) && !credits.isUs({ login: 'ann' }, me));

// ---------- the survey, on local repositories ----------
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'fork-survey-test-')), GH = path.join(T, 'gh');
const who = { up: ['Up', '1+up@users.noreply.github.com'], me: ['Me', 'me@x.example'], forker: ['Forker', '123+forker@users.noreply.github.com'], other: ['Other', 'other@x.example'] };
const g = (cwd, w, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_AUTHOR_NAME: who[w][0], GIT_AUTHOR_EMAIL: who[w][1], GIT_COMMITTER_NAME: who[w][0], GIT_COMMITTER_EMAIL: who[w][1], GIT_CONFIG_NOSYSTEM: '1', HOME: T } }).trim();
const put = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
const commit = (dir, w, f, s, m) => { put(dir, f, s); g(dir, w, 'add', '-A'); g(dir, w, 'commit', '-q', '-m', m); return g(dir, w, 'rev-parse', 'HEAD'); };
const UP = path.join(GH, 'up', 'source'), FORK = path.join(GH, 'forker', 'fork'), MINE = path.join(T, 'mine');
fs.mkdirSync(UP, { recursive: true }); g(UP, 'up', 'init', '-q', '-b', 'main');
commit(UP, 'up', 'README.md', '# App\n\n## Credits\n\nBy Up.\n\n## Licence\n\nGPL\n', 'Base');
commit(UP, 'up', 'a.txt', 'a\n', 'Start a');
g(T, 'forker', 'clone', '-q', UP, FORK);
g(T, 'me', 'clone', '-q', '-b', 'main', UP, MINE); g(MINE, 'me', 'checkout', '-q', '-b', 't-rustyshelf'); g(MINE, 'me', 'config', 'user.email', 'me@x.example');
commit(MINE, 'me', 'mine.txt', 'mine\n', 'My own work'); g(MINE, 'me', 'tag', 'v1.0.0.0');
const B = commit(UP, 'up', 'b.txt', 'fix\n', 'Fix b'), C = commit(UP, 'up', 'c.txt', 'feature\n', 'Feature c');
const D = commit(FORK, 'forker', 'd.txt', 'd from the fork\n', 'Fork feature d'), E = commit(FORK, 'other', 'e.txt', 'e\n', 'Fork fix e');
g(MINE, 'me', 'fetch', '-q', UP, 'main'); g(MINE, 'me', 'cherry-pick', C);                            // same patch, no -x
put(MINE, 'd.txt', 'd, ported by hand\n'); g(MINE, 'me', 'add', '-A');
g(MINE, 'me', 'commit', '-q', `--author=${who.forker[0]} <${who.forker[1]}>`, '-m', `Fork feature d, ported\n\nPorted-from: https://github.com/forker/fork/commit/${D}\nCo-Authored-By: Claude <noreply@anthropic.com>`);

const OUT = path.join(T, 'out'), base = ['--root', MINE, '--out', OUT, '--offline', '--repos', 'up/source', '--forks', 'forker/fork', '--url-template', path.join(GH, '{owner}', '{repo}')];
const run = (...a) => execFileSync(process.execPath, [path.join(SCRIPTS, 'fork-survey.js'), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });
const nw = () => JSON.parse(fs.readFileSync(path.join(OUT, 'new.json'), 'utf8')), integ = () => JSON.parse(fs.readFileSync(path.join(OUT, 'integrated.json'), 'utf8'));
const shas = () => nw().commits.map(c => c.sha).sort().join(','), want = (...s) => s.sort().join(',');
try {
  run(...base);
  check('First survey: what isn\'t in (T)rustyShelf (the fix b, the fork\'s fix e)', shas() === want(B, E), nw().commits.map(c => c.subject));
  check('The cherry-picked feature counts as integrated (same patch)', integ()[C] && integ()[C].status === 'integrated' && /same patch/.test(integ()[C].how), integ()[C]);
  const ME_D = g(MINE, 'me', 'rev-parse', 'HEAD');
  check('The port by hand counts as integrated (Ported-from), with your commit', integ()[D] && integ()[D].how === 'Ported-from' && integ()[D].mine === ME_D && integ()[D].release === '', integ()[D]);
  const e = nw().commits.find(c => c.sha === E);
  check('Where each change is, and its home', e.home === 'forker/fork' && e.where.includes('forker/fork:main') && nw().commits.find(c => c.sha === B).home === 'up/source', e && e.where);
  check('Credit lines: the author, and where it comes from', e.credit.author === 'Other <other@x.example>' && e.credit.trailers[0] === `Ported-from: https://github.com/forker/fork/commit/${E}`, e.credit);
  check('new.md lists them, with how to see each one', /Fork fix e/.test(fs.readFileSync(path.join(OUT, 'new.md'), 'utf8')) && /mirror\.git show/.test(fs.readFileSync(path.join(OUT, 'new.md'), 'utf8')));
  check('integrated.md has the trace', /Fork feature d/.test(fs.readFileSync(path.join(OUT, 'integrated.md'), 'utf8')));

  run(...base);
  check('Before --ack, the same changes are listed again', shas() === want(B, E));
  run('--root', MINE, '--out', OUT, '--ack'); run(...base);
  check('After --ack: nothing new', nw().commits.length === 0, nw().commits.map(c => c.subject));
  const F2 = commit(FORK, 'forker', 'f.txt', 'f\n', 'Fork feature f'); run(...base);
  check('A new commit in a fork: only it is listed', shas() === want(F2));
  run(...base, '--all');
  check('--all: everything not in (T)rustyShelf, seen or not', shas() === want(B, E, F2));
  run('--root', MINE, '--out', OUT, '--mark', F2.slice(0, 9), 'later', 'after the next release'); run('--root', MINE, '--out', OUT, '--ack'); run(...base);
  check('"later" keeps showing after --ack', shas() === want(F2) && nw().commits[0].later === true);
  run('--root', MINE, '--out', OUT, '--mark', `https://github.com/forker/fork/commit/${F2}`, 'skip', 'not for us'); run(...base, '--all');
  check('"skip" takes it off the list, even with --all', shas() === want(B, E) && integ()[F2].status === 'skip' && integ()[F2].note === 'not for us');
  const cr = run('--root', MINE, '--out', OUT, '--offline', '--credit', E, B);
  check('--credit for several commits: one author, a Ported-from for each, Co-authored-by for the others', /Other <other@x\.example>/.test(cr) && (cr.match(/Ported-from:/g) || []).length === 2 && /Co-authored-by: Up <1\+up@users\.noreply\.github\.com>/.test(cr), cr);

  // a fork that's gone: its branches leave the mirror
  run('--root', MINE, '--out', OUT, '--offline', '--repos', 'up/source', '--url-template', path.join(GH, '{owner}', '{repo}'));
  check('Without the fork, its changes aren\'t listed', !nw().commits.some(c => c.home === 'forker/fork'));

  // README credits and the release's thanks
  run('--root', MINE, '--out', OUT, '--offline', '--repos', 'up/source', '--credits');
  const md = fs.readFileSync(path.join(MINE, 'README.md'), 'utf8');
  check('--credits: the block is in README\'s Credits, before the next section', /## Credits[\s\S]*fork-survey credits[\s\S]*\[forker\]\(https:\/\/github\.com\/forker\): Fork feature d, ported \(\[original\]\(https:\/\/github\.com\/forker\/fork\/commit\/[0-9a-f]{40}\)\)[\s\S]*\/fork-survey credits -->\n\n## Licence/.test(md), md);
  check('--credits: not you, not Claude, not the originals\' owner', !/\[Me\]|Claude|\[up\]/.test(md.split('fork-survey credits')[1]));
  run('--root', MINE, '--out', OUT, '--offline', '--repos', 'up/source', '--credits');
  check('--credits again: the block is replaced, not added twice', fs.readFileSync(path.join(MINE, 'README.md'), 'utf8').split('<!-- /fork-survey credits -->').length === 2);
  const range = credits.releaseRange(MINE, '1.1.0.0');
  const th = credits.thanks(credits.log(MINE, range), credits.identity(MINE, 'GGStonks'));
  check('Release thanks: since the release before (v1.0.0.0), the people who aren\'t you', range === 'v1.0.0.0..HEAD' && th.map(t => t.person.login).sort().join(',') === 'forker,up', { range, th: th.map(t => t.person) });
  // one change brought in over two commits (a big release, part by part); a "later" marked by hand stays
  put(MINE, 'd2.txt', 'the rest of d\n'); g(MINE, 'me', 'add', '-A');
  g(MINE, 'me', 'commit', '-q', `--author=${who.forker[0]} <${who.forker[1]}>`, '-m', `Fork feature d, the rest\n\nPorted-from: https://github.com/forker/fork/commit/${D}`);
  run(...base);
  check('A change ported in two commits: both are kept, the first stays "yours"', integ()[D].parts.length === 2 && integ()[D].mine === ME_D && integ()[D].status === 'integrated', integ()[D]);
  run('--root', MINE, '--out', OUT, '--mark', D, 'later', 'one part still to come'); run(...base);
  check('"later" marked by hand isn\'t overwritten by the next survey', integ()[D].status === 'later' && integ()[D].parts.length === 2, integ()[D]);
} finally { fs.rmSync(T, { recursive: true, force: true }); }

console.log(fails ? `\n${fails} failed` : '\nAll passed');
process.exit(fails ? 1 : 0);
