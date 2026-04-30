import type { BudgetCategory } from "../constants/budget-categories";

export interface BudgetCap {
  id: string;
  brandId: string;
  month: string;
  totalCap: number;
  categoryCaps: Partial<Record<BudgetCategory, number>>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
