import type { Combatant, TeamSetup } from '../game/battle';
import { rng } from '../game/rng';
import { RARITY_INFO } from '../game/stats';
import type { HeroDef } from '../game/types';
import { FORMATION_MAP } from './formations';
import { getHero } from './heroes';

export interface StoryPanel {
  speaker: string;
  heroId?: string;
  text: string;
}

export interface ChapterDef {
  name: string;
  subtitle: string;
  sky: [string, string];
  ground: string;
  accent: string;
  minions: string[];
  elites: string[];
  boss: string;
  story: StoryPanel[];
}

export const STAGES_PER_CHAPTER = 10;

export const CHAPTERS: ChapterDef[] = [
  {
    name: 'Hage Village',
    subtitle: 'The Boy Without Magic',
    sky: ['#ffb36b', '#ff7a59'],
    ground: '#6b8f3a',
    accent: '#ffd36b',
    minions: ['bandit', 'bandit_mage', 'magic_beast'],
    elites: [],
    boss: 'revchi',
    story: [
      { speaker: 'Asta', heroId: 'asta', text: "No magic? No problem! I'll become the Wizard King anyway!" },
      { speaker: 'Yuno', heroId: 'yuno', text: 'Bandits are circling the village. Someone wants our grimoires.' },
      { speaker: 'Revchi', heroId: 'revchi', text: 'Hand over that four-leaf grimoire, peasant!' },
    ],
  },
  {
    name: 'The Dungeon',
    subtitle: 'Treasure of the Ancients',
    sky: ['#3a2f5b', '#1e1736'],
    ground: '#4a4a5e',
    accent: '#80deea',
    minions: ['golem', 'diamond_mage', 'magic_beast'],
    elites: ['diamond_mage'],
    boss: 'mars',
    story: [
      { speaker: 'Yami', heroId: 'yami', text: "A dungeon just popped up. Go clear it. Don't die, it's a hassle." },
      { speaker: 'Noelle', heroId: 'noelle', text: "W-with my water magic, this'll be easy! Probably!" },
      { speaker: 'Mars', heroId: 'mars', text: 'The Diamond Kingdom claims this treasure.' },
    ],
  },
  {
    name: 'Royal Capital Raid',
    subtitle: 'The Eye Opens',
    sky: ['#ff9a8b', '#7b4397'],
    ground: '#8d6e63',
    accent: '#fff3b0',
    minions: ['acolyte', 'bandit_mage'],
    elites: ['sally', 'valtos'],
    boss: 'fana',
    story: [
      { speaker: 'Finral', heroId: 'finral', text: 'The capital is under attack! Everyone into the portal — go, go, go!' },
      { speaker: 'Sally', heroId: 'sally', text: 'Ooh, Magic Knights! Can I keep one as a specimen?' },
      { speaker: 'Fana', heroId: 'fana', text: 'Salamander... burn the city.' },
    ],
  },
  {
    name: 'Underwater Temple',
    subtitle: 'Despair Beneath the Waves',
    sky: ['#4fc3f7', '#0d47a1'],
    ground: '#26a69a',
    accent: '#b3e5fc',
    minions: ['acolyte', 'magic_beast'],
    elites: ['fana', 'valtos'],
    boss: 'vetto',
    story: [
      { speaker: 'Noelle', heroId: 'noelle', text: 'The sea is my element. I will not lose here!' },
      { speaker: 'Asta', heroId: 'asta', text: 'Something huge is waiting at the bottom of this temple...' },
      { speaker: 'Vetto', heroId: 'vetto', text: 'Show me your despair! It is so BEAUTIFUL!' },
    ],
  },
  {
    name: 'Royal Knights Exam',
    subtitle: 'Prove Your Worth',
    sky: ['#ffe082', '#ff8f00'],
    ground: '#a1887f',
    accent: '#ffcc80',
    minions: ['klaus', 'sol', 'leopold'],
    elites: ['langris', 'mimosa', 'luck'],
    boss: 'mereoleona',
    story: [
      { speaker: 'Langris', heroId: 'langris', text: 'The Royal Knights will be made of the elite. Not trash.' },
      { speaker: 'Leopold', heroId: 'leopold', text: "Asta! This is where I surpass you, my rival!" },
      { speaker: 'Mereoleona', heroId: 'mereoleona', text: "Weaklings! You'll survive my training or burn trying!" },
    ],
  },
  {
    name: 'Elf Reincarnation',
    subtitle: 'The Sun Rises at Midnight',
    sky: ['#e1bee7', '#4a148c'],
    ground: '#7cb342',
    accent: '#fff59d',
    minions: ['acolyte'],
    elites: ['fana', 'vetto', 'sally', 'valtos'],
    boss: 'licht',
    story: [
      { speaker: 'William', heroId: 'william', text: 'The elves have returned in the bodies of our knights.' },
      { speaker: 'Yuno', heroId: 'yuno', text: "Even if the enemy wears a friend's face — I won't stop." },
      { speaker: 'Licht', heroId: 'licht', text: 'Humans... this grief will never be forgotten.' },
    ],
  },
  {
    name: 'Spade Kingdom Raid',
    subtitle: 'The Dark Triad',
    sky: ['#5c4d7d', '#120a1f'],
    ground: '#37304a',
    accent: '#b388ff',
    minions: ['spade_soldier', 'imp'],
    elites: ['zenon', 'vanica', 'megicula'],
    boss: 'dante',
    story: [
      { speaker: 'Nozel', heroId: 'nozel', text: 'We strike the Spade Kingdom before they strike us.' },
      { speaker: 'Vanica', heroId: 'vanica', text: "Ooh, new toys! Let's play!" },
      { speaker: 'Dante', heroId: 'dante', text: 'Humans are fundamentally evil. I will prove it.' },
    ],
  },
  {
    name: 'Gate of the Underworld',
    subtitle: 'Kneel Before the Devil King',
    sky: ['#b71c1c', '#1a0000'],
    ground: '#3e2723',
    accent: '#ff8a80',
    minions: ['imp', 'spade_soldier'],
    elites: ['dante', 'vanica', 'zenon', 'megicula'],
    boss: 'lucifero',
    story: [
      { speaker: 'Asta', heroId: 'asta', text: "The gate is opening! Liebe, let's do this together!" },
      { speaker: 'Yami', heroId: 'yami', text: 'Surpass your limits. Right here. Right now.' },
      { speaker: 'Lucifero', heroId: 'lucifero', text: 'Insects. Kneel before the true king.' },
    ],
  },
  {
    name: "Paladin's Ascension",
    subtitle: 'The Sorcerer King',
    sky: ['#fff8e1', '#ffb300'],
    ground: '#8d6e63',
    accent: '#ffe082',
    minions: ['spade_soldier', 'imp'],
    elites: ['dante', 'vanica', 'zenon', 'megicula'],
    boss: 'lucius',
    story: [
      { speaker: 'Julius', heroId: 'julius', text: '...So the one sharing my body has awakened.' },
      { speaker: 'Lucius', heroId: 'lucius', text: 'I will create a world without suffering. Rise, my Paladins.' },
      { speaker: 'Asta', heroId: 'asta', text: "A world without choice isn't peace. We'll stop you!" },
    ],
  },
];

export interface StageInfo {
  index: number;
  chapterIdx: number;
  chapter: ChapterDef;
  num: number;
  loop: number;
  isBoss: boolean;
  label: string;
  name: string;
  level: number;
  team: TeamSetup;
  rewards: { yul: number; essence: number };
  firstClear: { gems: number; tickets: number };
}

const NORMAL_FORMATIONS = ['balanced', 'vanguard', 'balanced', 'spearhead', 'vanguard', 'fortress', 'balanced', 'vanguard', 'blitz'];

function frontness(h: HeroDef): number {
  if (h.role === 'Defender') return 3;
  if (h.range === 'melee') return 2;
  if (h.role === 'Attacker') return 1;
  return 0;
}

export const DIFFICULTY = { levelSlope: 1.0, base: 1.7, growth: 0.0 };

export function stageLevel(index: number): number {
  return 1 + Math.floor(index * DIFFICULTY.levelSlope);
}

/** Extra stat multiplier for enemies so the campaign outpaces raw levels. */
export function stageMult(index: number): number {
  return DIFFICULTY.base * (1 + DIFFICULTY.growth * index);
}

export function getStage(index: number): StageInfo {
  const chapterIdx = Math.floor(index / STAGES_PER_CHAPTER);
  const loop = Math.floor(chapterIdx / CHAPTERS.length);
  const chapter = CHAPTERS[chapterIdx % CHAPTERS.length];
  const k = index % STAGES_PER_CHAPTER;
  const isBoss = k === STAGES_PER_CHAPTER - 1;
  const r = rng(index * 7919 + 13);
  const level = stageLevel(index);
  const baseStars = Math.min(7, 1 + Math.floor(index / 20));

  const ids: { id: string; boss?: boolean }[] = [];
  const elitePool = chapter.elites.length ? [...chapter.elites] : [...chapter.minions];
  // Elites are drawn without replacement (no twin Dantes) until the pool runs dry.
  let bag: string[] = [];
  const draw = () => {
    if (!bag.length) bag = [...elitePool];
    return bag.splice(Math.floor(r() * bag.length), 1)[0];
  };
  if (isBoss) {
    ids.push({ id: chapter.boss, boss: true });
    for (let i = 0; i < 2; i++) ids.push({ id: draw() });
    while (ids.length < 5) ids.push({ id: chapter.minions[Math.floor(r() * chapter.minions.length)] });
  } else {
    const nElites = Math.min(3, [0, 0, 0, 1, 1, 1, 1, 2, 2][k] + (chapterIdx >= 3 ? 1 : 0) + loop);
    for (let i = 0; i < nElites; i++) ids.push({ id: draw() });
    while (ids.length < 5) ids.push({ id: chapter.minions[Math.floor(r() * chapter.minions.length)] });
  }

  const formationId = isBoss ? 'balanced' : chapterIdx === 0 ? (k < 5 ? 'balanced' : 'vanguard') : NORMAL_FORMATIONS[(k + chapterIdx) % NORMAL_FORMATIONS.length];
  const formation = FORMATION_MAP[formationId];
  const sorted = ids
    .map((x) => ({ ...x, def: getHero(x.id) }))
    .sort((a, b) => frontness(b.def) - frontness(a.def) || Number(!!b.boss) - Number(!!a.boss));
  const members: Combatant[] = sorted.map((x, slot) => ({
    heroId: x.id,
    slot,
    level: x.boss ? level + 3 : level,
    stars: Math.max(RARITY_INFO[x.def.rarity].startStars, baseStars),
    boss: x.boss,
    // Normalise rarity so elites differ from minions by kit, not raw stats.
    mult: stageMult(index) / RARITY_INFO[x.def.rarity].mult,
  }));

  const num = k + 1;
  return {
    index,
    chapterIdx,
    chapter,
    num,
    loop,
    isBoss,
    label: `${chapterIdx + 1}-${num}`,
    name: isBoss ? `BOSS: ${getHero(chapter.boss).name}` : `${chapter.name}${loop ? ` ★${loop}` : ''}`,
    level,
    team: { members, formation },
    rewards: { yul: 150 + 40 * index, essence: 90 + 25 * index },
    firstClear: isBoss ? { gems: 200, tickets: 1 } : { gems: 30, tickets: 0 },
  };
}

/** AFK income per hour given the number of stages cleared. */
export function afkRates(cleared: number) {
  return {
    yul: (60 + 15 * cleared) * 60,
    essence: (30 + 8 * cleared) * 60,
    gems: 20 + Math.floor(cleared / 2),
  };
}

export const AFK_CAP_HOURS = 12;
