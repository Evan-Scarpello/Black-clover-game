// Battle screenshot burst: node scripts/battleshots.mjs <outdir> [stage]
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'screenshots';
const stage = +(process.argv[3] ?? 9);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript((stage) => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const now = Date.now();
  const H = (id, level, stars) => [id, { id, level, stars, shards: 0, obtainedAt: now }];
  const save = {
    version: 1, createdAt: now, lastSeen: now, lastAfkClaim: now - 3 * 3600e3,
    currencies: { yul: 123456, essence: 54321, gems: 4200, tickets: 3 },
    heroes: Object.fromEntries([H('asta', 14, 4), H('noelle', 14, 3), H('finral', 14, 2), H('yuno', 14, 4), H('mimosa', 14, 2), H('magna', 10, 1), H('charmy', 10, 1), H('sol', 10, 1)]),
    squad: { formation: 'balanced', slots: ['noelle', 'asta', 'yuno', 'finral', 'mimosa'] },
    stage, gacha: { pity: 3, mythicPity: 12, total: 20, firstTen: true },
    quests: { day: 'x', progress: {}, claimed: [] }, fastRewards: { day: 'x', used: 0 },
    settings: { autoUlt: true, speed: 1, autoAdvance: false, sound: false },
    seenChapter: 99, tutorialDone: true, stats: { battles: 0, wins: 0, ults: 0, pulls: 0 },
  };
  localStorage.setItem('black-clover-grimoire-squads/save-v1', JSON.stringify(save));
}, stage);
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/b00-home.png` });
await page.locator('.nav-item', { hasText: 'Battle' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/b01-campaign.png` });
await page.locator('.btn.red.big').click();
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(i < 2 ? 500 : 900);
  await page.screenshot({ path: `${out}/b1${i.toString(16)}-battle.png` });
}
await page.waitForTimeout(25000);
await page.screenshot({ path: `${out}/b2-end.png` });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
