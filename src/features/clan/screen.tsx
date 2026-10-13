// Placeholder — replaced by the feature implementation.
import type { ScreenDef, ScreenProps } from '../../ui/nav';

function Placeholder(_: ScreenProps) {
  return <div class="screen empty-hint">Coming soon.</div>;
}

export const clanScreen: ScreenDef = {
  id: 'clan',
  title: 'Clan Hall',
  icon: '🏯',
  blurb: "Join a clan, check in daily and take down the clan raid boss together.",
  unlockStage: 15,
  component: Placeholder,
};
