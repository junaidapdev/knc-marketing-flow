import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Clipboard,
  Download,
  FileText,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import {
  REPORT_COPY,
  REPORT_DEFAULT_PRESET,
  REPORT_SCROLL_DELAY_MS,
  type ReportDatePresetId,
} from "../constants/reports";
import { DateRangePicker } from "../features/reports/DateRangePicker";
import {
  getPresetDateRange,
  getReportDateRangeLabel,
  type ReportDateRange,
} from "../features/reports/date-range-utils";
import { ReportCard } from "../features/reports/ReportCard";
import {
  useReportSummary,
  type ReportSummaryParams,
} from "../features/reports/hooks/use-report-summary";
import { buildReportFilename } from "../features/reports/utils/build-report-filename";
import { buildReportText } from "../features/reports/utils/build-report-text";
import { copyReportText } from "../features/reports/utils/copy-report-text";
import { generateReportImage } from "../features/reports/utils/generate-report-image";
import { logger } from "../utils/logger";

type ReportNoticeKind = "success" | "error";

interface ReportNotice {
  kind: ReportNoticeKind;
  message: string;
}

function defaultRange(): ReportDateRange {
  return (
    getPresetDateRange(REPORT_DEFAULT_PRESET) ?? {
      from: "",
      to: "",
    }
  );
}

function sameParams(
  left: ReportSummaryParams | null,
  right: ReportSummaryParams,
): boolean {
  if (!left) return false;
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.compareToPrevious === right.compareToPrevious &&
    left.campaignId === right.campaignId &&
    left.branchId === right.branchId
  );
}

export default function ReportsPage(): JSX.Element {
  const reportCardRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const [range, setRange] = useState<ReportDateRange>(() => defaultRange());
  const [preset, setPreset] = useState<ReportDatePresetId>(
    REPORT_DEFAULT_PRESET,
  );
  const [rangeValid, setRangeValid] = useState(true);
  const [compareToPrevious, setCompareToPrevious] = useState(false);
  const [title, setTitle] = useState("");
  const [submittedTitle, setSubmittedTitle] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [notice, setNotice] = useState<ReportNotice | null>(null);
  const [requestParams, setRequestParams] =
    useState<ReportSummaryParams | null>(null);

  const report = useReportSummary(requestParams, requestParams !== null);

  const titlePlaceholder = useMemo(
    () =>
      `${getReportDateRangeLabel(range)} ${REPORT_COPY.titlePlaceholderSuffix}`,
    [range],
  );

  const handleValidityChange = useCallback((isValid: boolean): void => {
    setRangeValid(isValid);
  }, []);

  const handleGenerate = (): void => {
    if (!rangeValid) return;
    setNotice(null);
    const nextParams: ReportSummaryParams = {
      from: range.from,
      to: range.to,
      compareToPrevious,
    };
    setSubmittedTitle(title.trim());
    window.setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, REPORT_SCROLL_DELAY_MS);
    if (sameParams(requestParams, nextParams)) {
      void report.refetch();
      return;
    }
    setRequestParams(nextParams);
  };

  const displayTitle = report.data
    ? submittedTitle || `${report.data.period.label} ${REPORT_COPY.titlePlaceholderSuffix}`
    : submittedTitle;

  const handleDownload = async (): Promise<void> => {
    if (!report.data || !reportCardRef.current?.childElementCount) {
      setNotice({ kind: "error", message: REPORT_COPY.generateFirst });
      return;
    }

    setIsDownloading(true);
    setNotice(null);
    try {
      await generateReportImage({
        element: reportCardRef.current,
        filename: buildReportFilename(
          displayTitle,
          report.data.period.from,
          report.data.period.to,
        ),
      });
      setNotice({ kind: "success", message: REPORT_COPY.downloadSuccess });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : REPORT_COPY.downloadError;
      setNotice({ kind: "error", message });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyText = async (): Promise<void> => {
    if (!report.data) {
      setNotice({ kind: "error", message: REPORT_COPY.generateFirst });
      return;
    }

    setNotice(null);
    try {
      await copyReportText(buildReportText(report.data, displayTitle));
      setNotice({ kind: "success", message: REPORT_COPY.copySuccess });
    } catch (err) {
      logger.warn("report summary copy failed", { err: String(err) });
      setNotice({ kind: "error", message: REPORT_COPY.copyError });
    }
  };

  const hasGenerated = requestParams !== null;
  const isGenerateDisabled = !rangeValid || report.isFetching;
  const canUseReportActions = Boolean(
    report.data && !report.isFetching && !report.isError,
  );

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            {REPORT_COPY.pageTitle}
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5">
            {REPORT_COPY.pageDescription}
          </p>
        </div>
      </header>

      <section className="card mb-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
          <div className="space-y-4">
            <DateRangePicker
              value={range}
              preset={preset}
              onChange={setRange}
              onPresetChange={setPreset}
              onValidityChange={handleValidityChange}
            />
            <label className="block">
              <span className="field-label">{REPORT_COPY.titleLabel}</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={titlePlaceholder}
                className="form-input"
              />
            </label>
          </div>

          <div className="flex flex-col justify-between gap-4">
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={compareToPrevious}
                onChange={(event) => setCompareToPrevious(event.target.checked)}
                className="w-4 h-4 accent-obsidian"
              />
              {REPORT_COPY.compareLabel}
            </label>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              className="btn btn-primary justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {report.isFetching ? (
                <>
                  <RefreshCcw size={14} className="animate-spin" />
                  {REPORT_COPY.loadingTitle}
                </>
              ) : hasGenerated ? (
                <>
                  <RefreshCcw size={14} />
                  {REPORT_COPY.refreshButton}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  {REPORT_COPY.generateButton}
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      <section ref={previewRef}>
        {!hasGenerated && <ReportsEmptyState />}

        {hasGenerated && report.isFetching && !report.data && <ReportSkeleton />}

        {hasGenerated && report.isError && (
          <ReportError
            message={
              report.error instanceof Error
                ? report.error.message
                : REPORT_COPY.fallbackErrorMessage
            }
            onRetry={() => void report.refetch()}
          />
        )}

        {notice && <ReportNoticeBanner notice={notice} />}

        {hasGenerated && report.data && !report.isFetching && !report.isError && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-[13px] text-ink-2">
                {REPORT_COPY.previewReady}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyText()}
                  disabled={!canUseReportActions}
                  className="btn btn-ghost disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Clipboard size={13} />
                  {REPORT_COPY.copyTextButton}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  disabled={!canUseReportActions || isDownloading}
                  className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCcw size={13} className="animate-spin" />
                      {REPORT_COPY.downloadLoading}
                    </>
                  ) : (
                    <>
                      <Download size={13} />
                      {REPORT_COPY.downloadButton}
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto pb-2">
              <ReportCard
                ref={reportCardRef}
                summary={report.data}
                title={submittedTitle}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ReportsEmptyState(): JSX.Element {
  return (
    <div className="card text-center py-16">
      <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-yellow grid place-items-center text-obsidian">
        <FileText size={22} />
      </div>
      <h2 className="font-serif text-[18px] text-ink mb-1.5">
        {REPORT_COPY.emptyHeading}
      </h2>
      <p className="text-[13px] text-ink-3 max-w-md mx-auto">
        {REPORT_COPY.emptyDescription}
      </p>
    </div>
  );
}

function ReportSkeleton(): JSX.Element {
  return (
    <div className="card max-w-[800px] animate-pulse">
      <div className="h-8 w-64 bg-cream-2 rounded-md mb-3" />
      <div className="h-4 w-80 bg-cream-2 rounded-md mb-8" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-24 bg-cream-2 rounded-md" />
        ))}
      </div>
      <div className="h-28 bg-cream-2 rounded-md mb-4" />
      <div className="h-28 bg-cream-2 rounded-md" />
    </div>
  );
}

function ReportNoticeBanner({
  notice,
}: {
  notice: ReportNotice;
}): JSX.Element {
  const tone =
    notice.kind === "success"
      ? "bg-sage/40 border-sage-deep/30 text-[#2C5530]"
      : "bg-rose/40 border-rose-deep/30 text-[#6E2A35]";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-3 rounded-md border px-4 py-3 text-[13px] font-semibold ${tone}`}
    >
      {notice.message}
    </div>
  );
}

function ReportError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="font-semibold text-[14px]">{REPORT_COPY.errorTitle}</h2>
          <p className="text-[12.5px] mt-0.5">{message}</p>
        </div>
      </div>
      <button type="button" onClick={onRetry} className="btn btn-ghost">
        <RefreshCcw size={13} />
        {REPORT_COPY.retryButton}
      </button>
    </div>
  );
}
