# Black Clover: Grimoire Squads

An idle squad RPG gacha **fan game** set in the world of Black Clover, inspired by *Invincible: Guarding the Globe*. You summon Magic Knights and villains, build a 5-hero squad, choose a formation and let the auto-battles run. Your squad keeps earning rewards while you're away.

Built as a mobile web game (TypeScript + Preact) and wrapped with **Capacitor** for **iOS, Android and Amazon Fire** devices. All character art is cartoon chibi SVG drawn in code, so the game ships no image assets.

> **Fan project disclaimer:** Black Clover and its characters belong to Yūki Tabata / Shueisha. This project is not affiliated with or endorsed by the rights holders. Publishing it on the App Store, Google Play or the Amazon Appstore requires a license for the IP. Otherwise, re-skin the roster with original characters first.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173  (open with a phone-sized viewport)
npm test             # engine, gacha and campaign tests
npm run build        # typecheck + production build into dist/
```

Dev-only character gallery: `http://localhost:5173/gallery.html` (supports `?id=asta,yuno&size=400`).

## Game overview

| System | What it does |
| --- | --- |
| **Squad of 5** | Attackers, Defenders and Supports. Melee or ranged. |
| **Formations** | 5 layouts unlock through the campaign: Balanced 2F·3B, Vanguard 3F·2B, Spearhead 1F·4B, Iron Fortress 4F·1B and Clover Blitz 5F. Each one gives row bonuses. |
| **Formation traits** | Every hero gets a different bonus in the **front** row than in the **back** row, so placement matters. |
| **Formation-shifting abilities** | Ultimates can change formations mid-battle. Finral swaps the wounded to the back row, Henry rebuilds the whole line, Asta dashes into the front row. Charlotte and Langris drag enemies forward. Valtos scrambles the enemy formation. Finral's passive also warps nearly-dead front-liners to safety. |
| **Synergies & bonds** | Faction bonuses at 2/3/5 members: Black Bulls, Golden Dawn, Magic Knights, Midnight Sun and Spade Kingdom. Bonds pair specific heroes (Asta + Yuno "Rivals", House Silva, House Vermillion, the Zogratis siblings and others). |
| **Auto-battle** | Real-time, energy-based. Ultimates fire automatically, or switch AUTO off and tap the glowing portraits. Speed is 1x/2x/3x, there's a skip button, and ⏩ auto-advances to the next stage after a win. After 45s, overtime halves healing and ramps up damage. |
| **Idle / AFK** | The hideout chest fills with Yul, Essence and Gems for up to 12h. You also get a free 2h Fast Reward each day, plus two more paid with gems. |
| **Gacha** | Rarities are Rare (60%), Epic (30%), Legendary (8.5%) and Mythic (1.5%). Every ×10 guarantees an Epic or better. Legendary pity is 40 pulls, Mythic pity is 100, and the first ×10 guarantees a Legendary. A weekly featured banner rate-ups one Mythic and two Legendaries. Duplicates become grimoire pages for Star Ups. |
| **Progression** | Level heroes with Yul and Essence. Star Ups (1★–7★) raise the level cap. |
| **Campaign** | 9 chapters × 10 stages, with comic-panel story intros and a boss every 10th stage. After that it loops into harder "Abyss" stages forever. |
| **Daily quests** | Six dailies plus a bonus for completing all of them. |

### Roster (33 summonable)

- **Mythic:** Asta, Yuno, Yami Sukehiro, Julius Novachrono, Lucius Zogratis
- **Legendary:** Noelle, Mereoleona, Fuegoleon, Nozel, Charlotte, William, Dante, Vanica, Licht
- **Epic:** Finral, Luck, Vanessa, Gauche, Mimosa, Langris, Henry, Zenon, Fana, Vetto, Megicula
- **Rare:** Magna, Charmy, Gordon, Klaus, Sol, Leopold, Valtos, Sally
- **Enemies & bosses:** bandits, magic beasts, dungeon golems, Diamond mages, Midnight Sun acolytes, Spade soldiers, devils, Revchi, Mars and Lucifero

Every hero has a basic attack, an Ultimate, a Passive and a Formation Trait (`src/data/heroes.ts`).

## Project layout

```
src/
  art/          Parametric chibi SVG renderer (hair/face/body/props libraries + per-character specs)
  data/         Heroes & abilities, formations/synergies/bonds, campaign chapters
  game/         Battle engine, stats/economy, gacha, quests, save state & store
  ui/           Preact screens (Home, Heroes, Squad, Campaign, Battle, Summon, Story...) + styles
tests/          Vitest: engine determinism, every ultimate fires, formation shifts, gacha pity, campaign
scripts/        Playwright screenshot tours used for visual QA (play.mjs, battleshots.mjs, uishots.mjs)
android/ ios/   Capacitor native projects
```

The battle engine (`src/game/battle.ts`) is deterministic and UI-free. Abilities are data (`Effect` lists), so adding a hero only needs a data entry plus an art spec in `src/art/specs.ts`.

Balance report: `DBG=1 npx vitest run tests/balance.test.ts` simulates a starter team, a mid team and a strong team at several levels and prints the furthest stage each one clears.

## Building for mobile

The web build is copied into the native projects with Capacitor.

```bash
npm run build && npx cap sync      # copy dist/ into android/ and ios/
```

- **Android / Amazon Fire:** `npm run cap:android` opens Android Studio. Build an APK/AAB and upload it to Google Play and/or the **Amazon Appstore**. Fire OS runs the same build because the game uses no Google Play Services.
- **iOS:** on a Mac with Xcode + CocoaPods, run `npm run cap:ios` (it runs `pod install` via `cap sync`), then archive in Xcode.
- **Icons/splash:** source icon at `resources/icon.png` (1024²). Generate every platform size with `npx @capacitor/assets generate`.
- Both apps are locked to portrait.

Saves live in WebView `localStorage` (`src/game/state.ts`). If you need cloud saves later, swap `loadSave`/`writeSave` for a backend.
