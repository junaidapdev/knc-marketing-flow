export type ReportTopPlatform = "tiktok" | "instagram" | "snapchat";

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
    byType: {
      tiktokVideo: number;
      instagramReel: number;
      instagramStory: number;
      snapchatStory: number;
    };
    videosTotal: number;
    storiesTotal: number;
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
