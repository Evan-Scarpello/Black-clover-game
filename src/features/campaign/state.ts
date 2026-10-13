// Save slice for campaign extras (stage star ratings, chapter star chests). Pure data only.
export interface CampaignSave {
  /** Best star rating (1-3) per cleared stage index. */
  stars: Record<string, number>;
  /** Chapter star chests already opened: chapter index (as string) → claimed tier indexes (0-2). */
  chests: Record<string, number[]>;
}

export function defaultCampaign(): CampaignSave {
  return { stars: {}, chests: {} };
}
