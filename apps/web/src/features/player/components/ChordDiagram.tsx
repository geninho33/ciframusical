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
  const w = 132;
  const h = 156;
  const padX = 20;
  const padY = 30;
  const gridW = w - padX * 2;
  const gridH = h - padY - 18;

  const xAt = (stringIdx: number) => padX + (stringIdx / (strings - 1)) * gridW;
  const yAt = (fret: number) =>
    padY + ((fret - shape.baseFret + 0.5) / frets) * gridH;

  return (
    <div className={styles.box}>
      <p className={styles.symbol}>{symbol}</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className={styles.svg}
        role="img"
        aria-label={`Diagrama de violão: ${symbol}`}
      >
        {shape.baseFret > 1 ? (
          <text x={4} y={padY + 10} className={styles.fretNum}>
            {shape.baseFret}ª
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
              strokeWidth={i === 0 && shape.baseFret === 1 ? 3.5 : 1}
              opacity={0.75}
            />
          );
        })}

        {Array.from({ length: strings }).map((_, i) => {
          const x = xAt(i);
          return (
            <line
              key={`s${i}`}
              x1={x}
              y1={padY}
              x2={x}
              y2={padY + gridH}
              stroke="currentColor"
              strokeWidth={1 + (strings - 1 - i) * 0.15}
              opacity={0.75}
            />
          );
        })}

        {shape.barre ? (
          <rect
            x={xAt(shape.barre.from) - 7}
            y={yAt(shape.barre.fret) - 7}
            width={xAt(shape.barre.to) - xAt(shape.barre.from) + 14}
            height={14}
            rx={7}
            className={styles.barre}
          />
        ) : null}

        {shape.frets.map((fret, stringIdx) => {
          const x = xAt(stringIdx);
          if (fret < 0) {
            return (
              <text
                key={`m${stringIdx}`}
                x={x}
                y={padY - 10}
                textAnchor="middle"
                className={styles.mute}
              >
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
                r={4.5}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            );
          }
          // Skip dots covered by barre at same fret (visual clutter)
          if (
            shape.barre &&
            fret === shape.barre.fret &&
            stringIdx >= shape.barre.from &&
            stringIdx <= shape.barre.to
          ) {
            return null;
          }
          return (
            <circle
              key={`d${stringIdx}`}
              cx={x}
              cy={yAt(fret)}
              r={6.5}
              className={styles.dot}
            />
          );
        })}
      </svg>
      <p className={styles.tuning}>E A D G B E</p>
    </div>
  );
}
