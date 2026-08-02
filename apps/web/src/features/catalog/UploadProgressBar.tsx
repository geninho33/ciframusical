import styles from "./UploadProgressBar.module.css";

export type UploadProgressState = {
  percent: number;
  label: string;
  phase: "idle" | "preparing" | "uploading" | "analyzing" | "finishing";
};

type Props = {
  state: UploadProgressState;
};

export function UploadProgressBar({ state }: Props) {
  if (state.phase === "idle") return null;

  const clamped = Math.max(0, Math.min(100, Math.round(state.percent)));
  const indeterminate =
    state.phase === "preparing" || state.phase === "finishing";

  return (
    <div
      className={styles.wrap}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuetext={state.label}
      aria-busy="true"
    >
      <div className={styles.meta}>
        <span className={styles.label}>{state.label}</span>
        <span className={styles.percent}>{clamped}%</span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${indeterminate ? styles.pulse : ""}`}
          style={{ width: `${Math.max(clamped, indeterminate ? 18 : 0)}%` }}
        >
          <span className={styles.shimmer} aria-hidden />
        </div>
      </div>
      <ol className={styles.steps} aria-hidden>
        <li className={stepClass(state.phase, "preparing")}>Prep</li>
        <li className={stepClass(state.phase, "uploading")}>Upload</li>
        <li className={stepClass(state.phase, "analyzing")}>Análise</li>
        <li className={stepClass(state.phase, "finishing")}>Pronto</li>
      </ol>
    </div>
  );
}

function stepClass(
  current: UploadProgressState["phase"],
  step: Exclude<UploadProgressState["phase"], "idle">,
) {
  const order = ["preparing", "uploading", "analyzing", "finishing"] as const;
  const ci = order.indexOf(current as (typeof order)[number]);
  const si = order.indexOf(step);
  if (si < ci) return styles.stepDone;
  if (si === ci) return styles.stepActive;
  return styles.step;
}
