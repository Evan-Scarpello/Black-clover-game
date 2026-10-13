// Squad-vs-enemy power verdict shown on stage sheets. Pure.
export interface Verdict {
  label: 'Easy' | 'Even' | 'Tough' | 'Deadly';
  color: string;
  /** Your share of the combined power (0-1), for the tug-of-war bar. */
  share: number;
}

export function powerVerdict(mine: number, enemy: number): Verdict {
  const m = Math.max(0, mine || 0);
  const e = Math.max(1, enemy || 0);
  const ratio = m / e;
  const share = m + e > 0 ? m / (m + e) : 0;
  if (ratio >= 1.15) return { label: 'Easy', color: '#7dff9b', share };
  if (ratio >= 0.95) return { label: 'Even', color: '#ffd166', share };
  if (ratio >= 0.8) return { label: 'Tough', color: '#ffa26b', share };
  return { label: 'Deadly', color: '#ff6b6b', share };
}
