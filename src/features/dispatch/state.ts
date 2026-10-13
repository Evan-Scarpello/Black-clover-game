// Save slice for Magic Knight Missions (timed dispatch). Pure data: types + defaults only.
export interface DispatchMission {
  id: string;
  /** Hero ids sent; empty = not started. */
  heroes: string[];
  startedAt: number;
  claimed: boolean;
}

export interface DispatchSave {
  day: string;
  missions: DispatchMission[];
}

export function defaultDispatch(): DispatchSave {
  return { day: '', missions: [] };
}
