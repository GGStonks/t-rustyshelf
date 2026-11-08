#!/usr/bin/env node
// (T)rustyShelf's community report: what people around Boxshelf ask for, report and build, gathered from GitHub into one
// report, the starting point for deciding what to change next. No AI: it only collects and sorts (keyword rules).
//
//   node scripts/community-report.js [--out community-report] [--since 2026-11-01] [--no-forks] [--no-search]
//                                    [--repos owner/repo,owner/repo] [--mine GGStonks/t-rustyshelf] [--depth 3]
//
// What it reads (GitHub's API, with your `gh` sign-in or GITHUB_TOKEN; public data only):
//   - every issue, pull request (its files and commits) and discussion of the Boxshelf repositories, with all comments
//     and replies, and their reactions (a 👍 is someone else wanting the same)
//   - every fork of them (and forks of forks): each branch's commits and changed files that aren't in the original,
//     so work nobody opened a pull request for shows up too; and the forks' own issues / pull requests / discussions
//   - elsewhere on GitHub: repositories, issues / pull requests and code that mention Boxshelf
//   - your own repository's commit messages: an item they name ("issue 9", "pull request #5") is marked as mentioned
// What it writes (in --out, which git ignores):
//   report.md   the report: new since last time, then requests by kind (bug / feature / change / removal / question),
//               each with its link, who and when, 👍, the sentences where people ask for something, and its status
//   data.json   everything collected, for other tools
//   seen.json   what was there last time ("new" next time)
//   done.json   yours to edit: { "<key>": { "status": "done" | "skip" | "later", "note": "…" } } (key = the item's link)
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

// ---------- options ----------
const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const OUT = path.resolve(String(opt('out', 'community-report')));
const REPOS = String(opt('repos', 'sassiestrhihno/boxshelf-beta,sassiestrhihno/boxshelf-source')).split(',').map(s => s.trim()).filter(Boolean);
const MINE = String(opt('mine', 'GGStonks/t-rustyshelf'));
const SINCE = opt('since', '') ? new Date(String(opt('since'))) : null;
const DEPTH = +opt('depth', 3) || 3, FORKS = !argv.includes('--no-forks'), SEARCH = !argv.includes('--no-search');
const WORD = String(opt('word', 'boxshelf')); // what "mentions Boxshelf" searches for
// "boxshelf" is also a shelf in games and furniture shops: a result counts only when it's about this app (no AI: words)
const ABOUT = /sassiestrhihno|boxshelf[-_ ](beta|source|linux)|\b(fork of|based on|port of)\b[^.\n]{0,40}\bbox ?shelf|\bbox ?shelf\b[^.\n]{0,80}\b(launcher|emulat|frontend|box ?art|retroarch|steam ?deck|ayn|thor|3d shelf|appimage)|\b(launcher|emulat|frontend|box ?art|retroarch|steam ?deck|appimage)\b[^.\n]{0,80}\bbox ?shelf/i;
const DERIVED = /sassiestrhihno|\b(fork of|based on|port of|built on|made from)\b[^.\n]{0,40}\bbox ?shelf|\bbox ?shelf\b[^.\n]{0,20}\b(fork|port)\b/i; // (a project made from Boxshelf's code)
const CODE_QUERIES = ['sassiestrhihno', '"boxshelf-beta"', '"boxshelf-source"']; // the app's own fingerprints (its forks' file headers, its package entries)

// ---------- GitHub ----------
function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try { return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim(); } catch { return ''; }
}
const TOKEN = token(); if (!TOKEN) { console.error('No GitHub sign-in: run `gh auth login` or set GITHUB_TOKEN.'); process.exit(2); }
const H = { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'trustyshelf-community-report', Accept: 'application/vnd.github+json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let calls = 0;
async function http(url, init = {}, tries = 4) {
  for (let t = 0; ; t++) {
    calls++; let r; try { r = await fetch(url, { ...init, headers: { ...H, ...(init.headers || {}) } }); } catch (e) { if (t >= tries) throw e; await sleep(2000 * (t + 1)); continue; }
    if ((r.status === 403 || r.status === 429) && t < tries) { // rate limits: wait as GitHub says, then again
      const reset = +r.headers.get('x-ratelimit-reset'), after = +r.headers.get('retry-after');
      const ms = after ? after * 1000 : reset ? Math.max(1000, reset * 1000 - Date.now() + 1000) : 15000 * (t + 1);
      if (ms > 15 * 60e3) throw new Error(`rate limit for ${Math.round(ms / 60e3)} min: ${url}`);
      console.error(`  (rate limit: waiting ${Math.round(ms / 1000)} s)`); await sleep(ms); continue; }
    if (r.status >= 500 && t < tries) { await sleep(3000 * (t + 1)); continue; }
    return r;
  }
}
async function rest(p) { const r = await http(p.startsWith('http') ? p : 'https://api.github.com/' + p); if (r.status === 404 || r.status === 409 || r.status === 422) return null; if (!r.ok) throw new Error(`${r.status} ${p}`); return r.json(); }
async function restAll(p, max = 2000) { // every page (Link: next)
  const out = []; let url = 'https://api.github.com/' + p + (p.includes('?') ? '&' : '?') + 'per_page=100';
  while (url && out.length < max) { const r = await http(url); if (!r.ok) { if (r.status === 404 || r.status === 409) return out; throw new Error(`${r.status} ${url}`); }
    const j = await r.json(); out.push(...(Array.isArray(j) ? j : j.items || [])); const m = /<([^>]+)>;\s*rel="next"/.exec(r.headers.get('link') || ''); url = m ? m[1] : null; }
  return out;
}
async function gql(query, variables) {
  const r = await http('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query, variables }), headers: { 'Content-Type': 'application/json' } });
  const j = await r.json(); if (j.errors && !j.data) throw new Error(j.errors.map(e => e.message).join('; ')); return j.data;
}

// ---------- one repository's conversations ----------
const AUTHOR = 'author { login }', COMMENTS = `comments(first: 60) { totalCount nodes { ${AUTHOR} body createdAt url reactions { totalCount } } }`;
const REACT = 'reactionGroups { content reactors { totalCount } }';
const Q = {
  issues: `query($o:String!,$n:String!,$a:String){ repository(owner:$o,name:$n){ issues(first:40,after:$a,orderBy:{field:CREATED_AT,direction:ASC}){ pageInfo{hasNextPage endCursor}
    nodes{ number title body url state createdAt updatedAt closedAt ${AUTHOR} labels(first:10){nodes{name}} ${REACT} ${COMMENTS} } } } }`,
  pulls: `query($o:String!,$n:String!,$a:String){ repository(owner:$o,name:$n){ pullRequests(first:25,after:$a,orderBy:{field:CREATED_AT,direction:ASC}){ pageInfo{hasNextPage endCursor}
    nodes{ number title body url state merged createdAt updatedAt ${AUTHOR} headRefName headRepository{nameWithOwner} baseRefName labels(first:10){nodes{name}} ${REACT} ${COMMENTS}
      files(first:100){ nodes{ path additions deletions } } commits(first:60){ nodes{ commit{ oid messageHeadline } } } additions deletions } } } }`,
  discussions: `query($o:String!,$n:String!,$a:String){ repository(owner:$o,name:$n){ discussions(first:30,after:$a,orderBy:{field:CREATED_AT,direction:ASC}){ pageInfo{hasNextPage endCursor}
    nodes{ number title body url createdAt updatedAt closed ${AUTHOR} category{name} upvoteCount ${REACT} answer{ url }
      comments(first:60){ totalCount nodes{ ${AUTHOR} body createdAt url upvoteCount replies(first:30){ nodes{ ${AUTHOR} body createdAt url } } } } } } } }`,
};
async function conversations(full, kinds) {
  const [o, n] = full.split('/'), out = [];
  for (const kind of kinds) {
    let a = null;
    for (let page = 0; page < 60; page++) {
      let d; try { d = await gql(Q[kind], { o, n, a }); } catch (e) { console.error(`  ${full} ${kind}: ${e.message}`); break; }
      const conn = d && d.repository && d.repository[kind === 'pulls' ? 'pullRequests' : kind]; if (!conn) break;
      for (const x of conn.nodes) out.push(item(full, kind, x));
      if (!conn.pageInfo.hasNextPage) break; a = conn.pageInfo.endCursor;
    }
  }
  return out;
}
const plus = x => ((x.reactionGroups || []).find(g => g.content === 'THUMBS_UP') || { reactors: { totalCount: 0 } }).reactors.totalCount + (x.upvoteCount || 0);
function item(repo, kind, x) {
  const comments = ((x.comments && x.comments.nodes) || []).flatMap(c => [{ author: c.author && c.author.login, body: c.body || '', at: c.createdAt, url: c.url },
    ...((c.replies && c.replies.nodes) || []).map(r => ({ author: r.author && r.author.login, body: r.body || '', at: r.createdAt, url: r.url, reply: true }))]);
  return {
    key: x.url, repo, kind: kind === 'pulls' ? 'pull' : kind === 'issues' ? 'issue' : 'discussion', number: x.number, title: x.title, url: x.url,
    author: x.author && x.author.login, created: x.createdAt, updated: x.updatedAt, state: x.merged ? 'merged' : x.closed ? 'closed' : String(x.state || 'open').toLowerCase(),
    labels: ((x.labels && x.labels.nodes) || []).map(l => l.name), category: x.category && x.category.name, plus: plus(x), answered: !!(x.answer && x.answer.url),
    body: x.body || '', comments, commentCount: (x.comments && x.comments.totalCount) || 0,
    ...(kind === 'pulls' ? { head: `${(x.headRepository || {}).nameWithOwner || '?'}:${x.headRefName}`, base: x.baseRefName, additions: x.additions, deletions: x.deletions,
      files: ((x.files && x.files.nodes) || []).map(f => `${f.path} (+${f.additions} −${f.deletions})`), commits: ((x.commits && x.commits.nodes) || []).map(c => c.commit.messageHeadline) } : {}),
  };
}

// ---------- forks: what each branch has that the original doesn't ----------
async function forksOf(full, depth, seen) {
  if (depth <= 0) return [];
  const list = await restAll(`repos/${full}/forks?sort=newest`, 1000), out = [];
  for (const f of list) { if (seen.has(f.full_name)) continue; seen.add(f.full_name); out.push({ full: f.full_name, parent: full, owner: f.owner.login, pushed: f.pushed_at, created: f.created_at, issues: f.has_issues, discussions: f.has_discussions, stars: f.stargazers_count, description: f.description || '' });
    if (f.forks_count) out.push(...await forksOf(f.full_name, depth - 1, seen)); }
  return out;
}
async function forkWork(root, rootBranch, fork) {
  const branches = await restAll(`repos/${fork.full}/branches`, 300), work = [];
  for (const b of branches) {
    const [fo, fr] = fork.full.split('/');
    const c = await rest(`repos/${root}/compare/${encodeURIComponent(rootBranch)}...${fo}:${fr}:${encodeURIComponent(b.name)}`);
    if (!c || !c.ahead_by) continue;
    work.push({ branch: b.name, ahead: c.ahead_by, behind: c.behind_by, url: `https://github.com/${fork.full}/compare/${encodeURIComponent(rootBranch)}...${encodeURIComponent(b.name)}`,
      commits: (c.commits || []).map(x => ({ sha: x.sha.slice(0, 9), author: (x.author && x.author.login) || (x.commit.author && x.commit.author.name), date: x.commit.author && x.commit.author.date, message: x.commit.message.split('\n')[0], body: x.commit.message.split('\n').slice(1).join('\n').trim().slice(0, 1500) })),
      files: (c.files || []).map(f => ({ path: f.filename, status: f.status, add: f.additions, del: f.deletions })) });
  }
  // the same commits on several branches: one entry, the branch that has the most of them first
  work.sort((a, b) => b.ahead - a.ahead); const shas = new Set(), keep = [];
  for (const w of work) { const fresh = w.commits.filter(c => !shas.has(c.sha)); if (!fresh.length) continue; fresh.forEach(c => shas.add(c.sha)); keep.push(w); }
  return keep;
}

// ---------- sorting what people say (keyword rules, no AI) ----------
const RULES = [
  ['bug', /\b(crash(es|ed|ing)?|freez(e|es|ing)|frozen|black screen|not work(ing)?|does(n'?t| not) work|won'?t (start|launch|open|load)|error|fail(s|ed|ing)?|broken|bug|irresponsive|unresponsive|stuck|wrong|can'?t|cannot|unable)\b/i],
  ['feature', /\b(add(ed|ing)?|support(s|ed|ing)?|feature|would be (great|nice|awesome|cool)|it would be|option to|ability to|allow(s|ing)?|please (add|make|include)|request|wish|could you|can you|idea|integrat)\b/i],
  ['removal', /\b(remove|get rid of|disable|turn off|hide|without the|no longer show)\b/i],
  ['change', /\b(change|improve|instead|should|rename|better|tweak|adjust|make it|replace|move)\b/i],
  ['question', /(\?\s*$|\bhow (do|can|to)\b|\bis (it|there) (possible|a way)\b)/im],
];
function kindOf(it) {
  const L = it.labels.map(l => l.toLowerCase()), text = `${it.title}\n${it.body}`;
  if (L.some(l => /bug/.test(l))) return 'bug';
  if (L.some(l => /enhancement|feature|idea/.test(l)) || /idea|feature/i.test(it.category || '')) return 'feature';
  if (it.kind === 'pull') return 'code';
  for (const [k, re] of RULES) if (re.test(it.title)) return k; // the title says it best
  for (const [k, re] of RULES) if (re.test(text)) return k;
  return 'other';
}
// the sentences where someone asks for or reports something (template lines and quoted text left out)
const ASK = /\b(would|could|can you|please|add|support|feature|wish|want|need|should|instead|option|allow|crash|freez|black screen|not work|doesn'?t work|can'?t|cannot|error|fail|broken|bug|stuck|missing|request|ability)\b/i;
function asks(text) {
  const clean = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').split(/\r?\n/)
    .filter(l => !/^\s*>/.test(l) && !/^\s*\*\*(Boxshelf version|What happened|What you expected|How to make it happen again|Your setup|Problem report)\*\*/i.test(l) && !/^#+\s/.test(l)).join(' ');
  return clean.split(/(?<=[.!?])\s+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 12 && s.length < 400 && ASK.test(s)).slice(0, 6);
}

// ---------- what your repository already mentions ----------
function myMessages() {
  try { return execFileSync('git', ['log', '--all', '--format=%B%x00'], { encoding: 'utf8', maxBuffer: 64 << 20, cwd: path.join(__dirname, '..') }); } catch { return null; }
}
function mentioned(it, msgs) {
  if (!msgs) return '';
  const n = it.number, short = it.repo.split('/')[1];
  const pats = it.kind === 'pull' ? [new RegExp(`pull request #?${n}\\b`, 'i'), new RegExp(`${short}[^\\n]{0,40}pull/${n}\\b`, 'i')]
    : it.kind === 'issue' ? [new RegExp(`\\bissues?\\s+(\\d+\\s*(,|and|/|&)\\s*)*${n}\\b`, 'i'), new RegExp(`${short}/issues/${n}\\b`, 'i')]
    : [new RegExp(`${short}/discussions/${n}\\b`, 'i')];
  if (pats.some(re => re.test(msgs))) return 'mentioned';
  if (it.kind === 'discussion') { // commit messages name a discussion by what it asked for: two of its title's words in one that says "discussion"
    const words = it.title.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3 && !/^(support|with|from|that|this|games?|based|custom|their)$/.test(w));
    const hit = msgs.split('\0').some(m => /discussion/i.test(m) && words.filter(w => m.toLowerCase().includes(w)).length >= Math.min(2, words.length));
    if (hit && words.length) return 'maybe';
  }
  return '';
}

// ---------- the report ----------
const esc = s => String(s || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const day = s => String(s || '').slice(0, 10);
function excerpt(s, n = 280) { const t = String(s || '').replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }
const KIND_NAME = { bug: 'Bugs people report (fix)', feature: 'Features people ask for (add)', change: 'Changes people ask for (modify)', removal: 'Things people want gone (remove)', question: 'Questions', code: 'Pull requests (code someone wrote)', other: 'Other' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now(); console.log(`Community report → ${OUT}`);
  const data = { at: new Date().toISOString(), repos: [], items: [], forks: [], elsewhere: { repos: [], conversations: [], code: [], projects: [], skipped: [] } };
  const known = new Set([...REPOS, MINE]);

  for (const full of REPOS) {
    const r = await rest(`repos/${full}`); if (!r) { console.error(`  ${full}: not found`); continue; }
    data.repos.push({ full, branch: r.default_branch, issues: r.has_issues, discussions: r.has_discussions, stars: r.stargazers_count, forks: r.forks_count, pushed: r.pushed_at });
    const kinds = [...(r.has_issues ? ['issues'] : []), 'pulls', ...(r.has_discussions ? ['discussions'] : [])];
    const got = await conversations(full, kinds); data.items.push(...got); console.log(`  ${full}: ${got.length} issues / pull requests / discussions`);
  }

  if (FORKS) {
    const seen = new Set(known);
    for (const root of data.repos) {
      const forks = await forksOf(root.full, DEPTH, seen); console.log(`  ${root.full}: ${forks.length} forks`);
      for (const f of forks) {
        if (f.full === MINE) continue; // (yours: what it has is what this report is compared with)
        f.root = root.full; f.work = await forkWork(root.full, root.branch, f);
        const kinds = [...(f.issues ? ['issues'] : []), 'pulls', ...(f.discussions ? ['discussions'] : [])];
        const own = await conversations(f.full, kinds); own.forEach(x => { x.fork = f.full; }); data.items.push(...own);
        data.forks.push(f); known.add(f.full);
        process.stdout.write(`    ${f.full}: ${f.work.reduce((a, w) => a + w.commits.length, 0)} commits of its own${own.length ? `, ${own.length} conversations` : ''}\n`);
      }
    }
  }

  if (SEARCH) { // the rest of GitHub
    const isKnown = r => known.has(r) || data.forks.some(f => f.full === r);
    const repos = await restAll(`search/repositories?q=${encodeURIComponent(WORD)}+in:name,description,readme`, 300);
    for (const r of repos) { if (isKnown(r.full_name)) continue; // (its README too: a description alone rarely says what it is)
      let readme = ''; try { const x = await rest(`repos/${r.full_name}/readme`); readme = x && x.content ? Buffer.from(x.content, 'base64').toString('utf8').slice(0, 20000) : ''; } catch {}
      const text = `${r.full_name} ${r.description || ''} ${readme}`, about = ABOUT.test(text);
      (about ? data.elsewhere.repos : data.elsewhere.skipped).push({ full: r.full_name, url: r.html_url, description: r.description || '', stars: r.stargazers_count, pushed: r.pushed_at, fork: r.fork, derived: about && DERIVED.test(text) }); }
    const convs = await restAll(`search/issues?q=${encodeURIComponent(WORD)}`, 300);
    for (const i of convs) { const repo = (i.repository_url || '').split('/repos/')[1]; if (isKnown(repo)) continue;
      const c = { repo, url: i.html_url, title: i.title, kind: i.pull_request ? 'pull' : 'issue', state: i.state, author: i.user && i.user.login, created: i.created_at, body: i.body || '' };
      (ABOUT.test(`${c.repo} ${c.title} ${c.body}`) ? data.elsewhere.conversations : data.elsewhere.skipped).push(c); }
    const by = new Map();
    for (const q of CODE_QUERIES) { try { for (const c of await restAll(`search/code?q=${encodeURIComponent(q)}`, 200)) { const r = c.repository && c.repository.full_name; if (!r || isKnown(r)) continue; if (!by.has(r)) by.set(r, new Set()); by.get(r).add(c.path); } } catch (e) { console.error(`  code search ${q}: ${e.message}`); } await sleep(6500); } // (code search: 10 a minute)
    data.elsewhere.code = [...by].map(([repo, files]) => ({ repo, url: `https://github.com/${repo}`, files: [...files].slice(0, 10) }));
    // projects built from Boxshelf that aren't GitHub forks (a copy, a port): their recent commits and conversations, like a fork's
    // (only projects that say they're made from Boxshelf: a catalog that lists it, like an AppImage package manager, isn't one)
    for (const full of new Set(data.elsewhere.repos.filter(r => r.derived && !r.fork).map(r => r.full))) {
      const r = await rest(`repos/${full}`); if (!r) continue;
      const commits = (await restAll(`repos/${full}/commits`, 40)).slice(0, 40).map(x => ({ sha: x.sha.slice(0, 9), author: (x.author && x.author.login) || (x.commit.author && x.commit.author.name), date: x.commit.author && x.commit.author.date, message: x.commit.message.split('\n')[0] }));
      const own = await conversations(full, [...(r.has_issues ? ['issues'] : []), 'pulls', ...(r.has_discussions ? ['discussions'] : [])]); own.forEach(x => { x.fork = full + ' (related project)'; }); data.items.push(...own);
      data.elsewhere.projects.push({ full, url: r.html_url, description: r.description || '', pushed: r.pushed_at, stars: r.stargazers_count, commits });
    }
    console.log(`  elsewhere: ${data.elsewhere.repos.length} repositories, ${data.elsewhere.conversations.length} issues / pull requests, ${data.elsewhere.code.length} repositories with code, ${data.elsewhere.projects.length} related projects read (${data.elsewhere.skipped.length} results about something else left out)`);
  }

  // sort, mark, compare with last time
  const msgs = myMessages(), seenFile = path.join(OUT, 'seen.json'), doneFile = path.join(OUT, 'done.json');
  const before = (() => { try { return JSON.parse(fs.readFileSync(seenFile, 'utf8')); } catch { return null; } })();
  const done = (() => { try { return JSON.parse(fs.readFileSync(doneFile, 'utf8')); } catch { return {}; } })();
  if (!fs.existsSync(doneFile)) fs.writeFileSync(doneFile, JSON.stringify({ '(example) https://github.com/owner/repo/issues/1': { status: 'done', note: 'what was done, or why not' } }, null, 2) + '\n');
  for (const it of data.items) {
    it.type = kindOf(it); it.asks = [...asks(`${it.title}. ${it.body}`), ...it.comments.flatMap(c => asks(c.body).map(s => `${c.author}: ${s}`))].slice(0, 8);
    it.mine = mentioned(it, msgs); it.status = (done[it.key] && done[it.key].status) || ''; it.note = (done[it.key] && done[it.key].note) || '';
    const had = !!(before && before.items && it.key in before.items), last = had ? before.items[it.key] : 0;
    it.isNew = before ? !had : false; it.hasNewComments = had && it.comments.length > last;
  }
  const shown = data.items.filter(it => !SINCE || new Date(it.updated || it.created) >= SINCE);
  fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(data, null, 1));
  fs.writeFileSync(seenFile, JSON.stringify({ at: data.at, items: Object.fromEntries(data.items.map(it => [it.key, it.comments.length])), forks: Object.fromEntries(data.forks.map(f => [f.full, f.work.flatMap(w => w.commits.map(c => c.sha))])) }, null, 1));

  // ---- report.md ----
  const L = [], status = it => [it.status ? `**${it.status}**${it.note ? ` (${esc(it.note)})` : ''}` : '', it.mine === 'mentioned' ? 'named in (T)rustyShelf commits' : it.mine === 'maybe' ? 'maybe done (a commit names a discussion like it)' : ''].filter(Boolean).join(' · ') || 'open';
  const where = it => `${it.fork ? `${it.fork} (fork)` : it.repo.split('/')[1]} ${it.kind} #${it.number}`;
  L.push(`# Boxshelf community report`, '', `Made ${data.at.replace('T', ' ').slice(0, 16)} UTC by scripts/community-report.js (no AI: collected and sorted by keyword rules)${SINCE ? `, showing what changed since ${day(SINCE.toISOString())}` : ''}.`, '');
  L.push(`Read: ${data.repos.map(r => `${r.full} (${r.stars}★, ${r.forks} forks)`).join(', ')}; ${data.forks.length} forks; ${data.items.length} issues / pull requests / discussions; ${calls} API calls.`, '');
  const open = shown.filter(it => !['done', 'skip'].includes(it.status) && it.state !== 'closed' && it.state !== 'merged' || (it.kind === 'pull' && !it.mine && !it.status));
  L.push('## At a glance', '', '| Kind | Open | Of which not named in (T)rustyShelf yet |', '|---|---|---|');
  for (const k of Object.keys(KIND_NAME)) { const a = open.filter(it => it.type === k); if (a.length) L.push(`| ${KIND_NAME[k]} | ${a.length} | ${a.filter(it => !it.mine && !it.status).length} |`); }
  const forkCommits = data.forks.reduce((a, f) => a + f.work.reduce((b, w) => b + w.commits.length, 0), 0);
  L.push(`| Fork commits not in the original | ${forkCommits} (in ${data.forks.filter(f => f.work.length).length} forks) | |`, '');
  const fresh = shown.filter(it => it.isNew || it.hasNewComments);
  if (before) { L.push(`## New since the last report (${day(before.at)})`, ''); if (!fresh.length) L.push('Nothing new.', ''); for (const it of fresh) L.push(`- [${esc(it.title)}](${it.url}) · ${where(it)} · ${it.isNew ? 'new' : 'new comments'} · ${it.type}`); L.push(''); }
  for (const k of Object.keys(KIND_NAME)) {
    const list = shown.filter(it => it.type === k).sort((a, b) => (!!a.status - !!b.status) || (!!a.mine - !!b.mine) || (b.plus - a.plus) || (b.comments.length - a.comments.length) || String(b.created).localeCompare(a.created));
    if (!list.length) continue;
    L.push(`## ${KIND_NAME[k]} (${list.length})`, '');
    for (const it of list) {
      L.push(`### [${esc(it.title)}](${it.url})`, '', `${where(it)} · ${it.state} · by ${it.author || '?'} on ${day(it.created)} · 👍 ${it.plus} · ${it.comments.length} comments${it.labels.length ? ' · ' + it.labels.join(', ') : ''}${it.category ? ' · ' + it.category : ''} · status: ${status(it)}`, '');
      if (excerpt(it.body)) L.push(`> ${excerpt(it.body)}`, '');
      if (it.asks.length) { L.push('What is asked / reported:'); for (const a of it.asks) L.push(`- ${esc(a)}`); L.push(''); }
      if (it.kind === 'pull') { L.push(`Code: ${it.head} → ${it.base}, +${it.additions} −${it.deletions}${it.commits.length ? `; commits: ${it.commits.slice(0, 8).map(esc).join(' · ')}` : ''}`, ''); if (it.files.length) L.push(`Files: ${it.files.slice(0, 20).map(esc).join(', ')}`, ''); }
    }
  }
  L.push('## Forks: work not in the original', '');
  const withWork = data.forks.filter(f => f.work.length).sort((a, b) => String(b.pushed).localeCompare(a.pushed));
  if (!withWork.length) L.push('No fork has commits of its own.', '');
  const lastForks = (before && before.forks) || {};
  for (const f of withWork) {
    const named = msgs && new RegExp(`\\b${f.owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(msgs);
    L.push(`### [${f.full}](https://github.com/${f.full}) (fork of ${f.root}${f.parent !== f.root ? ` via ${f.parent}` : ''}, last push ${day(f.pushed)})${named ? ' · its owner is named in (T)rustyShelf commits (ported?)' : ''}`, '');
    if (f.description) L.push(`> ${esc(f.description)}`, '');
    for (const w of f.work) {
      L.push(`Branch \`${w.branch}\`: ${w.ahead} commits ahead, ${w.behind} behind · [compare](${w.url})`, '');
      for (const c of w.commits) L.push(`- ${c.sha} ${esc(c.message)} (${c.author || '?'}, ${day(c.date)})${before && !(lastForks[f.full] || []).includes(c.sha) ? ' · **new**' : ''}${msgs && msgs.includes(c.sha) ? ' · in (T)rustyShelf' : ''}`);
      L.push('', `Files: ${w.files.slice(0, 30).map(x => `${x.path} (${x.status}, +${x.add} −${x.del})`).join(', ')}${w.files.length > 30 ? ` and ${w.files.length - 30} more` : ''}`, '');
    }
  }
  const noWork = data.forks.filter(f => !f.work.length); if (noWork.length) L.push(`Forks with nothing of their own: ${noWork.map(f => f.full).join(', ')}.`, '');
  if (SEARCH) {
    L.push('## Elsewhere on GitHub', '');
    if (data.elsewhere.repos.length) { L.push('Repositories:', ''); for (const r of data.elsewhere.repos) L.push(`- [${r.full}](${r.url})${r.fork ? ' (fork)' : ''} · ${r.stars}★ · ${day(r.pushed)}${r.description ? ' · ' + esc(r.description) : ''}`); L.push(''); }
    if (data.elsewhere.conversations.length) { L.push('Issues and pull requests that mention it:', ''); for (const c of data.elsewhere.conversations) L.push(`- [${esc(c.title)}](${c.url}) · ${c.repo} ${c.kind} · ${c.state} · ${c.author || '?'} on ${day(c.created)}${excerpt(c.body, 160) ? ' · ' + esc(excerpt(c.body, 160)) : ''}`); L.push(''); }
    if (data.elsewhere.projects.length) { L.push('Projects built from Boxshelf (not GitHub forks): their latest commits', '');
      for (const p of data.elsewhere.projects) { L.push(`- [${p.full}](${p.url}) · ${p.stars}★ · last push ${day(p.pushed)}${p.description ? ' · ' + esc(p.description) : ''}`); for (const c of p.commits.slice(0, 15)) L.push(`  - ${c.sha} ${esc(c.message)} (${c.author || '?'}, ${day(c.date)})`); } L.push(''); }
    if (data.elsewhere.code.length) { L.push('Code that mentions it:', ''); for (const c of data.elsewhere.code) L.push(`- [${c.repo}](${c.url}): ${c.files.map(esc).join(', ')}`); L.push(''); }
    if (!data.elsewhere.repos.length && !data.elsewhere.conversations.length && !data.elsewhere.code.length) L.push('Nothing outside the repositories and forks above.', '');
    if (data.elsewhere.skipped.length) L.push(`(${data.elsewhere.skipped.length} search results were about other things called box shelf, and are left out; they're in data.json under elsewhere.skipped.)`, '');
  }
  fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n') + '\n');
  console.log(`Done in ${Math.round((Date.now() - t0) / 1000)} s, ${calls} API calls: ${path.join(OUT, 'report.md')}`);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
