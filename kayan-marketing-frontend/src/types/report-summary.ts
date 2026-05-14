export type ReportTopPlatform = "tiktok" | "instagram" | "snapchat";

export interface PlatformBreakdown {
  tiktok: number;
  instagram: number;
  snapchat: number;
}

export interface ReportPeriod {
  from: string;
  to: string;
  label: string;
  daysCount: number;
}

export interface ReportComparison {
  previousPeriod: {
    from: string;
    to: string;
    label: string;
  };
  deltas: {
    videosTotal: number;
    storiesTotal: number;
    shopActivities: number;
    influencerCollabs: number;
    performanceViews: number | null;
  };
}

export interface ReportSummary {
  period: ReportPeriod;
  generatedAt: string;
  comparison: ReportComparison | null;
  content: {
    totalPosted: number;
    videosTotal: number;
    storiesTotal: number;
    // Per-platform splits. After migration 0050, one shoot = one entry that
    // can land on multiple platforms via entry_publications. These three
    // breakdowns answer "how many videos / stories / total publications
    // landed on each platform in the range."
    videosByPlatform: PlatformBreakdown;
    storiesByPlatform: PlatformBreakdown;
    postsByPlatform: PlatformBreakdown;
  };
  activities: {
    shopActivities: number;
    offers: number;
    influencerCollabs: number;
    generalTasks: number;
  };
  campaigns: {
    activeDuringPeriod: number;
    completedDuringPeriod: number;
    topCampaign: {
      id: string;
      name: string;
      entriesCount: number;
    } | null;
  };
  influencers: {
    totalCollabs: number;
    submissionsReceived: number;
    verified: number;
    pending: number;
    disputed: number;
    notSubmittedYet: number;
  };
  performance: {
    coverage: {
      totalPosted: number;
      withPerformanceLogged: number;
      percentage: number;
      belowThreshold: boolean;
    };
    totals: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      reach: number;
    } | null;
    topPlatform: ReportTopPlatform | null;
  };
}
