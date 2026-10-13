// Placeholder — replaced by the feature implementation.
import type { ScreenDef, ScreenProps } from '../../ui/nav';

function Placeholder(_: ScreenProps) {
  return <div class="screen empty-hint">Coming soon.</div>;
}

export const dispatchScreen: ScreenDef = {
  id: 'dispatch',
  title: 'Missions',
  icon: '📜',
  blurb: "Send heroes on timed missions while you're away.",
  unlockStage: 3,
  component: Placeholder,
};
