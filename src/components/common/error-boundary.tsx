import { Component, type ErrorInfo, type ReactNode } from "react";

/*
 * Error boundary (spec §6 · resilience). A render error in one screen must not
 * white-screen the whole console — it should degrade to a recoverable message
 * while the shell around it keeps working. Boundaries are keyed by route in the
 * layout, so navigating away clears a caught error automatically.
 *
 * React requires boundaries to be class components; this is the one place in the
 * app that is not a function component, by necessity.
 */

interface Props {
  children: ReactNode;
  /** Rendered when a descendant throws. Receives the error and a reset fn. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Extra context for the log line (e.g. "console", "portal"). */
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced to the console for diagnostics; a real deployment would forward
    // this to an error tracker. Never swallow it silently.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <DefaultFallback error={error} reset={this.reset} />;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] grid place-items-center p-6" role="alert">
      <div className="max-w-[440px] w-full text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-danger-bg border border-danger-border grid place-items-center text-2xl text-danger">!</div>
        <h1 className="text-[18px] font-semibold text-ink m-0">Something went wrong on this screen</h1>
        <p className="text-[13px] text-muted mt-2 leading-relaxed">
          The rest of the app is fine — this section hit an unexpected error. Try again, or reload if it persists.
        </p>
        {import.meta.env.DEV && (
          <pre className="text-[11px] text-danger bg-danger-bg border border-danger-border rounded-md px-3 py-2 mt-3 text-left overflow-x-auto whitespace-pre-wrap">
            {error.message}
          </pre>
        )}
        <div className="flex gap-2 justify-center mt-5">
          <button onClick={reset} className="text-[13px] font-semibold px-4 py-2 rounded-md bg-primary text-on-primary hover:bg-primary-hover">Try again</button>
          <button onClick={() => window.location.reload()} className="text-[13px] font-semibold px-4 py-2 rounded-md border border-border bg-surface hover:bg-bg">Reload</button>
        </div>
      </div>
    </div>
  );
}
