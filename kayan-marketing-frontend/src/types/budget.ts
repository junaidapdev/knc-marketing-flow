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

export interface BudgetCapInput {
  totalCap: number;
  categoryCaps: Partial<Record<BudgetCategory, number>>;
}

export interface BudgetContributingRow {
  id: string;
  title: string;
  category: BudgetCategory;
  amount: number;
  type: "entry" | "campaign_ad_spend";
}

export interface BudgetSummary {
  cap: {
    total: number;
    byCategory: Partial<Record<BudgetCategory, number>>;
  };
  spent: {
    total: number;
    byCategory: Partial<Record<BudgetCategory, number>>;
  };
  contributingEntries: BudgetContributingRow[];
}
