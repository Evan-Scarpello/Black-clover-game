// Placeholder — replaced by the feature implementation.
import type { ScreenDef, ScreenProps } from '../../ui/nav';

function Placeholder(_: ScreenProps) {
  return <div class="screen empty-hint">Coming soon.</div>;
}

export const towerScreen: ScreenDef = {
  id: 'tower',
  title: 'Tower of Trials',
  icon: '🗼',
  blurb: "Climb an endless tower of ever-tougher floors.",
  unlockStage: 5,
  component: Placeholder,
};
