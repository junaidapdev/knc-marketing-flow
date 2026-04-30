export const ROUTES = {
  LOGIN: "/login",
  TODAY: "/today",
  CALENDAR: "/calendar",
  CALENDAR_WEEKLY: "/calendar/week",
  CAMPAIGNS: "/campaigns",
  CAMPAIGN_DETAIL: (id: string) => `/campaigns/${id}`,
  PERFORMANCE: "/performance",
  BUDGET: "/budget",
  SETTINGS: "/settings",
} as const;
