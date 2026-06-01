export const REPORT_MAX_RANGE_DAYS = 365;
export const REPORT_CARD_WIDTH = 800;
export const REPORT_DEFAULT_PRESET = "this_month";
export const REPORT_IMAGE_PIXEL_RATIO = 2;
export const REPORT_IMAGE_URL_REVOKE_DELAY_MS = 1000;
export const REPORT_FILENAME_MAX_LENGTH = 120;
export const REPORT_SCROLL_DELAY_MS = 0;
export const REPORT_CLIPBOARD_COPY_COMMAND = "copy";

export const REPORT_INPUT_DATE_FORMAT = "yyyy-MM-dd";
export const REPORT_DISPLAY_DATE_FORMAT = "MMM d, yyyy";
export const REPORT_DISPLAY_TIMESTAMP_FORMAT = "MMM d, yyyy | h:mm a";
export const REPORT_DATE_LOCAL_TIME_SUFFIX = "T00:00:00";
export const REPORT_MONTH_LABEL_FORMAT = "MMMM yyyy";
export const REPORT_YEAR_LABEL_FORMAT = "yyyy";
export const REPORT_SHORT_DATE_FORMAT = "MMM d";
export const REPORT_SHORT_DATE_WITH_YEAR_FORMAT = "MMM d, yyyy";

export const REPORT_DATE_PRESETS = [
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "last_90_days", label: "Last 90 days" },
  { id: "this_quarter", label: "This Quarter" },
  { id: "last_quarter", label: "Last Quarter" },
  { id: "custom", label: "Custom" },
] as const;

export type ReportDatePresetId = (typeof REPORT_DATE_PRESETS)[number]["id"];

export const REPORT_COPY = {
  pageTitle: "Reports",
  pageDescription: "Generate marketing activity reports for any date range.",
  titleLabel: "Report title",
  titlePlaceholderSuffix: "Marketing Report",
  compareLabel: "Compare to previous period",
  generateButton: "Generate",
  refreshButton: "Refresh",
  emptyHeading: "No report generated yet",
  emptyDescription: "Pick a date range above and click Generate to preview.",
  initialPreview: "Select a date range and click Generate to preview your report.",
  loadingTitle: "Building report...",
  errorTitle: "Report failed to load",
  fallbackErrorMessage: "Failed to load report.",
  retryButton: "Retry",
  previewReady:
    "Preview ready. Click Download to save as image, or Copy as Text for WhatsApp.",
  downloadButton: "Download Report",
  downloadLoading: "Generating...",
  copyTextButton: "Copy as Text",
  downloadSuccess: "Report downloaded",
  copySuccess: "Report summary copied",
  generateFirst: "Generate the report first",
  downloadError: "Couldn't generate report image. Please try again.",
  copyError: "Couldn't copy the report summary. Please try again.",
} as const;

export const REPORT_DATE_FIELD_LABELS = {
  startDate: "Start date",
  endDate: "End date",
} as const;

export const REPORT_RANGE_COPY = {
  customLabel: "Custom",
  dateSeparator: " - ",
  quarterPrefix: "Q",
} as const;

export const REPORT_RANGE_ERROR_MESSAGES = {
  invalidStart: "Choose a valid start date.",
  invalidEnd: "Choose a valid end date.",
  endBeforeStart: "End date must be on or after start date.",
  rangeTooLong: "Report range cannot exceed 365 days.",
} as const;

export const REPORT_SECTION_TITLES = {
  content: "Content Published",
  activities: "Shop Activities & Campaigns",
  influencers: "Influencer Collaborations",
  performance: "Performance Snapshot",
} as const;

// Hero-size platform tones for the Videos block (one per platform).
// Tuned to evoke each platform while staying inside the existing cream palette.
export const REPORT_PLATFORM_TONES = {
  tiktok: "bg-[#1C1C1C] text-white",
  instagram: "bg-[#F8D4C0] text-[#7A3520]",
  snapchat: "bg-[#FFD23F] text-[#0E0E0E]",
} as const;

// Lighter, secondary-weight tones for the Stories block.
export const REPORT_PLATFORM_STORY_TONES = {
  instagram: "bg-[#FCEAE0] text-[#7A3520]",
  snapchat: "bg-[#FFF0B8] text-[#6B4A0F]",
} as const;

// Sage hero tone for the Shop Activities headline card.
export const REPORT_SHOP_ACTIVITY_TONE = "bg-[#C9DFC8] text-[#2C5530]";

export const REPORT_METRIC_LABELS = {
  videos: "Videos",
  stories: "Stories",
  shopActivities: "Shop Activities",
  offers: "Offers",
  influencerCollabs: "Influencer Collabs",
  generalTasks: "General Tasks",
  totalCollabs: "Total Collabs",
  submitted: "Submitted",
  verified: "Verified",
  pending: "Pending",
  disputed: "Disputed",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  reach: "Reach",
} as const;

export const REPORT_PLATFORM_LABELS = {
  tiktok: "TikTok",
  instagram: "Instagram",
  snapchat: "Snapchat",
} as const;

export const REPORT_CARD_COPY = {
  brandInitial: "K",
  appName: "Kayan Marketing OS",
  generatedLabel: "Generated",
  daysLabel: "days",
  postsLabel: "posts",
  videosLabel: "Videos",
  storiesLabel: "Stories",
  videosDeltaLabel: "videos",
  storiesDeltaLabel: "stories",
  comparisonPrefix: "vs",
  activeCampaigns: "Active campaigns this period:",
  completed: "Completed:",
  topCampaign: "Top campaign:",
  totalSuffix: "total",
  campaignsHeading: "Campaigns",
  activeShort: "Active",
  completedShort: "Completed",
  otherActivityLabel: "Other activity",
  entriesLabel: "entries",
  noSubmissionSuffix: "collabs with no submission",
  performanceAvailableFor: "Performance data available for",
  ofLabel: "of",
  totalsHidden: "posts. Totals hidden - log more performance to see them.",
  topPlatform: "Top platform:",
  notEnoughData: "Not enough data",
  basedOn: "Based on",
  postsOpenMetric: "posts (",
  percentageClose: "%).",
  footer:
    "Counts reflect entries marked Posted in the marketing OS. Generated automatically from Kayan Marketing OS.",
  metaSeparator: " | ",
} as const;

export const REPORT_FILENAME_COPY = {
  prefix: "kayan-marketing-report-",
  extension: ".png",
  fallbackSlug: "summary",
  dateJoiner: "-to-",
  slugSeparator: "-",
} as const;

export const REPORT_TEXT_COPY = {
  title: "Kayan Marketing Report",
  content: "Content:",
  posts: "posts",
  videos: "Videos:",
  stories: "Stories:",
  tiktok: "TikTok:",
  instagram: "Instagram:",
  snapchat: "Snapchat:",
  activities: "Activities:",
  shopActivities: "shop activities",
  offers: "offers",
  influencerCollabs: "influencer collabs",
  influencers: "Influencers:",
  collabs: "collabs",
  submitted: "submitted",
  verified: "verified",
  pending: "pending",
  disputed: "disputed",
  performanceHidden:
    "Performance totals hidden until more posts have metrics logged.",
  performance: "Performance:",
  views: "views",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  reach: "reach",
  generated: "Generated from Kayan Marketing OS",
} as const;
