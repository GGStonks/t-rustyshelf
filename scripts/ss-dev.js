// ((T)rustyShelf issue 26) Writes (T)rustyShelf's ScreenScraper developer login, from the SS_DEV_ID and SS_DEV_PASS
// environment variables (the repository's secrets in CI), to the file given: main/ss-dev.json for the desktop builds
// (main/screenscraper.js reads it), the APK's assets/ss-dev.json for Android. Without both nothing is written, and the
// app says plainly that ScreenScraper isn't available yet. The file is listed in .gitignore: it never goes into git.
// Run: SS_DEV_ID=... SS_DEV_PASS=... node scripts/ss-dev.js main/ss-dev.json
'use strict';
const fs = require('fs'), path = require('path');
const out = process.argv[2], id = String(process.env.SS_DEV_ID || '').trim(), pass = String(process.env.SS_DEV_PASS || '');
if (!out) { console.error('usage: node scripts/ss-dev.js <file>'); process.exit(2); }
if (!id || !pass) { console.log('ScreenScraper developer login: no SS_DEV_ID / SS_DEV_PASS, skipped'); process.exit(0); }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ devId: id, devPass: pass }));
console.log('ScreenScraper developer login: written to ' + out); // (the file's path only, never what's in it)
