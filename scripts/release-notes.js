// Based on Boxshelf by sassiestrhihno (https://github.com/sassiestrhihno/boxshelf-source, GPL-3.0): this file is Boxshelf's
// scripts/release-notes.js with the app's name ((T)rustyShelf) and a "Thanks" part added.
// Prints a version's notes (renderer/whatsnew.js, the same ones the app shows) as Markdown for its GitHub release, so the
// release page, the update card's highlights and Settings → What's new always say the same thing.
//   node scripts/release-notes.js            the newest version
//   node scripts/release-notes.js 1.82.0-beta.7
//   --no-thanks                               without the "Thanks" part
//   --repo owner/name                         your repository (default GGStonks/t-rustyshelf), to ask GitHub who an author is
// "Thanks" (release page only, not the app): everyone else whose commits (as author or Co-authored-by) are in this release,
// with @names, so GitHub lists them under the release's Contributors. See scripts/credits.js.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const credits = require('./credits.js');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf('--' + n); return i < 0 ? d : argv[i + 1]; };
const REPO = String(opt('repo', 'GGStonks/t-rustyshelf'));
const box = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'renderer', 'whatsnew.js'), 'utf8'), box);
const all = box.window.BS_WHATSNEW || [], want = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--repo');
const e = want ? all.find(x => x.version === want || x.android === want) : all[0];
if (!e) { console.error(`No notes for ${want || 'any version'} in renderer/whatsnew.js`); process.exit(1); }
// the highlights come first as bullets: the update card shows the first three of them
const out = [`## ${e.title}`, '', ...e.highlights.map(h => `- ${h}`), ''];
if (e.platforms && e.platforms.length) { out.push('### Where it works', ''); for (const p of e.platforms) out.push(`- ${p}`); out.push(''); }
for (const s of e.sections || []) { out.push(`### ${s.h}`, ''); for (const [h, more] of s.items) out.push(`- **${h}**: ${more}`); out.push(''); }
if (!argv.includes('--no-thanks')) {
  const me = credits.identity(ROOT, REPO.split('/')[0]);
  const who = credits.thanks(credits.log(ROOT, credits.releaseRange(ROOT, e.version)), me, c => credits.ghAuthor(REPO, c.sha));
  if (who.length) {
    out.push('### Thanks', '', 'Some of this release is other people\'s work, brought into (T)rustyShelf:', '');
    for (const { person: p, items } of who) out.push(`- ${p.login ? '@' + p.login : credits.displayName(p)}: ${items.map(i => i.subject + (i.sources[0] && i.sources[0].url ? ` ([original](${i.sources[0].url}))` : '')).join('; ')}`);
    out.push('');
  }
}
process.stdout.write(out.join('\n'));
