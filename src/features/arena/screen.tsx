// Placeholder — replaced by the feature implementation.
import type { ScreenDef, ScreenProps } from '../../ui/nav';

function Placeholder(_: ScreenProps) {
  return <div class="screen empty-hint">Coming soon.</div>;
}

export const arenaScreen: ScreenDef = {
  id: 'arena',
  title: 'Arena',
  icon: '⚔️',
  blurb: "Battle other players' defense squads and climb the ranks.",
  unlockStage: 10,
  component: Placeholder,
};
