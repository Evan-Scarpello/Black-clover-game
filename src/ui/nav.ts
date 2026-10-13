// Navigation contract shared by every screen and feature module.
import type { ComponentType } from 'preact';
import type { Battle, TeamSetup } from '../game/battle';
import type { Reward, SaveState } from '../game/state';

export type Tab = 'home' | 'heroes' | 'campaign' | 'squad' | 'summon';

/** Full-screen feature pages pushed on top of the tabs. */
export type ScreenId = 'arena' | 'clan' | 'tower' | 'dispatch' | 'shop' | 'pass' | 'login' | 'achievements';

/** What a finished battle shows on its result screen. */
export interface BattleOutcome {
  won: boolean;
  /** Big headline; defaults to VICTORY! / DEFEAT. */
  title?: string;
  reward?: Reward | null;
  /** Short highlight chips, e.g. "First clear bonus", "Rating +24". */
  notes?: string[];
  /** One headline stat, e.g. { label: 'Damage dealt', value: '1.2M' }. */
  stat?: { label: string; value: string };
  /** Primary follow-up button (e.g. Next Stage). `auto` lets auto-advance press it. */
  next?: { label: string; auto?: boolean; go: () => void };
  /** Offer Retry after a loss (default true). */
  canRetry?: boolean;
}

/** Everything the battle screen needs to run one fight of any mode. */
export interface BattleSpec {
  /** Unique per fight — changing it remounts the battle. */
  key: string;
  kind: 'campaign' | 'arena' | 'tower' | 'raid';
  /** Short tag shown in gold, e.g. "3-8", "Floor 12", "Arena". */
  label: string;
  title: string;
  theme: { sky: [string, string]; ground: string };
  ally: TeamSetup;
  enemy: TeamSetup;
  /** Seconds before the defender wins on time (default 90). */
  timeLimit?: number;
  /** Opening banner text (default "FIGHT!"). */
  banner?: string;
  /** Show the ⏩ auto-advance toggle (campaign). */
  allowAutoAdvance?: boolean;
  /** Record results and describe the result screen. Called exactly once. */
  finish: (battle: Battle) => BattleOutcome;
}

export interface Nav {
  tab: Tab;
  go(tab: Tab): void;
  /** Push a feature page. */
  open(screen: ScreenId, params?: Record<string, unknown>): void;
  /** Pop the top feature page. */
  back(): void;
  openHero(id: string): void;
  /** Campaign stage (plays the chapter story first when needed). */
  fight(stage: number): void;
  /** Any battle (arena, tower, clan raid, campaign). */
  battle(spec: BattleSpec): void;
  closeBattle(): void;
  openQuests(): void;
}

export interface ScreenProps {
  nav: Nav;
  params?: Record<string, unknown>;
}

/** A feature page registered in src/ui/screens/registry.ts. */
export interface ScreenDef {
  id: ScreenId;
  title: string;
  /** Emoji or short glyph for hub buttons. */
  icon: string;
  /** One-line pitch shown on locked/hub tiles. */
  blurb: string;
  component: ComponentType<ScreenProps>;
  /** Stages that must be cleared before the feature opens (default 0). */
  unlockStage?: number;
  /** Red dot when something is ready to collect. */
  badge?: (s: SaveState) => boolean;
}
