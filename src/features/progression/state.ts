// Save slice for login calendar, Grimoire Pass, shop and achievements. Pure data only.
export interface ProgressionSave {
  login: { lastDay: string; claimed: number };
  pass: { season: number; xp: number; premium: boolean; claimedFree: number[]; claimedPremium: number[] };
  shop: { day: string; stock: string[]; bought: string[]; refreshes: number };
  achievements: string[];
}

export function defaultProgression(): ProgressionSave {
  return {
    login: { lastDay: '', claimed: 0 },
    pass: { season: 1, xp: 0, premium: false, claimedFree: [], claimedPremium: [] },
    shop: { day: '', stock: [], bought: [], refreshes: 0 },
    achievements: [],
  };
}
