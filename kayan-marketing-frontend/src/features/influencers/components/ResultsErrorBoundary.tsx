import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { logger } from "../../../utils/logger";

// React render-error boundary. React Query already surfaces fetch errors
// via the inline error message in ResultsGrid; this catches the rarer
// case of a component throwing during render (e.g., bad data shape) so
// the whole search/saved page doesn't go blank.
//
// Retry: increment `retryKey` on the children to force a fresh render
// of whatever previously threw. Re-fetch is a side-effect of upstream
// hooks (the page uses React Query) so this doesn't need to know about
// the data layer.

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retryKey: number;
}

export class ResultsErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error("results error boundary caught", {
      err: String(error),
      componentStack: info.componentStack ?? "",
    });
  }

  retry = (): void => {
    this.setState((s) => ({ hasError: false, retryKey: s.retryKey + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-md bg-rose/40 border border-rose-deep/30 text-[#6E2A35] px-4 py-4 text-[13px] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-ink">
                Something went wrong rendering these results.
              </div>
              <div className="text-ink-3 text-[12.5px] mt-0.5">
                Try again, or refresh the page if the problem persists.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={this.retry}
            className="btn btn-ghost text-[12.5px] flex-shrink-0"
          >
            <RotateCw size={12} />
            Retry
          </button>
        </div>
      );
    }

    // The retryKey forces children to remount when the user retries.
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
