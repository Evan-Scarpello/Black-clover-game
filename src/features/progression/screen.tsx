// Placeholder — replaced by the feature implementation.
import type { ScreenDef, ScreenProps } from '../../ui/nav';

function Placeholder(_: ScreenProps) {
  return <div class="screen empty-hint">Coming soon.</div>;
}

export const shopScreen: ScreenDef = { id: 'shop', title: 'Shop', icon: '🛒', blurb: 'Daily deals on pages, essence and more.', component: Placeholder };
export const passScreen: ScreenDef = { id: 'pass', title: 'Grimoire Pass', icon: '🎟️', blurb: 'Earn pass XP from everything you do and claim tier rewards.', component: Placeholder };
export const loginScreen: ScreenDef = { id: 'login', title: 'Daily Login', icon: '📅', blurb: 'Log in every day for a 7-day reward streak.', component: Placeholder };
export const achievementsScreen: ScreenDef = { id: 'achievements', title: 'Achievements', icon: '🏆', blurb: 'Milestones with one-time rewards.', component: Placeholder };
