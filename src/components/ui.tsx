import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  FileCheck2,
  Info,
  Loader2,
  PackageCheck,
  Send,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { STATUS_LABEL, STATUS_TONE, type Tone } from "@/services/freight/status";
import type { FreightStatus } from "@/services/freight/types";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ etiquetas */

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-[#e8e8e8] text-[#555] border-transparent",
  outline: "bg-white text-[#555] border-[#ccc]",
  blue: "bg-[#337ab7] text-white border-transparent",
  sky: "bg-[#31b0d5] text-white border-transparent",
  amber: "bg-[#f0ad4e] text-white border-transparent",
  green: "bg-snk-green text-white border-transparent",
  red: "bg-[#d9534f] text-white border-transparent",
};

export function Badge({ tone = "neutral", icon: Icon, children, title }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-[3px] border px-2 text-xs font-bold leading-none",
        TONE_CLASS[tone]
      )}
    >
      {Icon && <Icon size={12} strokeWidth={2.5} aria-hidden />}
      {children}
    </span>
  );
}

export const STATUS_ICON: Record<FreightStatus, LucideIcon> = {
  C: FileCheck2,
  S: Send,
  T: Truck,
  E: PackageCheck,
  P: AlertTriangle,
  X: Ban,
};

/** Situação do frete: ícone + texto + cor (nunca só a cor). */
export function StatusBadge({ status }: { status: FreightStatus | null | undefined }) {
  if (!status) {
    return (
      <Badge tone="outline" icon={CircleDashed}>
        Sem cotação OK
      </Badge>
    );
  }
  return (
    <Badge tone={STATUS_TONE[status]} icon={STATUS_ICON[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function EnvBadge({ env }: { env: string | null | undefined }) {
  if (env === "S") {
    return <Badge tone="amber">Sandbox</Badge>;
  }
  if (env === "P") {
    return <Badge tone="green">Produção</Badge>;
  }
  return null;
}

/* ------------------------------------------------------------------ alertas */

const ALERT: Record<"error" | "warning" | "success" | "info", { cls: string; icon: LucideIcon }> = {
  error: { cls: "bg-[#f2dede] border-[#ebccd1] text-[#a94442]", icon: CircleAlert },
  warning: { cls: "bg-[#fcf8e3] border-[#faebcc] text-[#8a6d3b]", icon: AlertTriangle },
  success: { cls: "bg-[#dff0d8] border-[#d6e9c6] text-[#3c763d]", icon: CheckCircle2 },
  info: { cls: "bg-[#d9edf7] border-[#bce8f1] text-[#31708f]", icon: Info },
};

export function Alert({ kind, children, className }: { kind: keyof typeof ALERT; children: ReactNode; className?: string }) {
  const { cls, icon: Icon } = ALERT[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-[3px] border px-3 py-2.5 text-[13px]", cls, className)}>
      <Icon size={16} className="mt-px shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ painéis */

export function Panel({
  title,
  icon: Icon,
  actions,
  children,
  className,
  bodyClass = "p-4",
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={cx("panel", className)}>
      {title != null && (
        <header className="panel-head">
          <h2 className="panel-title m-0">
            {Icon && <Icon size={16} aria-hidden />}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/** Indicador: rótulo, valor e, opcionalmente, uma linha de apoio. */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  onClick,
  active,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  accent?: "green" | "red" | "amber" | "blue";
  onClick?: () => void;
  active?: boolean;
}) {
  const accentCls =
    accent === "green"
      ? "border-l-snk-green"
      : accent === "red"
        ? "border-l-status-critical"
        : accent === "amber"
          ? "border-l-status-warning"
          : accent === "blue"
            ? "border-l-series-1"
            : "border-l-edge";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx(
        "panel flex min-w-0 flex-col items-start border-l-4 px-3.5 py-3 text-left",
        accentCls,
        onClick && "cursor-pointer transition-colors hover:bg-[#fafafa]",
        active && "ring-2 ring-snk-green"
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {Icon && <Icon size={14} aria-hidden />}
        {label}
      </span>
      <span className="mt-1 text-[22px] font-bold leading-tight text-ink">{value}</span>
      {hint && <span className="mt-0.5 text-xs text-muted">{hint}</span>}
    </Tag>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cx("animate-spin text-snk-green", className)} aria-hidden />;
}

export function Empty({ icon: Icon = CircleDashed, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-muted">
      <Icon size={28} className="text-faint" aria-hidden />
      <div className="font-bold text-ink">{title}</div>
      {children && <div className="max-w-md text-[13px]">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ seleção */

/** Botões de opção lado a lado (situação, ambiente, período). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode; count?: number }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-[3px] border border-[#ccc] bg-white" role="radiogroup">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 whitespace-nowrap font-bold transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              i > 0 && "border-l border-[#ccc]",
              on ? "bg-snk-green text-white" : "bg-white text-[#555] hover:bg-[#f2f2f2]"
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cx("rounded-full px-1.5 text-[11px] leading-[18px]", on ? "bg-white/25" : "bg-[#eee] text-muted")}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Abas sublinhadas, como as etapas do pop-up. */
export function Tabs<T extends string>({
  value,
  tabs,
  onChange,
}: {
  value: T;
  tabs: { value: T; label: string; icon?: LucideIcon; count?: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-end gap-1 border-b border-edge" role="tablist">
      {tabs.map((t) => {
        const on = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cx(
              "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-[3px] px-3 py-2.5 text-[13px] font-bold transition-colors",
              on ? "border-snk-green text-ink" : "border-transparent text-[#999] hover:text-ink"
            )}
          >
            {Icon && <Icon size={14} aria-hidden />}
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="rounded-full bg-[#eee] px-1.5 text-[11px] leading-[18px] text-muted">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({ title, onClose, children, width = 820 }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="flex max-h-full w-full flex-col overflow-hidden rounded bg-white shadow-[0_10px_40px_rgba(0,0,0,0.3)] outline-none"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="m-0 text-base font-bold">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** Rótulo e valor em pares (detalhe). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 break-words font-bold text-ink">{children ?? "—"}</div>
    </div>
  );
}
