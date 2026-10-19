import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Gráficos da central em SVG puro. Paleta categórica validada (validate_palette.js, superfície
 * branca): série 1 azul #2a78d6, série 2 laranja #eb6834, série 3 verde-água #1baf7a (só com
 * rótulo visível: contraste abaixo de 3:1). Linhas de 2 px, marcadores de 8 px com anel da
 * superfície, grade fina e discreta, legenda sempre que há duas séries ou mais.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];

const GRID = "#ececec";
const AXIS = "#c9c9c9";
const MUTED = "#8a8a8a";

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Marcas "redondas" para o eixo: 0, 5, 10, 15… */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export interface LineSeries {
  key: string;
  label: string;
  values: number[];
  color?: string;
}

/** Linhas ao longo dos dias, com cruz e dica ao passar o mouse. */
export function LineChart({
  labels,
  series,
  format = (v) => v.toLocaleString("pt-BR"),
  tickFormat,
  height = 220,
  area = false,
}: {
  labels: Date[];
  series: LineSeries[];
  format?: (v: number) => string;
  tickFormat?: (v: number) => string;
  height?: number;
  area?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 16, bottom: 26, left: 44 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const n = labels.length;
  const x = (i: number) => (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => h - (v / top) * h;
  const xTicks = useMemo(() => {
    const want = Math.max(2, Math.min(7, Math.floor(w / 90)));
    const step = Math.max(1, Math.ceil(n / want));
    const out: number[] = [];
    for (let i = 0; i < n; i += step) out.push(i);
    return out;
  }, [n, w]);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round((px / w) * (n - 1)))));
  };

  const day = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div ref={ref} className="relative w-full select-none">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-[#555]">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-4 rounded" style={{ background: s.color ?? SERIES[i] }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(" e ")}>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
                <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {(tickFormat ?? format)(t)}
                </text>
              </g>
            ))}
            {xTicks.map((i) => (
              <text key={i} x={x(i)} y={h + 18} textAnchor="middle" fontSize={11} fill={MUTED}>
                {day(labels[i])}
              </text>
            ))}
            {series.map((s, si) => {
              const color = s.color ?? SERIES[si];
              const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
              return (
                <g key={s.key}>
                  {area && series.length === 1 && (
                    <path d={`${d} L${x(n - 1)},${h} L${x(0)},${h} Z`} fill={color} opacity={0.1} />
                  )}
                  <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {n > 0 && (
                    <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={4} fill={color} stroke="#fff" strokeWidth={2} />
                  )}
                </g>
              );
            })}
            {hover != null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="#9e9e9e" strokeWidth={1} />
                {series.map((s, si) => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color ?? SERIES[si]} stroke="#fff" strokeWidth={2} />
                ))}
              </g>
            )}
            <rect
              x={0}
              y={0}
              width={w}
              height={h}
              fill="transparent"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        </svg>
      )}
      {hover != null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-[140px] rounded-[3px] border border-edge bg-white px-2.5 py-2 text-xs shadow-md"
          style={{
            left: Math.min(width - 160, Math.max(0, pad.left + x(hover) + 12)),
            top: (series.length > 1 ? 28 : 0) + pad.top,
          }}
        >
          <div className="mb-1 font-bold">{labels[hover].toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</div>
          {series.map((s, si) => (
            <div key={s.key} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[#555]">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color ?? SERIES[si] }} />
                {s.label}
              </span>
              <span className="font-bold tabular-nums">{format(s.values[hover])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Texto à direita (padrão: o valor formatado). */
  display?: ReactNode;
  hint?: string;
  onClick?: () => void;
}

/** Barras horizontais ordenadas, com o valor na ponta e rótulo à esquerda. */
export function BarList({
  items,
  color = SERIES[0],
  format = (v) => v.toLocaleString("pt-BR"),
  limit = 8,
  labelWidth = 150,
}: {
  items: BarItem[];
  color?: string;
  format?: (v: number) => string;
  limit?: number;
  labelWidth?: number;
}) {
  const shown = items.slice(0, limit);
  const max = Math.max(1, ...shown.map((i) => i.value));
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {shown.map((it) => {
        const Tag = it.onClick ? "button" : "div";
        return (
          <li key={it.key}>
            <Tag
              type={it.onClick ? "button" : undefined}
              onClick={it.onClick}
              title={it.hint}
              className={cx(
                "group grid w-full items-center gap-3 rounded-[3px] px-1.5 py-1 text-left text-[13px]",
                it.onClick ? "cursor-pointer hover:bg-[#f3f7f3]" : "hover:bg-[#fafafa]"
              )}
              style={{ gridTemplateColumns: `${labelWidth}px 1fr auto` }}
            >
              <span className="truncate text-[#444]">{it.label}</span>
              <span className="relative h-2.5 rounded-sm bg-[#f0f0f0]">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[3px]"
                  style={{ width: `${Math.max(1.5, (it.value / max) * 100)}%`, background: color }}
                />
              </span>
              <span className="min-w-[64px] text-right font-bold tabular-nums">{it.display ?? format(it.value)}</span>
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}
