export interface MonthlyVideoPlanItem {
  id: string;
  brandId: string;
  month: string; // YYYY-MM-01
  label: string;
  count: number;
  countMax: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
