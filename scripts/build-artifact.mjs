// Build the game as one self-contained HTML page for a claude.ai artifact.
// Usage: node scripts/build-artifact.mjs [out.html]
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const out = process.argv[2] ?? 'dist-artifact/grimoire-squads.html';
execSync('npx vite build --mode artifact', { stdio: 'inherit' });

const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8'));
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8'));
if (js.length !== 1) throw new Error(`expected one JS chunk, got ${js.length}`);
if (/url\((?!data:)/.test(css.join(''))) throw new Error('CSS still references external files');

// The artifact skeleton already pads the page by the phone's safe areas.
const artifactCss = ':root{--safe-top:0px;--safe-bottom:0px;color-scheme:dark}html,body{height:100%;background:#08060d}';
const script = js[0].replace(/<\/script/gi, '<\\/script');

const html = `<title>Grimoire Squads</title>
<meta name="theme-color" content="#140f22">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Nunito:wght@600;800;900&display=swap">
<style>${css.join('\n')}
${artifactCss}</style>
<div id="app"></div>
<script type="module">${script}</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
