export type MarketingEventType =
  | "public_holiday"
  | "religious_season"
  | "school_calendar"
  | "retail_season"
  | "brand_opportunity";

export type MarketingEventImportance = "mega" | "major" | "soft" | "reference";
export type MarketingEventStatus = "active" | "archived";

export interface MarketingEvent {
  id: string;
  brandId: string;
  title: string;
  eventType: MarketingEventType;
  importance: MarketingEventImportance;
  startDate: string;
  endDate: string;
  description: string | null;
  marketingNotes: string | null;
  branchFocus: string[];
  sourceNote: string | null;
  isDateEstimate: boolean;
  estimateReason: string | null;
  status: MarketingEventStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingEventFilters {
  brandId: string;
  from?: string;
  to?: string;
  importance?: MarketingEventImportance;
  eventType?: MarketingEventType;
  includeArchived?: boolean;
}
