// UI screenshot tour with a mid-game save: node scripts/uishots.mjs <outdir>
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? 'screenshots';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const now = Date.now();
  const H = (id, level, stars, shards = 0) => [id, { id, level, stars, shards, obtainedAt: now }];
  const save = {
    version: 1, createdAt: now, lastSeen: now - 5 * 3600e3, lastAfkClaim: now - 5 * 3600e3,
    currencies: { yul: 182345, essence: 64321, gems: 5400, tickets: 4 },
    heroes: Object.fromEntries([H('asta', 30, 5, 4), H('noelle', 28, 4), H('finral', 28, 3), H('yuno', 30, 4), H('mimosa', 26, 3), H('henry', 25, 2), H('yami', 30, 4), H('charlotte', 25, 3), H('magna', 20, 2, 12), H('charmy', 20, 1), H('sol', 20, 2), H('luck', 22, 2), H('vanica', 22, 3), H('valtos', 20, 1)]),
    squad: { formation: 'vanguard', slots: ['noelle', 'asta', 'henry', 'yuno', 'finral'] },
    stage: 27, gacha: { pity: 13, mythicPity: 41, total: 60, firstTen: true },
    quests: { day: 'x', progress: {}, claimed: [] }, fastRewards: { day: 'x', used: 0 },
    settings: { autoUlt: true, speed: 2, autoAdvance: false, sound: false },
    seenChapter: 1, tutorialDone: true, stats: { battles: 40, wins: 31, ults: 220, pulls: 60 },
  };
  localStorage.setItem('black-clover-grimoire-squads/save-v1', JSON.stringify(save));
});
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const shot = async (n) => { await page.screenshot({ path: `${out}/u-${n}.png` }); console.log('shot', n); };
await shot('01-welcome');
await page.locator('.modal .btn.green').click();
await page.waitForTimeout(300);
await shot('02-home-chest');
await page.locator('.afk-card .btn.green').click();
await page.waitForTimeout(250);
await shot('03-claimed');
await page.locator('.topbar .icon-btn').first().click();
await page.waitForTimeout(400);
await shot('04-quests');
await page.locator('.modal-close').click();
await page.locator('.nav-item', { hasText: 'Squad' }).click();
await page.waitForTimeout(400);
await shot('05-squad');
await page.locator('.content').evaluate((el) => (el.scrollTop = 620));
await page.waitForTimeout(200);
await shot('06-squad-synergy');
await page.locator('.nav-item', { hasText: 'Heroes' }).click();
await page.waitForTimeout(300);
await page.locator('.hero-card', { hasText: 'Henry' }).first().click();
await page.waitForTimeout(400);
await page.locator('.modal').evaluate((el) => (el.scrollTop = 520));
await page.waitForTimeout(200);
await shot('07-henry-abilities');
await page.locator('.modal-close').click();
await page.locator('.nav-item', { hasText: 'Battle' }).click();
await page.waitForTimeout(300);
await page.locator('.btn.red.big').click();
await page.waitForTimeout(700);
await shot('08-story-1');
await page.locator('.story').click();
await page.waitForTimeout(400);
await page.locator('.story').click();
await page.waitForTimeout(600);
await shot('09-story-3');
await page.locator('.story').click();
await page.waitForTimeout(3500);
await shot('10-battle');
await page.waitForTimeout(4000);
await shot('11-battle');
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
