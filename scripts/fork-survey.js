#!/usr/bin/env node
// (T)rustyShelf's fork survey: every change in the original repositories (sassiestrhihno's boxshelf-source and boxshelf-beta),
// in their forks, in the forks of those forks (and in the forks of your own repository) that isn't in (T)rustyShelf yet. No
// AI: it collects; an AI (or you) reads new.md, compares with t-rustyshelf and decides what to bring in (/trustyshelf-integrate).
//
//   node scripts/fork-survey.js [--out fork-survey] [--repos owner/repo,owner/repo] [--mine GGStonks/t-rustyshelf]
//        [--branch t-rustyshelf] [--depth 10] [--jobs 4] [--all]
//   node scripts/fork-survey.js --ack                       what new.json lists now counts as seen: the next run shows only newer
//   node scripts/fork-survey.js --mark <commit link|sha> <integrated|skip|later|clear> [note]
//   node scripts/fork-survey.js --credit <commit link|sha> …  how to credit a port of these commits (author line and trailers)
//   node scripts/fork-survey.js --credits                   rewrites the list of people brought in, in README.md's Credits
// --all shows every change not in (T)rustyShelf, seen or not. For tests: --offline (no GitHub API) with --forks owner/repo,…
// (extra repositories to survey) and --url-template '<path or URL with {owner} and {repo}>'; --root <your clone>.
//
// How:
//   - finds the repositories through GitHub's API (`gh`): the originals, their forks, forks of forks (to --depth), and the
//     forks of your own repository; a fork never pushed to since it was made has nothing of its own and isn't fetched
//   - fetches every branch and every pull request (refs/pull/N/head: kept by GitHub even when the fork is gone) of each one
//     into a bare git mirror, next to your branch as it is in your clone (pushed or not)
//   - a change is "not in (T)rustyShelf" when no commit of your branch is it or has the same patch (git's patch-id: a plain
//     cherry-pick counts as in) and no commit of yours names it (a `Ported-from: <commit link>` trailer or cherry-pick -x's
//     "(cherry picked from commit …)"). Merge commits are left out (their changes are in the commits they merge).
// What it writes (in --out, which git ignores):
//   new.md, new.json     the changes not in (T)rustyShelf that weren't seen before (and those marked "later"), by repository,
//                        with who made each one, where it is (branches, pull request), its files and the lines that credit
//                        its author in a port. Seen = listed in a survey that `--ack` confirmed: they aren't listed again.
//   integrated.md/.json  the trace of what came in (found from your commits by itself, or marked): from where, by whom, in which
//                        commit of yours and which release; and what was decided against ("skip") or kept for "later"
//   repos.json           every repository found this time
//   seen.json            the changes already shown: their ids only (nothing else of them is kept)
//   cache.json           GitHub logins and pull request titles, not asked again
//   mirror.git           the git mirror: `git -C fork-survey/mirror.git show <sha>` shows a change
// Crediting: see scripts/credits.js (the original author stays the commit's author; GitHub then counts them as a contributor).
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync, execFile } = require('child_process');
const credits = require('./credits.js');

// ---------- options ----------
const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const ROOT = path.resolve(String(opt('root', path.join(__dirname, '..'))));
const OUT = path.resolve(ROOT, String(opt('out', 'fork-survey'))), MIRROR = path.join(OUT, 'mirror.git');
const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const REPOS = list(opt('repos', 'sassiestrhihno/boxshelf-source,sassiestrhihno/boxshelf-beta')), EXTRA = list(opt('forks', ''));
const MINE = String(opt('mine', 'GGStonks/t-rustyshelf')), ME = MINE.split('/')[0], BRANCH = String(opt('branch', 't-rustyshelf'));
const DEPTH = +opt('depth', 10) || 10, JOBS = Math.max(1, +opt('jobs', 4) || 4), ALL = argv.includes('--all');
const OFFLINE = argv.includes('--offline'), URL_T = String(opt('url-template', 'https://github.com/{owner}/{repo}.git'));
const STATUSES = ['integrated', 'skip', 'later', 'clear'];

// ---------- helpers ----------
const F = n => path.join(OUT, n);
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, x) => fs.writeFileSync(f, JSON.stringify(x, null, 1) + '\n');
const ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
const git = (args, cwd = MIRROR) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'], env: ENV }).trim();
const tryGit = (args, cwd) => { try { return git(args, cwd); } catch { return ''; } };
const gitAsync = args => new Promise(res => execFile('git', args, { cwd: MIRROR, env: ENV, maxBuffer: 64 << 20, timeout: 15 * 60e3 }, (e, so, se) => res(e ? (String(se || e.message).trim().split('\n').pop() || 'failed') : '')));
const gh = args => execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 }).trim();
const firstLine = e => String((e && (e.stderr || e.message)) || e).trim().split('\n')[0];
const pool = async (items, n, fn) => { let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); })); };
const esc = s => String(s || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const day = s => String(s || '').slice(0, 10), when = s => String(s || '').slice(0, 16).replace('T', ' ');
const commitUrl = (full, sha) => `https://github.com/${full}/commit/${sha}`;
const rel = p => path.relative(ROOT, p) || '.';
const hasMirror = () => fs.existsSync(path.join(MIRROR, 'HEAD'));
// a commit link (…/commit/<sha>, …/pull/N/commits/<sha>) or a sha → the whole sha, from the mirror
function resolve(x) {
  const m = /([0-9a-f]{7,40})\/?$/i.exec(String(x || '').replace(/[?#].*$/, '')); if (!m) return '';
  return (hasMirror() && tryGit(['rev-parse', '-q', '--verify', m[1] + '^{commit}'])) || (m[1].length === 40 ? m[1].toLowerCase() : '');
}
function describe(sha) { // a commit as the mirror has it (who: the login when the address says it, else the name)
  const [name, email, date, subject, body] = (tryGit(['show', '-s', '--format=%an%x1f%ae%x1f%aI%x1f%s%x1f%b', sha]) + '\x1f\x1f\x1f\x1f').split('\x1f');
  const n = credits.noreply(email);
  return { name, email, date, subject, body: String(body || '').trim(), who: (n && n.login) || credits.displayName({ name, email }) };
}
const homeOf = sha => { const r = tryGit(['for-each-ref', '--contains', sha, '--format=%(refname)', 'refs/ts/']).split('\n').find(x => x && x !== 'refs/ts/mine'); const m = /^refs\/ts\/([^/]+\/[^/]+)\//.exec(r || ''); return m ? m[1] : ''; };

// GitHub logins: from the no-reply address, or asked once (by commit) and kept in cache.json (by address)
function loginFor(cache, p, repo, sha) {
  const n = credits.noreply(p.email);
  if (n) { if (!n.id && !OFFLINE) { const k = n.login.toLowerCase(); if (!(k in cache.users)) { try { cache.users[k] = +gh([`users/${n.login}`, '--jq', '.id']) || null; } catch { cache.users[k] = null; } } n.id = cache.users[k]; } return n; }
  const k = String(p.email || '').toLowerCase(); if (k && cache.logins[k]) return cache.logins[k].login ? cache.logins[k] : null;
  if (OFFLINE || !repo || !sha || !k) return null;
  const got = credits.ghAuthor(repo, sha); cache.logins[k] = got || { login: '' }; return got;
}
function creditLines(cache, picks) { // picks: [{ sha, url, home, name, email, msg }] → { author, trailers }
  const ppl = [], keys = new Set();
  for (const c of picks) for (const p of credits.people(c)) { if (!p.login || !p.id) Object.assign(p, loginFor(cache, p, c.home, c.sha) || {}); const k = (p.login || p.email || p.name).toLowerCase(); if (!keys.has(k)) { keys.add(k); ppl.push(p); } }
  return { author: ppl[0] ? credits.credit(ppl[0]).author : '', trailers: [...picks.map(c => `Ported-from: ${c.url}`), ...ppl.slice(1).map(p => credits.credit(p).trailer)], people: ppl };
}
function releaseOf(sha) { let t = ''; try { t = git(['tag', '--contains', sha, '--sort=creatordate', '--list', 'v*'], ROOT).split('\n').filter(Boolean)[0] || ''; } catch {} return t; }
function fetchTags() { // release tags are made on GitHub: bring them here first, so "in which release" is right
  try { const r = git(['remote', '-v'], ROOT).split('\n').map(l => l.split(/\s+/)).find(([, url]) => url && url.replace(/\.git$/, '').toLowerCase().endsWith('/' + MINE.toLowerCase()));
    if (r) execFileSync('git', ['fetch', '--tags', '--quiet', r[0]], { cwd: ROOT, timeout: 60000, stdio: 'ignore', env: ENV }); } catch (e) { console.error('  release tags not fetched:', firstLine(e)); }
}
const entryOf = c => ({ url: c.url || '', repo: c.home || '', subject: c.subject || '', author: (c.author && (c.author.login || credits.displayName(c.author))) || '' });

// ---------- --mark / --ack / --credit / --credits (no survey) ----------
if (argv.includes('--mark')) {
  const i = argv.indexOf('--mark'), what = argv[i + 1], status = argv[i + 2], note = argv.slice(i + 3).filter(a => !a.startsWith('--')).join(' ');
  if (!what || !STATUSES.includes(status)) { console.error(`--mark <commit link|sha> <${STATUSES.join('|')}> [note]`); process.exit(2); }
  const sha = resolve(what); if (!sha) { console.error(`${what}: not in the mirror (run the survey first, or give the whole sha)`); process.exit(2); }
  const integ = readJson(F('integrated.json'), {}), nw = readJson(F('new.json'), { commits: [] }), c = nw.commits.find(x => x.sha === sha);
  if (status === 'clear') delete integ[sha];
  else { const d = c ? entryOf(c) : (() => { const x = describe(sha), home = homeOf(sha); return { url: home ? commitUrl(home, sha) : '', repo: home, subject: x.subject, author: x.who }; })();
    integ[sha] = { ...d, ...(integ[sha] || {}), status, how: 'marked', ...(note ? { note } : {}), at: new Date().toISOString() }; }
  fs.mkdirSync(OUT, { recursive: true }); writeJson(F('integrated.json'), integ);
  console.log(status === 'clear' ? `Forgot ${sha.slice(0, 9)}` : `${sha.slice(0, 9)} ${(integ[sha] && integ[sha].subject) || ''}: ${status}${note ? ` (${note})` : ''}`); process.exit(0);
}
if (argv.includes('--ack')) {
  const nw = readJson(F('new.json'), null); if (!nw) { console.error('No new.json yet: run the survey first.'); process.exit(2); }
  const seen = readJson(F('seen.json'), { commits: {} }); let n = 0;
  for (const c of nw.commits) if (!seen.commits[c.sha]) { seen.commits[c.sha] = nw.at; n++; }
  seen.at = new Date().toISOString(); writeJson(F('seen.json'), seen);
  console.log(`${n} changes now count as seen; the next survey lists only newer ones (and those marked "later").`); process.exit(0);
}
if (argv.includes('--credit')) {
  const cache = readJson(F('cache.json'), {}); cache.logins = cache.logins || {}; cache.users = cache.users || {};
  const nw = readJson(F('new.json'), { commits: [] }), picks = [];
  for (const a of argv.slice(argv.indexOf('--credit') + 1).filter(a => !a.startsWith('--'))) {
    const sha = resolve(a); if (!sha) { console.error(`${a}: not in the mirror`); process.exit(2); }
    const c = nw.commits.find(x => x.sha === sha), d = describe(sha), home = (c && c.home) || homeOf(sha);
    picks.push({ sha, url: (c && c.url) || (home ? commitUrl(home, sha) : sha), home, name: d.name, email: d.email, msg: `${d.subject}\n\n${d.body}`, subject: d.subject });
  }
  if (!picks.length) { console.error('--credit <commit link|sha> …'); process.exit(2); }
  const cl = creditLines(cache, picks); writeJson(F('cache.json'), cache);
  console.log(picks.map(p => `${p.sha.slice(0, 9)} ${p.subject}`).join('\n'));
  console.log(`\nThe port's author (a cherry-pick keeps it by itself; by hand: git commit --author=...):\n  ${cl.author}\nTrailers (the commit message's last paragraph, with Co-Authored-By for the model):\n${cl.trailers.map(t => '  ' + t).join('\n')}`);
  process.exit(0);
}
if (argv.includes('--credits')) { // README.md: the people whose work came in, made from the commit history (the block is replaced each time)
  const cache = readJson(F('cache.json'), {}); cache.logins = cache.logins || {}; cache.users = cache.users || {};
  const me = credits.identity(ROOT, [ME, ...REPOS.map(r => r.split('/')[0])]); // (the originals' authors are credited at the top of the README)
  const who = credits.thanks(credits.log(ROOT, BRANCH), me, (c, p) => loginFor(cache, p, MINE, c.sha));
  const START = '<!-- fork-survey credits: made by `node scripts/fork-survey.js --credits` from the commit history; edits here are replaced -->', END = '<!-- /fork-survey credits -->';
  const block = [START, '', 'Brought into (T)rustyShelf from other people\'s forks (they are the authors or co-authors of these commits):', '',
    ...who.map(({ person: p, items }) => `- ${p.login ? `[${p.login}](https://github.com/${p.login})` : esc(credits.displayName(p))}: ${items.map(i => esc(i.subject) + (i.sources[0] && i.sources[0].url ? ` ([original](${i.sources[0].url}))` : '')).join('; ')}`), '', END].join('\n');
  const f = path.join(ROOT, 'README.md'); let md = fs.readFileSync(f, 'utf8');
  const a = md.indexOf(START), b = md.indexOf(END);
  if (a >= 0 && b > a) md = md.slice(0, a) + block + md.slice(b + END.length);
  else { const h = md.search(/^## Credits\s*$/m), next = h < 0 ? -1 : md.slice(h + 3).search(/^## /m), at = h < 0 ? md.length : next < 0 ? md.length : h + 3 + next;
    md = md.slice(0, at).replace(/\s*$/, '\n\n') + block + '\n' + (at < md.length ? '\n' + md.slice(at) : ''); }
  fs.writeFileSync(f, md); fs.mkdirSync(OUT, { recursive: true }); writeJson(F('cache.json'), cache);
  console.log(`README.md: ${who.length} people credited${who.length ? ` (${who.map(w => w.person.login || w.person.name).join(', ')})` : ''}.`); process.exit(0);
}

// ---------- the survey ----------
(async () => {
  const t0 = Date.now(), at = new Date().toISOString();
  fs.mkdirSync(OUT, { recursive: true });
  if (!hasMirror()) { fs.mkdirSync(MIRROR, { recursive: true }); git(['init', '-q', '--bare']); git(['config', 'gc.auto', '0']); }
  const cache = readJson(F('cache.json'), {}); cache.logins = cache.logins || {}; cache.users = cache.users || {}; cache.pulls = cache.pulls || {};
  console.log(`Fork survey → ${OUT}`);

  // 1. the repositories: the originals, then their forks level by level (and your repository's forks)
  const repos = [], byFull = new Map(), add = r => { const k = r.full.toLowerCase(); if (byFull.has(k) || k === MINE.toLowerCase()) return false; byFull.set(k, r); repos.push(r); return true; };
  for (const full of REPOS) add({ full, parent: '', root: full, depth: 0, original: true, fetch: true });
  for (const full of EXTRA) add({ full, parent: '', root: full, depth: 1, fetch: true });
  if (!OFFLINE) {
    let level = [...REPOS.map(full => ({ full, root: full })), { full: MINE, root: MINE }];
    for (let d = 1; d <= DEPTH && level.length; d++) {
      const next = [];
      for (const p of level) {
        let lines = []; try { lines = gh(['--paginate', `repos/${p.full}/forks?per_page=100`, '--jq', '.[] | [.full_name, .pushed_at, .created_at, .forks_count] | @tsv']).split('\n').filter(Boolean); }
        catch (e) { console.error(`  forks of ${p.full}: ${firstLine(e)}`); }
        for (const l of lines) { const [full, pushed, created, forks] = l.split('\t');
          // (GitHub keeps the original's last push date on a fork never pushed to: nothing of its own there)
          const r = { full, parent: p.full, root: p.root, depth: d, pushed, created, ...(p.root === MINE ? { ofMine: true } : {}), fetch: new Date(pushed) > new Date(created) };
          if (add(r) && +forks) next.push(r); }
      }
      level = next;
    }
  }

  // 2. fetch: your branch from your clone, every branch and pull request of the others
  try { git(['fetch', '--no-tags', '--no-write-fetch-head', '-q', ROOT, `+refs/heads/${BRANCH}:refs/ts/mine`]); }
  catch (e) { console.error(`Your branch ${BRANCH} isn't in ${ROOT}: ${firstLine(e)}`); process.exit(1); }
  const toFetch = repos.filter(r => r.fetch);
  await pool(toFetch, JOBS, async r => { const [o, n] = r.full.split('/');
    const err = await gitAsync(['fetch', '--prune', '--no-tags', '--no-write-fetch-head', '-q', URL_T.replace('{owner}', o).replace('{repo}', n), `+refs/heads/*:refs/ts/${r.full}/heads/*`, `+refs/pull/*/head:refs/ts/${r.full}/pull/*`]);
    if (err) { r.error = err; console.error(`  ${r.full}: ${err}`); } });
  console.log(`  ${repos.length} repositories (${REPOS.length} originals, ${repos.length - REPOS.length} forks), ${toFetch.length} fetched (the rest were never pushed to)`);

  // 3. which changes aren't in your branch (same commit, or same patch)
  const refs = [];
  for (const ref of tryGit(['for-each-ref', '--format=%(refname)', 'refs/ts/']).split('\n').filter(Boolean)) {
    const m = /^refs\/ts\/([^/]+\/[^/]+)\/(heads|pull)\/(.+)$/.exec(ref); if (!m) continue;
    const r = byFull.get(m[1].toLowerCase()); if (!r) { if (!OFFLINE) tryGit(['update-ref', '-d', ref]); continue; } // (a fork that's gone)
    refs.push({ ref, repo: r, kind: m[2], name: m[3], label: m[2] === 'heads' ? `${r.full}:${m[3]}` : `${r.full}#${m[3]}` });
  }
  const rank = x => (x.kind === 'pull' ? 1e6 : 0) + (x.repo.original ? 0 : 1e3) + x.repo.depth * 10;
  refs.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  const found = new Map();
  for (const x of refs) for (const l of tryGit(['rev-list', '--no-merges', '--right-only', '--cherry-mark', `refs/ts/mine...${x.ref}`]).split('\n').filter(Boolean)) {
    const sha = l.slice(1); if (!found.has(sha)) found.set(sha, { sha, same: l[0] === '=', home: x.repo.full, where: [] });
    const f = found.get(sha); f.where.push(x.label); if (x.kind === 'pull' && !f.pull) f.pull = { repo: x.repo.full, number: +x.name };
    if (x.kind === 'heads' && x.repo.original) f.onOriginal = true;
  }
  // a commit already on an original's branch isn't "from" a pull request that happens to contain it (a fork's branch brought up to date)
  for (const f of found.values()) if (f.onOriginal) delete f.pull;

  // 4. what your commits brought in already: Ported-from / cherry-pick -x, or the same patch
  if (!OFFLINE) fetchTags();
  const mine = credits.log(ROOT, BRANCH), integ = readJson(F('integrated.json'), {});
  for (const c of mine) for (const s of credits.sources(c.msg)) {
    const sha = s.sha.length === 40 ? s.sha : tryGit(['rev-parse', '-q', '--verify', s.sha + '^{commit}']); if (!sha) continue;
    const prev = integ[sha] || {}; if (prev.mine === c.sha) continue;
    integ[sha] = { ...prev, status: 'integrated', how: s.url ? 'Ported-from' : 'cherry-pick -x', mine: c.sha, mineSubject: c.subject, at: c.date, ...(s.url && !prev.url ? { url: s.url } : {}) };
  }
  for (const f of found.values()) if (f.same && !integ[f.sha]) integ[f.sha] = { status: 'integrated', how: 'same patch (cherry-picked)', mine: '', at };
  for (const [sha, e] of Object.entries(integ)) {
    if (!e.subject || /[\r\n{]/.test(e.author || '')) { const d = describe(sha), f = found.get(sha), home = (f && f.home) || homeOf(sha); Object.assign(e, { subject: d.subject, author: d.who, repo: e.repo || home, url: e.url || (home ? commitUrl(home, sha) : '') }); }
    if (e.status === 'integrated' && e.mine && !e.release) e.release = releaseOf(e.mine);
  }

  // 5. the new ones: not in your branch, not decided, not seen (unless kept for later)
  const seen = readJson(F('seen.json'), { commits: {} });
  const myText = mine.map(c => c.msg).join('\0');
  const shown = [...found.values()].filter(f => !f.same && !(integ[f.sha] && ['integrated', 'skip'].includes(integ[f.sha].status))
    && (ALL || !seen.commits[f.sha] || (integ[f.sha] && integ[f.sha].status === 'later')));
  const commits = shown.map(f => {
    const d = describe(f.sha), url = commitUrl(f.home, f.sha);
    const cl = creditLines(cache, [{ sha: f.sha, url, home: f.home, name: d.name, email: d.email, msg: `${d.subject}\n\n${d.body}` }]), a = cl.people[0] || { name: d.name };
    const files = tryGit(['show', '--numstat', '--format=', f.sha]).split('\n').filter(Boolean).map(l => { const [add, del, ...p] = l.split('\t'); return { path: p.join('\t'), add: +add || 0, del: +del || 0 }; });
    let pr = null;
    if (f.pull) { const k = `${f.pull.repo}#${f.pull.number}`;
      if (!OFFLINE) { try { const [title, html, state, merged, user] = gh([`repos/${f.pull.repo}/pulls/${f.pull.number}`, '--jq', '[.title, .html_url, .state, (.merged_at // ""), .user.login] | @tsv']).split('\t'); cache.pulls[k] = { title, url: html, state: merged ? 'merged' : state, by: user }; } catch {} }
      pr = cache.pulls[k] || { url: `https://github.com/${f.pull.repo}/pull/${f.pull.number}` }; pr.number = f.pull.number; pr.repo = f.pull.repo; }
    // a fork's owner named in your commits: maybe brought in by hand already (not the originals' owner: every file header names them)
    const owners = [f.home.split('/')[0]].filter(o => !REPOS.some(r => r.split('/')[0].toLowerCase() === o.toLowerCase())).filter(o => new RegExp(`\\b${o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(myText));
    return { sha: f.sha, short: f.sha.slice(0, 9), url, home: f.home, where: f.where, pr, author: { name: a.name, login: a.login || '', id: a.id || null }, date: d.date,
      subject: d.subject, body: d.body.slice(0, 2000), files, add: files.reduce((s, x) => s + x.add, 0), del: files.reduce((s, x) => s + x.del, 0),
      credit: { author: cl.author, trailers: cl.trailers }, later: !!(integ[f.sha] && integ[f.sha].status === 'later'), seenBefore: !!seen.commits[f.sha],
      ...(owners.length ? { ownerNamedInYourCommits: owners } : {}), show: `git -C ${rel(MIRROR)} show ${f.sha.slice(0, 9)}` };
  });
  const order = new Map(repos.map((r, i) => [r.full, i]));
  commits.sort((a, b) => (order.get(a.home) - order.get(b.home)) || String(a.date).localeCompare(String(b.date)));

  // 6. write
  for (const r of repos) { const rs = refs.filter(x => x.repo === r); r.branches = rs.filter(x => x.kind === 'heads').length; r.pulls = rs.filter(x => x.kind === 'pull').length;
    r.notInYours = [...found.values()].filter(f => f.home === r.full && !f.same).length; r.listed = commits.filter(c => c.home === r.full).length; }
  writeJson(F('repos.json'), { at, repos });
  writeJson(F('new.json'), { at, mine: MINE, branch: BRANCH, notInYours: [...found.values()].filter(f => !f.same).length, listed: commits.length, commits });
  writeJson(F('integrated.json'), integ);
  writeJson(F('cache.json'), cache);
  if (!fs.existsSync(F('seen.json'))) writeJson(F('seen.json'), { at: '', commits: {} });

  const integrated = Object.entries(integ).filter(([, e]) => e.status === 'integrated'), later = Object.entries(integ).filter(([, e]) => e.status === 'later'), skip = Object.entries(integ).filter(([, e]) => e.status === 'skip');
  const L = ['# Changes in other forks that (T)rustyShelf doesn\'t have', '',
    `Made ${when(at)} UTC by scripts/fork-survey.js in ${Math.round((Date.now() - t0) / 1000)} s: ${repos.length} repositories (${toFetch.length} fetched), ${[...found.values()].filter(f => !f.same).length} changes not in ${BRANCH}, **${commits.length} listed here** (${ALL ? 'all of them: --all' : 'new since the last `--ack`, and those kept for later'}). Integrated so far: ${integrated.length} (integrated.md).`, '',
    'For the AI (/trustyshelf-integrate): read each change (`show` gives the whole diff), check whether t-rustyshelf already does the same thing by other means, and sum up the bug fixes and features that are missing. Several commits can make one feature. After the user has chosen: `node scripts/fork-survey.js --ack`. A change ported by hand gets its credit lines (below, or `--credit <sha> …` for several commits): the original author stays the commit\'s author, and the trailers say where it comes from; then it shows up in integrated.md by itself on the next survey.', ''];
  if (!commits.length) L.push('Nothing new.', '');
  let cur = '';
  for (const c of commits) {
    if (c.home !== cur) { cur = c.home; const r = byFull.get(cur.toLowerCase());
      L.push(`## [${cur}](https://github.com/${cur}) (${r.original ? 'original' : `fork of ${r.root}${r.parent && r.parent !== r.root ? ` via ${r.parent}` : ''}${r.ofMine ? ', **a fork of yours**' : ''}`}${r.pushed ? `, last push ${day(r.pushed)}` : ''})`, ''); }
    L.push(`### \`${c.short}\` ${esc(c.subject)}${c.later ? ' · **kept for later**' : ''}`, '');
    const nm = credits.displayName(c.author);
    L.push(`- by ${c.author.login ? `[${c.author.login}](https://github.com/${c.author.login})` : esc(nm)}${c.author.login && nm !== c.author.login ? ` (${esc(nm)})` : ''} on ${day(c.date)} · [commit](${c.url}) · in ${c.where.slice(0, 6).join(', ')}${c.where.length > 6 ? ` and ${c.where.length - 6} more` : ''}`);
    if (c.pr) L.push(`- pull request: [${c.pr.repo}#${c.pr.number}${c.pr.title ? ` ${esc(c.pr.title)}` : ''}](${c.pr.url})${c.pr.state ? ` (${c.pr.state})` : ''}`);
    if (c.ownerNamedInYourCommits) L.push(`- ${c.ownerNamedInYourCommits.join(', ')} is named in your commits: maybe brought in by hand already`);
    L.push(`- files (+${c.add} −${c.del}): ${c.files.slice(0, 15).map(x => `${x.path} (+${x.add} −${x.del})`).join(', ')}${c.files.length > 15 ? ` and ${c.files.length - 15} more` : ''}`);
    L.push(`- credit: \`--author="${c.credit.author}"\`; trailers: ${c.credit.trailers.map(t => `\`${t}\``).join(', ')}`);
    L.push(`- see it: \`${c.show}\``, '');
    if (c.body) L.push(c.body.split('\n').slice(0, 12).map(l => '> ' + l).join('\n'), '');
  }
  fs.writeFileSync(F('new.md'), L.join('\n') + '\n');

  const row = ([sha, e]) => `- [\`${sha.slice(0, 9)}\`](${e.url || '#'}) ${esc(e.subject)} · by ${esc(e.author || '?')}${e.repo ? ` · from ${e.repo}` : ''}${e.mine ? ` · yours: \`${e.mine.slice(0, 9)}\` ${esc(e.mineSubject || '')} (${e.release || 'not released yet'})` : ''}${e.how ? ` · ${e.how}` : ''}${e.note ? ` · ${esc(e.note)}` : ''}`;
  const by = (a, b) => String(b[1].at || '').localeCompare(String(a[1].at || ''));
  const I = ['# What came into (T)rustyShelf from other forks', '', `Made ${when(at)} UTC by scripts/fork-survey.js: found from your commits (\`Ported-from:\` trailers, cherry-pick -x, the same patch) and from \`--mark\`.`, '',
    `## Integrated (${integrated.length})`, '', ...integrated.sort(by).map(row), '', `## Kept for later (${later.length})`, '', ...later.sort(by).map(row), '', `## Decided against (${skip.length})`, '', ...skip.sort(by).map(row), ''];
  fs.writeFileSync(F('integrated.md'), I.join('\n') + '\n');
  console.log(`Done in ${Math.round((Date.now() - t0) / 1000)} s: ${commits.length} changes listed in ${F('new.md')} (${[...found.values()].filter(f => !f.same).length} not in ${BRANCH} in all); ${integrated.length} integrated so far (${F('integrated.md')}).`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
