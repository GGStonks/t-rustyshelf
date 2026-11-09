// (T)rustyShelf: who made a change brought in from another fork, and how to credit them so GitHub shows it.
// Used by scripts/fork-survey.js (the credit lines for a port, the README's list) and scripts/release-notes.js (the release's
// "Thanks" with @names, which GitHub turns into the release's Contributors).
//
// How GitHub credits someone, from the strongest:
//   - the commit's author: a cherry-pick keeps it; a port by hand gets it with `git commit --author="<author line>"`. GitHub
//     shows their avatar on the commit and counts them in the repository's Contributors (commits on the default branch).
//   - a `Co-authored-by: Name <address>` trailer: their avatar on the commit too (for the others, when several made it).
//   - an @name in a release's notes: the release page lists them under Contributors.
// The address is GitHub's no-reply one (<id>+<login>@users.noreply.github.com): it always links to the account, and it
// never puts anyone's real e-mail in (T)rustyShelf's history.
// A port also says where it comes from: a `Ported-from: https://github.com/<owner>/<repo>/commit/<sha>` trailer (and
// `git cherry-pick -x` writes "(cherry picked from commit <sha>)"). fork-survey.js reads both to know what was integrated.
'use strict';
const { execFileSync } = require('child_process');

const NOREPLY = /^(?:(\d+)\+)?([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)@users\.noreply\.github\.com$/i;
function noreply(email) { const m = NOREPLY.exec(String(email || '').trim()); return m ? { id: m[1] ? +m[1] : null, login: m[2] } : null; }
// the address that links to someone's GitHub account (their own one when the account isn't known)
function address(p) { return p.login && p.id ? `${p.id}+${p.login}@users.noreply.github.com` : p.email || (p.login ? `${p.login}@users.noreply.github.com` : ''); }
// the name to show: the commit's author name, unless it's broken (a git set up with an error message as its name, say: it
// happens) — then the login
function displayName(p) { const n = String(p.name || '').trim(); return n && n.length <= 80 && !/[\r\n{}<>"]/.test(n) ? n : p.login || String(p.email || '').split('@')[0] || '?'; }
function credit(p) { const who = `${displayName(p)} <${address(p)}>`; return { author: who, trailer: `Co-authored-by: ${who}` }; }

const PORTED = /^Ported-from:\s*(https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/commit\/([0-9a-f]{7,40}))\s*$/gim;
const PICKED = /\(cherry picked from commit ([0-9a-f]{7,40})\)/gi;
const COAUTHOR = /^Co-authored-by:\s*(.*?)\s*<([^>]+)>\s*$/gim;
// where a commit of yours comes from: [{ sha, url?, repo? }]
function sources(msg) {
  const out = [], s = String(msg || '');
  for (const m of s.matchAll(PORTED)) out.push({ sha: m[3].toLowerCase(), url: m[1], repo: m[2] });
  for (const m of s.matchAll(PICKED)) if (!out.some(o => o.sha.startsWith(m[1].toLowerCase()) || m[1].toLowerCase().startsWith(o.sha))) out.push({ sha: m[1].toLowerCase() });
  return out;
}
// everyone a commit names: its author, then its Co-authored-by lines (once each)
function people(c) {
  const all = [{ name: c.name, email: c.email }], out = [], keys = new Set();
  for (const m of String(c.msg || '').matchAll(COAUTHOR)) all.push({ name: m[1], email: m[2] });
  for (const p of all) { const n = noreply(p.email), q = { name: p.name, email: p.email, login: n ? n.login : '', id: n ? n.id : null };
    const k = (q.login || q.email || q.name || '').toLowerCase(); if (!k || keys.has(k)) continue; keys.add(k); out.push(q); }
  return out;
}
// you, Claude and bots: never "thanked"
const BOT = /\[bot\]|^(github-actions|dependabot|copilot)\b/i;
function isUs(p, me) {
  const e = String(p.email || '').toLowerCase(), l = String(p.login || '').toLowerCase();
  if (/@anthropic\.com$/.test(e) || BOT.test(p.name || '') || BOT.test(l)) return true;
  return (!!l && me.logins.includes(l)) || (!!e && me.emails.includes(e));
}
// who "you" are: the given login(s) and this repository's git e-mail (read here, never written anywhere)
function identity(root, logins) {
  let email = ''; try { email = execFileSync('git', ['config', 'user.email'], { cwd: root, encoding: 'utf8' }).trim().toLowerCase(); } catch {}
  return { logins: [].concat(logins || []).map(s => String(s).toLowerCase()).filter(Boolean), emails: email ? [email] : [] };
}
function log(root, range) {
  try {
    return execFileSync('git', ['log', '--no-merges', '--format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%B%x1e', ...[].concat(range)], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20 })
      .split('\x1e').map(s => s.replace(/^\n/, '')).filter(Boolean).map(s => { const [sha, name, email, date, subject, msg] = s.split('\x1f'); return { sha, name, email, date, subject, msg }; });
  } catch { return []; }
}
// the people (not you) whose work is in these commits, each with what they made: [{ person, items: [{ sha, subject, sources }] }]
// lookup(commit, person) may fill in a login GitHub knows (for an author whose address isn't the no-reply one)
function thanks(commits, me, lookup) {
  const by = new Map();
  for (const c of commits) for (const p of people(c)) {
    if (!p.login && lookup) Object.assign(p, lookup(c, p) || {});
    if (isUs(p, me)) continue;
    const k = (p.login || p.email || p.name).toLowerCase(); if (!by.has(k)) by.set(k, { person: p, items: [] });
    by.get(k).items.push({ sha: c.sha, subject: c.subject, sources: sources(c.msg) });
  }
  return [...by.values()];
}
// the commits of a release: after the release before it (vA.B.C.0), up to its tag (or HEAD, when it isn't tagged here yet)
const relTag = /^v(\d+)\.(\d+)\.(\d+)\.0$/;
function releaseRange(root, version) {
  const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
  const tag = `v${version}`, end = git('rev-parse', '-q', '--verify', `refs/tags/${tag}`) ? tag : 'HEAD';
  const num = t => relTag.exec(t).slice(1).map(Number), cmp = (a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  const before = git('tag', '--merged', `${end}^`, '--list', 'v*').split('\n').filter(t => relTag.test(t) && t !== tag).sort(cmp).pop();
  return before ? `${before}..${end}` : end;
}
// the GitHub login of a commit's author, asked through `gh` (null when GitHub doesn't link it to an account)
function ghAuthor(repo, sha) {
  try { const [login, id] = execFileSync('gh', ['api', `repos/${repo}/commits/${sha}`, '--jq', '[.author.login // "", .author.id // ""] | @tsv'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).trim().split('\t');
    return login ? { login, id: id ? +id : null } : null; } catch { return null; }
}

module.exports = { noreply, address, displayName, credit, sources, people, isUs, identity, log, thanks, releaseRange, ghAuthor };
