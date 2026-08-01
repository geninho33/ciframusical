import { getChordShape } from "../../../shared/lib/chordShapes";
import styles from "./ChordDiagram.module.css";

type Props = {
  symbol: string;
};

export function ChordDiagram({ symbol }: Props) {
  const shape = getChordShape(symbol);
  if (!shape) {
    return (
      <div className={styles.box}>
        <p className={styles.symbol}>{symbol}</p>
        <p className={styles.hint}>Diagrama indisponível</p>
      </div>
    );
  }

  const strings = 6;
  const frets = 5;
  const w = 120;
  const h = 140;
  const padX = 18;
  const padY = 28;
  const gridW = w - padX * 2;
  const gridH = h - padY - 16;

  return (
    <div className={styles.box}>
      <p className={styles.symbol}>{symbol}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className={styles.svg} aria-hidden>
        {shape.baseFret > 1 ? (
          <text x={4} y={padY + 4} className={styles.fretNum}>
            {shape.baseFret}
          </text>
        ) : null}
        {Array.from({ length: frets + 1 }).map((_, i) => {
          const y = padY + (i / frets) * gridH;
          return (
            <line
              key={`f${i}`}
              x1={padX}
              y1={y}
              x2={padX + gridW}
              y2={y}
              stroke="currentColor"
              strokeWidth={i === 0 && shape.baseFret === 1 ? 3 : 1}
              opacity={0.7}
            />
          );
        })}
        {Array.from({ length: strings }).map((_, i) => {
          const x = padX + (i / (strings - 1)) * gridW;
          return (
            <line
              key={`s${i}`}
              x1={x}
              y1={padY}
              x2={x}
              y2={padY + gridH}
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.7}
            />
          );
        })}
        {shape.frets.map((fret, stringIdx) => {
          const x = padX + (stringIdx / (strings - 1)) * gridW;
          if (fret < 0) {
            return (
              <text key={`m${stringIdx}`} x={x} y={padY - 10} textAnchor="middle" className={styles.mute}>
                ×
              </text>
            );
          }
          if (fret === 0) {
            return (
              <circle
                key={`o${stringIdx}`}
                cx={x}
                cy={padY - 10}
                r={4}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            );
          }
          const y = padY + ((fret - shape.baseFret + 0.5) / frets) * gridH;
          return <circle key={`d${stringIdx}`} cx={x} cy={y} r={6} fill="var(--accent)" />;
        })}
      </svg>
    </div>
  );
}
