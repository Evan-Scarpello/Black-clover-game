// Retention features: Shop, Grimoire Pass, Daily Login and Achievements.
// Importing ./actions registers the game-event listener (pass XP + daily quest progress).
import './actions';
import './progression.css';
import type { ScreenDef } from '../../ui/nav';
import { AchievementsPage } from './AchievementsPage';
import { LoginPage } from './LoginPage';
import { PassPage } from './PassPage';
import { ShopPage } from './ShopPage';
import { achievementsBadge, canClaimLogin, passBadge, shopView } from './logic';

const safe = (fn: () => boolean) => {
  try {
    return fn();
  } catch {
    return false;
  }
};

export const shopScreen: ScreenDef = {
  id: 'shop',
  title: 'Shop',
  icon: '🛒',
  blurb: 'Daily deals on pages, essence and more.',
  component: ShopPage,
  badge: (s) => safe(() => shopView(s).giftReady),
};

export const passScreen: ScreenDef = {
  id: 'pass',
  title: 'Grimoire Pass',
  icon: '🎟️',
  blurb: 'Earn pass XP from everything you do and claim tier rewards.',
  component: PassPage,
  badge: (s) => safe(() => passBadge(s)),
};

export const loginScreen: ScreenDef = {
  id: 'login',
  title: 'Daily Login',
  icon: '📅',
  blurb: 'Log in every day for a 7-day reward streak.',
  component: LoginPage,
  badge: (s) => safe(() => canClaimLogin(s)),
};

export const achievementsScreen: ScreenDef = {
  id: 'achievements',
  title: 'Achievements',
  icon: '🏆',
  blurb: 'Milestones with one-time rewards.',
  component: AchievementsPage,
  badge: (s) => safe(() => achievementsBadge(s)),
};
