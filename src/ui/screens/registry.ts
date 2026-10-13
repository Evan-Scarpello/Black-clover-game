// Every feature page, in hub order. Feature modules own their ScreenDef.
import { arenaScreen } from '../../features/arena/screen';
import { clanScreen } from '../../features/clan/screen';
import { dispatchScreen } from '../../features/dispatch/screen';
import { achievementsScreen, loginScreen, passScreen, shopScreen } from '../../features/progression/screen';
import { towerScreen } from '../../features/tower/screen';
import type { ScreenDef, ScreenId } from '../nav';

export const SCREENS: ScreenDef[] = [arenaScreen, clanScreen, towerScreen, dispatchScreen, shopScreen, passScreen, loginScreen, achievementsScreen];

export const SCREEN_MAP = Object.fromEntries(SCREENS.map((d) => [d.id, d])) as Record<ScreenId, ScreenDef>;
