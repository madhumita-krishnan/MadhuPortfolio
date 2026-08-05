#!/usr/bin/env node
/* Design-system snapshots.

   Madhu asked (2026-08-05) that "go back to the old design system" be a real thing she
   can say, not a thing I try to remember. So the whole look — tokens, generated CSS/JS,
   page content and the hero art — gets copied into snapshots/<name>/ and can be copied
   back verbatim.

   Snapshotting build.js as well as data/ is deliberate: on this site the design system
   is not only tokens. Half of it (the phone frame, the glass, the cursor, the hero
   layout) lives in makeCSS()/makeJS() inside build.js, so tokens alone would restore a
   palette onto the wrong structure.

     node tools/design-system.js list
     node tools/design-system.js snapshot <name> ["a one-line description"]
     node tools/design-system.js restore <name>          # backs the current state up first
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SNAPS = path.join(ROOT, 'snapshots');
/* everything that decides how the site looks */
const TRACKED = ['data', 'build.js', 'assets/hero'];

const rm = p => fs.rmSync(p, { recursive: true, force: true });
function copy(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const e of fs.readdirSync(src)) {
      if (e === '.DS_Store') continue;
      copy(path.join(src, e), path.join(dest, e));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function snapshot(name, note) {
  if (!name) die('snapshot needs a name, e.g. `node tools/design-system.js snapshot rainforest`');
  const dir = path.join(SNAPS, name);
  rm(dir);
  for (const rel of TRACKED) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) copy(src, path.join(dir, rel));
  }
  fs.writeFileSync(path.join(dir, 'SNAPSHOT.md'),
    `# ${name}\n\n${note || '(no description)'}\n\nTaken: ${new Date().toISOString()}\nHolds: ${TRACKED.join(', ')}\n\nRestore with:\n\n    node tools/design-system.js restore ${name}\n`);
  console.log(`Snapshot "${name}" written to snapshots/${name}/`);
  if (note) console.log(`  ${note}`);
}

function restore(name) {
  if (!name) die('restore needs a name — run `node tools/design-system.js list` to see them');
  const dir = path.join(SNAPS, name);
  if (!fs.existsSync(dir)) die(`no snapshot called "${name}". Available: ${listNames().join(', ') || '(none)'}`);
  /* never destroy the current look to restore an old one */
  const backup = 'before-restoring-' + name;
  snapshot(backup, `Automatic backup taken before restoring "${name}".`);
  for (const rel of TRACKED) {
    const src = path.join(dir, rel);
    if (!fs.existsSync(src)) continue;
    rm(path.join(ROOT, rel));
    copy(src, path.join(ROOT, rel));
  }
  console.log(`\nRestored "${name}". The previous state is saved as "${backup}".`);
  console.log('Run `node build.js` to rebuild dist/.');
}

const listNames = () => fs.existsSync(SNAPS)
  ? fs.readdirSync(SNAPS, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name) : [];

function list() {
  const names = listNames();
  if (!names.length) return console.log('No snapshots yet.');
  for (const n of names) {
    const md = path.join(SNAPS, n, 'SNAPSHOT.md');
    const note = fs.existsSync(md) ? (fs.readFileSync(md, 'utf8').split('\n')[2] || '') : '';
    console.log(`  ${n.padEnd(28)} ${note}`);
  }
}

function die(msg) { console.error('Error: ' + msg); process.exit(1); }

const [cmd, name, note] = process.argv.slice(2);
if (cmd === 'snapshot') snapshot(name, note);
else if (cmd === 'restore') restore(name);
else if (cmd === 'list') list();
else console.log('Usage:\n  node tools/design-system.js list\n  node tools/design-system.js snapshot <name> ["description"]\n  node tools/design-system.js restore <name>');
