import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { addYears, format, parseISO, subYears } from "date-fns";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Info, Sparkles } from "lucide-react";
import { useCurrentBrand } from "../hooks/use-current-brand";
import { useMarketingEvents } from "../features/marketing-events/hooks";
import type {
  MarketingEvent,
  MarketingEventImportance,
  MarketingEventType,
} from "../types/marketing-event";

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

const EVENT_TYPE_LABELS: Record<MarketingEventType, string> = {
  public_holiday: "Public holiday",
  religious_season: "Religious season",
  school_calendar: "School calendar",
  retail_season: "Retail season",
  brand_opportunity: "Brand opportunity",
};

const IMPORTANCE_LABELS: Record<MarketingEventImportance, string> = {
  mega: "Mega",
  major: "Major",
  soft: "Soft",
  reference: "Reference",
};

const IMPORTANCE_CLASS: Record<MarketingEventImportance, string> = {
  mega: "bg-obsidian text-yellow",
  major: "bg-yellow text-obsidian",
  soft: "bg-sage text-[#2C5530]",
  reference: "bg-cream-2 text-ink-2",
};

const TYPE_CLASS: Record<MarketingEventType, string> = {
  public_holiday: "bg-sky text-[#2C4A66]",
  religious_season: "bg-lavender text-[#4A3A6A]",
  school_calendar: "bg-peach text-[#7A3520]",
  retail_season: "bg-yellow-bg text-obsidian",
  brand_opportunity: "bg-cream-2 text-ink-2",
};

function dateRangeLabel(event: MarketingEvent): string {
  if (event.startDate === event.endDate) {
    return format(parseISO(event.startDate), "MMM d, yyyy");
  }
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const sameMonth = format(start, "yyyy-MM") === format(end, "yyyy-MM");
  return sameMonth
    ? `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`
    : `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
}

function yearBounds(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function overlapsMonth(event: MarketingEvent, year: number, monthIndex: number): boolean {
  const monthStart = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const monthEnd = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${lastDay}`;
  return event.startDate <= monthEnd && event.endDate >= monthStart;
}

export default function MarketingCalendarPage(): JSX.Element {
  const { brandId } = useCurrentBrand();
  const [yearDate, setYearDate] = useState(() => new Date());
  const year = yearDate.getFullYear();
  const bounds = yearBounds(year);

  const events = useMarketingEvents({
    brandId,
    from: bounds.from,
    to: bounds.to,
  });

  const eventsByMonth = useMemo(() => {
    const map = new Map<number, MarketingEvent[]>();
    for (const m of MONTHS) map.set(m, []);
    for (const event of events.data ?? []) {
      for (const m of MONTHS) {
        if (overlapsMonth(event, year, m)) map.get(m)?.push(event);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    return map;
  }, [events.data, year]);

  const highlight = useMemo(() => {
    const list = events.data ?? [];
    return {
      total: list.length,
      mega: list.filter((e) => e.importance === "mega").length,
      estimated: list.filter((e) => e.isDateEstimate).length,
    };
  }, [events.data]);

  return (
    <div className="px-4 md:px-9 pt-5 md:pt-8 pb-12 space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="h-greeting text-[24px] md:text-[30px]">
            Marketing <em>calendar</em>
          </h1>
          <p className="text-[13px] md:text-[14px] text-ink-2 mt-1 md:mt-1.5 max-w-2xl">
            Important Saudi, school, religious, and retail moments for planning Kayan content.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYearDate((d) => subYears(d, 1))}
            aria-label="Previous year"
            className="iconbtn"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-[96px] text-center font-serif text-[22px] font-semibold text-ink">
            {year}
          </div>
          <button
            onClick={() => setYearDate((d) => addYears(d, 1))}
            aria-label="Next year"
            className="iconbtn"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard icon={<CalendarDays size={15} />} label="Events" value={highlight.total} />
        <SummaryCard icon={<Sparkles size={15} />} label="Mega moments" value={highlight.mega} />
        <SummaryCard icon={<Info size={15} />} label="Estimated dates" value={highlight.estimated} />
      </section>

      {events.isError && (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] p-4 text-[13px] flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{events.error instanceof Error ? events.error.message : "Failed to load events."}</span>
        </div>
      )}

      {events.isLoading ? (
        <p className="text-[13px] text-ink-3">Loading marketing events...</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {MONTHS.map((monthIndex) => {
            const monthEvents = eventsByMonth.get(monthIndex) ?? [];
            return (
              <section key={monthIndex} className="border border-line rounded-lg bg-paper overflow-hidden">
                <header className="px-4 py-3 border-b border-line bg-cream-2/35 flex items-center justify-between">
                  <h2 className="font-serif text-[17px] font-semibold text-ink">
                    {format(new Date(year, monthIndex, 1), "MMMM")}
                  </h2>
                  <span className="text-[11.5px] text-ink-3">
                    {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"}
                  </span>
                </header>
                {monthEvents.length === 0 ? (
                  <div className="px-4 py-5 text-[12.5px] text-ink-3 italic">
                    No major planning events.
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {monthEvents.map((event) => (
                      <EventRow key={`${event.id}-${monthIndex}`} event={event} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-yellow-bg text-obsidian grid place-items-center">
        {icon}
      </div>
      <div>
        <div className="eyebrow">{label}</div>
        <div className="font-serif text-[22px] font-semibold text-ink leading-none mt-1">
          {value}
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: MarketingEvent }): JSX.Element {
  return (
    <article className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`chip ${IMPORTANCE_CLASS[event.importance]}`}>
              {IMPORTANCE_LABELS[event.importance]}
            </span>
            <span className={`chip ${TYPE_CLASS[event.eventType]}`}>
              {EVENT_TYPE_LABELS[event.eventType]}
            </span>
            {event.isDateEstimate && (
              <span className="chip bg-rose text-[#6E2A35]">Estimated</span>
            )}
          </div>
          <h3 className="font-serif text-[16px] font-semibold text-ink leading-tight">
            {event.title}
          </h3>
          <div className="text-[12px] text-ink-3 mt-1">{dateRangeLabel(event)}</div>
        </div>
      </div>

      {event.description && (
        <p className="text-[12.5px] text-ink-2 leading-relaxed mt-2">{event.description}</p>
      )}
      {event.marketingNotes && (
        <p className="text-[12.5px] text-ink italic leading-relaxed mt-2">
          {event.marketingNotes}
        </p>
      )}
      {event.branchFocus.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {event.branchFocus.map((branch) => (
            <span key={branch} className="text-[10.5px] px-1.5 py-0.5 rounded bg-cream-2 text-ink-3">
              {branch}
            </span>
          ))}
        </div>
      )}
      {(event.sourceNote || event.estimateReason) && (
        <details className="mt-2 text-[11.5px] text-ink-3">
          <summary className="cursor-pointer hover:text-ink">Reference note</summary>
          <div className="mt-1 leading-relaxed">
            {event.sourceNote}
            {event.estimateReason ? ` ${event.estimateReason}` : ""}
          </div>
        </details>
      )}
    </article>
  );
}
