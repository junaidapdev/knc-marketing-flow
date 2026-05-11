import { format } from "date-fns";
import {
  REPORT_CARD_COPY,
  REPORT_DATE_LOCAL_TIME_SUFFIX,
  REPORT_DISPLAY_DATE_FORMAT,
  REPORT_TEXT_COPY,
} from "../../../constants/reports";
import type { ReportSummary } from "../../../types/report-summary";

const formatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number): string {
  return formatter.format(value);
}

function formatDate(value: string): string {
  return format(
    new Date(`${value}${REPORT_DATE_LOCAL_TIME_SUFFIX}`),
    REPORT_DISPLAY_DATE_FORMAT,
  );
}

function buildPerformanceText(summary: ReportSummary): string {
  if (!summary.performance.totals) {
    return REPORT_TEXT_COPY.performanceHidden;
  }

  return [
    `${REPORT_TEXT_COPY.performance} ${formatNumber(
      summary.performance.totals.views,
    )} ${REPORT_TEXT_COPY.views}, ${formatNumber(
      summary.performance.totals.likes,
    )} ${REPORT_TEXT_COPY.likes}, ${formatNumber(
      summary.performance.totals.comments,
    )} ${REPORT_TEXT_COPY.comments}, ${formatNumber(
      summary.performance.totals.shares,
    )} ${REPORT_TEXT_COPY.shares}, ${formatNumber(
      summary.performance.totals.reach,
    )} ${REPORT_TEXT_COPY.reach}`,
  ].join("");
}

export function buildReportText(summary: ReportSummary, title?: string): string {
  const reportTitle = title?.trim() || REPORT_TEXT_COPY.title;
  const period = `${summary.period.label} (${formatDate(
    summary.period.from,
  )}${REPORT_CARD_COPY.metaSeparator}${formatDate(summary.period.to)})`;

  return [
    reportTitle,
    period,
    "",
    `${REPORT_TEXT_COPY.content} ${formatNumber(
      summary.content.totalPosted,
    )} ${REPORT_TEXT_COPY.posts}`,
    `- ${REPORT_TEXT_COPY.tiktok} ${formatNumber(
      summary.content.byType.tiktokVideo,
    )}`,
    `- ${REPORT_TEXT_COPY.igReels} ${formatNumber(
      summary.content.byType.instagramReel,
    )}`,
    `- ${REPORT_TEXT_COPY.igStories} ${formatNumber(
      summary.content.byType.instagramStory,
    )}`,
    `- ${REPORT_TEXT_COPY.snapStories} ${formatNumber(
      summary.content.byType.snapchatStory,
    )}`,
    "",
    `${REPORT_TEXT_COPY.activities} ${formatNumber(
      summary.activities.shopActivities,
    )} ${REPORT_TEXT_COPY.shopActivities}, ${formatNumber(
      summary.activities.offers,
    )} ${REPORT_TEXT_COPY.offers}, ${formatNumber(
      summary.activities.influencerCollabs,
    )} ${REPORT_TEXT_COPY.influencerCollabs}`,
    `${REPORT_TEXT_COPY.influencers} ${formatNumber(
      summary.influencers.totalCollabs,
    )} ${REPORT_TEXT_COPY.collabs}, ${formatNumber(
      summary.influencers.submissionsReceived,
    )} ${REPORT_TEXT_COPY.submitted} (${formatNumber(
      summary.influencers.verified,
    )} ${REPORT_TEXT_COPY.verified}, ${formatNumber(
      summary.influencers.pending,
    )} ${REPORT_TEXT_COPY.pending}, ${formatNumber(
      summary.influencers.disputed,
    )} ${REPORT_TEXT_COPY.disputed})`,
    "",
    buildPerformanceText(summary),
    "",
    REPORT_TEXT_COPY.generated,
  ].join("\n");
}
