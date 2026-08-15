type LoadingStateProps = {
  label?: string;
  /** Skeleton song rows under the loader (library/playlist feel). */
  rows?: number;
  compact?: boolean;
};

export default function LoadingState({
  label = 'Loading…',
  rows = 0,
  compact = false,
}: LoadingStateProps) {
  return (
    <div className={`loading-state ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
      <div className="loading-visual">
        <span className="spinner spinner-lg" />
        <div className="loading-bar" aria-hidden>
          <span />
        </div>
      </div>
      <p className="loading-label">{label}</p>
      {rows > 0 ? (
        <div className="skeleton-list" aria-hidden>
          {Array.from({ length: rows }, (_, i) => (
            <div className="skeleton-row" key={i}>
              <div className="skeleton-art" />
              <div className="skeleton-lines">
                <div className="skeleton-line" style={{ width: `${72 - i * 8}%` }} />
                <div className="skeleton-line short" style={{ width: `${48 - i * 4}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ProgressBarProps = {
  progress: number;
  label?: string;
};

/** Determinate 0–100 progress (downloads / uploads). */
export function ProgressBar({ progress, label }: ProgressBarProps) {
  const value = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div className="progress-block" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      {label ? <p className="loading-label">{label}</p> : null}
      <div className="progress-track">
        <span className="progress-fill" style={{ width: `${value}%` }} />
      </div>
      <p className="progress-pct">{value}%</p>
    </div>
  );
}
