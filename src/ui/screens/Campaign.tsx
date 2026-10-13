// Battle tab: the campaign world map (see src/features/campaign/WorldMap.tsx).
import { WorldMap } from '../../features/campaign/WorldMap';
import type { Nav } from '../nav';

export function Campaign({ nav }: { nav: Nav }) {
  return <WorldMap nav={nav} />;
}
