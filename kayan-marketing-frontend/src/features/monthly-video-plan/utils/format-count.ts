import { MONTHLY_VIDEO_PLAN_COPY } from "../../../constants/monthly-video-plan";

/**
 * Render the count cell for a plan item.
 * Single number ("3") if no max, or a range ("5–7") when max is present.
 */
export function formatItemCount(count: number, countMax: number | null): string {
  if (countMax == null || countMax === count) {
    return String(count);
  }
  return `${count}${MONTHLY_VIDEO_PLAN_COPY.rangeJoiner}${countMax}`;
}

/**
 * Render the month total as either a single number or a range.
 * `min` is the sum of all counts; `max` is the sum of (countMax ?? count).
 */
export function formatMonthTotal(items: { count: number; countMax: number | null }[]): string {
  if (items.length === 0) return "0";
  const min = items.reduce((acc, i) => acc + i.count, 0);
  const max = items.reduce((acc, i) => acc + (i.countMax ?? i.count), 0);
  if (min === max) return String(min);
  return `${min}${MONTHLY_VIDEO_PLAN_COPY.rangeJoiner}${max}`;
}
