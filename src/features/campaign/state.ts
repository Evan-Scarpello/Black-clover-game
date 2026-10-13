// Save slice for campaign extras (stage star ratings). Pure data only.
export interface CampaignSave {
  /** Best star rating (1-3) per cleared stage index. */
  stars: Record<string, number>;
}

export function defaultCampaign(): CampaignSave {
  return { stars: {} };
}
