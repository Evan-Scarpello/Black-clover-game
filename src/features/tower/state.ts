// Save slice for the Tower of Trials. Pure data: types + defaults only.
export interface TowerSave {
  /** Highest floor cleared (0 = none). */
  floor: number;
}

export function defaultTower(): TowerSave {
  return { floor: 0 };
}
