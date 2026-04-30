import type { Task } from "./task";
import type { BudgetCategory } from "../constants/budget-categories";

export interface TodaySection {
  date: string;
  tasks: Task[];
}

export interface OverdueSection {
  count: number;
  tasks: Task[];
}

export interface RadarSection {
  tomorrow: Task[];
  dayAfter: Task[];
  dayThree: Task[];
}

export interface BudgetCategoryRow {
  category: BudgetCategory;
  spent: number;
  cap: number;
}

export interface BudgetSection {
  monthCap: number;
  monthSpent: number;
  percentUsed: number;
  topCategories: BudgetCategoryRow[];
}

export interface TodaySummary {
  today: TodaySection;
  overdue: OverdueSection;
  radar: RadarSection;
  budget: BudgetSection;
}
