import { format } from "date-fns";
import { forwardRef, type ReactNode } from "react";
import {
  REPORT_CARD_COPY,
  REPORT_CARD_WIDTH,
  REPORT_COPY,
  REPORT_DATE_LOCAL_TIME_SUFFIX,
  REPORT_DISPLAY_DATE_FORMAT,
  REPORT_DISPLAY_TIMESTAMP_FORMAT,
  REPORT_METRIC_LABELS,
  REPORT_PLATFORM_LABELS,
  REPORT_SECTION_TITLES,
} from "../../constants/reports";
import type { ReportSummary } from "../../types/report-summary";

interface Props {
  summary: ReportSummary;
  title?: string;
}

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

function formatTimestamp(value: string): string {
  return format(new Date(value), REPORT_DISPLAY_TIMESTAMP_FORMAT);
}

function deltaClass(value: number): string {
  if (value > 0) return "bg-[#C9DFC8] text-[#2C5530]";
  if (value < 0) return "bg-[#F5C7CC] text-[#6E2A35]";
  return "bg-[#F4EDD8] text-[#4A4A48]";
}

function DeltaBadge({ value, label }: { value: number | null; label: string }): JSX.Element | null {
  if (value === null) return null;
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${deltaClass(value)}`}>
      {sign}
      {formatNumber(value)} {label}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="border-t border-[#E6DFC9] pt-5">
      <h2 className="text-[16px] font-semibold tracking-tight text-[#1C1C1C] mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
  delta,
}: {
  label: string;
  value: number | string;
  tone: string;
  delta?: ReactNode;
}): JSX.Element {
  return (
    <div className={`rounded-[8px] px-4 py-3 ${tone}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] font-bold opacity-75">
        {label}
      </div>
      <div className="mt-1.5 text-[26px] leading-none font-semibold tabular-nums">
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
      {delta && <div className="mt-2">{delta}</div>}
    </div>
  );
}

function SmallStat({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta?: ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-[8px] border border-[#E6DFC9] bg-[#FFFCF5] px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.13em] text-[#8C8B85] font-bold">
        {label}
      </div>
      <div className="mt-1 text-[22px] leading-none font-semibold text-[#1C1C1C] tabular-nums">
        {formatNumber(value)}
      </div>
      {delta && <div className="mt-2">{delta}</div>}
    </div>
  );
}

export const ReportCard = forwardRef<HTMLElement, Props>(function ReportCard(
  { summary, title },
  ref,
): JSX.Element {
  const displayTitle =
    title?.trim() || `${summary.period.label} ${REPORT_COPY.titlePlaceholderSuffix}`;
  const periodText = `${formatDate(summary.period.from)}${
    REPORT_CARD_COPY.metaSeparator
  }${formatDate(summary.period.to)}${REPORT_CARD_COPY.metaSeparator}${
    summary.period.daysCount
  } ${REPORT_CARD_COPY.daysLabel}`;
  const comparisonLabel = summary.comparison
    ? `${REPORT_CARD_COPY.comparisonPrefix} ${summary.comparison.previousPeriod.label}`
    : "";

  return (
    <article
      ref={ref}
      className="bg-[#FFFFFF] border border-[#E6DFC9] rounded-[16px] shadow-lg text-[#1C1C1C] overflow-hidden"
      style={{ width: REPORT_CARD_WIDTH, backgroundColor: "#ffffff" }}
    >
      <header className="px-8 py-7 bg-[#FBF6E9] border-b border-[#E6DFC9] flex items-start justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-[14px] bg-[#FFD23F] text-[#0E0E0E] grid place-items-center font-serif text-[24px] font-semibold flex-shrink-0">
            {REPORT_CARD_COPY.brandInitial}
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-[#8C8B85] font-bold">
              {REPORT_CARD_COPY.appName}
            </div>
            <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-[#1C1C1C]">
              {displayTitle}
            </h1>
            <p className="mt-2 text-[13px] text-[#4A4A48]">{periodText}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#8C8B85] font-bold">
            {REPORT_CARD_COPY.generatedLabel}
          </div>
          <div className="text-[12px] text-[#4A4A48] mt-1">
            {formatTimestamp(summary.generatedAt)}
          </div>
        </div>
      </header>

      <div className="px-8 py-7 space-y-7">
        <Section title={REPORT_SECTION_TITLES.content}>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <div className="text-[46px] leading-none font-semibold tabular-nums">
                {formatNumber(summary.content.totalPosted)}
              </div>
              <div className="text-[13px] text-[#4A4A48] mt-1">
                {REPORT_CARD_COPY.postsLabel}
              </div>
            </div>
            {summary.comparison && (
              <div className="flex flex-wrap gap-2 justify-end">
                <DeltaBadge
                  value={summary.comparison.deltas.videosTotal}
                  label={`${comparisonLabel} ${REPORT_CARD_COPY.videosDeltaLabel}`}
                />
                <DeltaBadge
                  value={summary.comparison.deltas.storiesTotal}
                  label={`${comparisonLabel} ${REPORT_CARD_COPY.storiesDeltaLabel}`}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3">
            <MetricCard
              label={REPORT_METRIC_LABELS.tiktokVideos}
              value={summary.content.byType.tiktokVideo}
              tone="bg-[#1C1C1C] text-white"
            />
            <MetricCard
              label={REPORT_METRIC_LABELS.instagramReels}
              value={summary.content.byType.instagramReel}
              tone="bg-[#F8D4C0] text-[#7A3520]"
            />
            <MetricCard
              label={REPORT_METRIC_LABELS.instagramStories}
              value={summary.content.byType.instagramStory}
              tone="bg-[#DDD2E8] text-[#4A3A6A]"
            />
            <MetricCard
              label={REPORT_METRIC_LABELS.snapchatStories}
              value={summary.content.byType.snapchatStory}
              tone="bg-[#FFD23F] text-[#0E0E0E]"
            />
          </div>
          <p className="text-[13px] text-[#4A4A48] mt-3">
            {REPORT_CARD_COPY.videosLabel}:{" "}
            {formatNumber(summary.content.videosTotal)}
            {REPORT_CARD_COPY.metaSeparator}
            {REPORT_CARD_COPY.storiesLabel}:{" "}
            {formatNumber(summary.content.storiesTotal)}
          </p>
        </Section>

        <Section title={REPORT_SECTION_TITLES.activities}>
          <div className="grid grid-cols-4 gap-3">
            <SmallStat
              label={REPORT_METRIC_LABELS.shopActivities}
              value={summary.activities.shopActivities}
              delta={
                <DeltaBadge
                  value={summary.comparison?.deltas.shopActivities ?? null}
                  label={comparisonLabel}
                />
              }
            />
            <SmallStat
              label={REPORT_METRIC_LABELS.offers}
              value={summary.activities.offers}
            />
            <SmallStat
              label={REPORT_METRIC_LABELS.influencerCollabs}
              value={summary.activities.influencerCollabs}
              delta={
                <DeltaBadge
                  value={summary.comparison?.deltas.influencerCollabs ?? null}
                  label={comparisonLabel}
                />
              }
            />
            <SmallStat
              label={REPORT_METRIC_LABELS.generalTasks}
              value={summary.activities.generalTasks}
            />
          </div>
          <div className="mt-4 rounded-[10px] bg-[#FBF6E9] border border-[#E6DFC9] px-4 py-3 text-[13px] text-[#4A4A48] space-y-1">
            <p>
              {REPORT_CARD_COPY.activeCampaigns}{" "}
              <strong className="text-[#1C1C1C]">
                {formatNumber(summary.campaigns.activeDuringPeriod)}
              </strong>
            </p>
            <p>
              {REPORT_CARD_COPY.completed}{" "}
              <strong className="text-[#1C1C1C]">
                {formatNumber(summary.campaigns.completedDuringPeriod)}
              </strong>
            </p>
            {summary.campaigns.topCampaign && (
              <p>
                {REPORT_CARD_COPY.topCampaign}{" "}
                <strong className="text-[#1C1C1C]">
                  {summary.campaigns.topCampaign.name}
                </strong>{" "}
                ({formatNumber(summary.campaigns.topCampaign.entriesCount)}{" "}
                {REPORT_CARD_COPY.entriesLabel})
              </p>
            )}
          </div>
        </Section>

        <Section title={REPORT_SECTION_TITLES.influencers}>
          <div className="grid grid-cols-5 gap-3">
            <SmallStat
              label={REPORT_METRIC_LABELS.totalCollabs}
              value={summary.influencers.totalCollabs}
            />
            <SmallStat
              label={REPORT_METRIC_LABELS.submitted}
              value={summary.influencers.submissionsReceived}
            />
            <SmallStat
              label={REPORT_METRIC_LABELS.verified}
              value={summary.influencers.verified}
            />
            <SmallStat
              label={REPORT_METRIC_LABELS.pending}
              value={summary.influencers.pending}
            />
            <SmallStat
              label={REPORT_METRIC_LABELS.disputed}
              value={summary.influencers.disputed}
            />
          </div>
          {summary.influencers.notSubmittedYet > 0 && (
            <div className="inline-flex mt-3 rounded-full bg-[#FFE9A8] text-[#6B4A0F] px-3 py-1 text-[12px] font-semibold">
              {formatNumber(summary.influencers.notSubmittedYet)}{" "}
              {REPORT_CARD_COPY.noSubmissionSuffix}
            </div>
          )}
        </Section>

        <Section title={REPORT_SECTION_TITLES.performance}>
          {summary.performance.coverage.belowThreshold || !summary.performance.totals ? (
            <div className="rounded-[10px] bg-[#FBF6E9] border border-[#E6DFC9] px-4 py-4 text-[13px] text-[#4A4A48]">
              {REPORT_CARD_COPY.performanceAvailableFor}{" "}
              <strong className="text-[#1C1C1C]">
                {formatNumber(summary.performance.coverage.withPerformanceLogged)}
              </strong>{" "}
              {REPORT_CARD_COPY.ofLabel}{" "}
              <strong className="text-[#1C1C1C]">
                {formatNumber(summary.performance.coverage.totalPosted)}
              </strong>{" "}
              {REPORT_CARD_COPY.totalsHidden}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-3">
                <SmallStat
                  label={REPORT_METRIC_LABELS.views}
                  value={summary.performance.totals.views}
                  delta={
                    <DeltaBadge
                      value={summary.comparison?.deltas.performanceViews ?? null}
                      label={comparisonLabel}
                    />
                  }
                />
                <SmallStat
                  label={REPORT_METRIC_LABELS.likes}
                  value={summary.performance.totals.likes}
                />
                <SmallStat
                  label={REPORT_METRIC_LABELS.comments}
                  value={summary.performance.totals.comments}
                />
                <SmallStat
                  label={REPORT_METRIC_LABELS.shares}
                  value={summary.performance.totals.shares}
                />
                <SmallStat
                  label={REPORT_METRIC_LABELS.reach}
                  value={summary.performance.totals.reach}
                />
              </div>
              <div className="mt-3 text-[13px] text-[#4A4A48]">
                {REPORT_CARD_COPY.topPlatform}{" "}
                <strong className="text-[#1C1C1C]">
                  {summary.performance.topPlatform
                    ? REPORT_PLATFORM_LABELS[summary.performance.topPlatform]
                    : REPORT_CARD_COPY.notEnoughData}
                </strong>
              </div>
              <p className="text-[12px] text-[#8C8B85] mt-1">
                {REPORT_CARD_COPY.basedOn}{" "}
                {formatNumber(summary.performance.coverage.withPerformanceLogged)}{" "}
                {REPORT_CARD_COPY.ofLabel}{" "}
                {formatNumber(summary.performance.coverage.totalPosted)}{" "}
                {REPORT_CARD_COPY.postsOpenMetric}
                {summary.performance.coverage.percentage}
                {REPORT_CARD_COPY.percentageClose}
              </p>
            </>
          )}
        </Section>
      </div>

      <footer className="px-8 py-4 bg-[#FBF6E9] border-t border-[#E6DFC9] text-[11.5px] text-[#8C8B85]">
        {REPORT_CARD_COPY.footer}
      </footer>
    </article>
  );
});
