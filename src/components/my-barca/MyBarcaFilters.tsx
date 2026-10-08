"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Star } from "lucide-react";
import type { KitTheme } from "../../lib/themes";
import styles from "./MyBarcaFilters.module.css";

type FilterOption<T extends string> = { value: T; label: string; mark?: ReactNode };

function useDismiss(ref: React.RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [ref]);
}

function closeMenu(ref: React.RefObject<HTMLDetailsElement | null>) {
  if (!ref.current) return;
  ref.current.open = false;
  ref.current.querySelector("summary")?.focus();
}

export function ThemedMenu<T extends string>({ label, value, options, onChange, theme }: { label: string; value: T; options: FilterOption<T>[]; onChange: (value: T) => void; theme: KitTheme }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDismiss(ref);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return <div className={styles.field}>
    <span className={styles.label} style={{ color: theme.colors.textMuted }}>{label}</span>
    <details ref={ref} className={styles.menu} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeMenu(ref); } }}>
      <summary className={styles.trigger} aria-label={`${label}: ${selected?.label ?? "None"}`} style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated, color: theme.colors.text, outlineColor: theme.colors.accent }}>
        {selected?.mark}<span className={styles.triggerText}>{selected?.label ?? "None"}</span><ChevronDown size={15} className={styles.chevron} style={{ color: theme.colors.accent }} aria-hidden="true" />
      </summary>
      <div className={styles.options} style={{ borderColor: theme.colors.accent, background: theme.colors.surface }}>
        {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => { onChange(option.value); closeMenu(ref); }} className={styles.option} style={{ borderColor: theme.colors.border, color: value === option.value ? theme.colors.accent : theme.colors.text, background: value === option.value ? theme.colors.backgroundElevated : undefined, outlineColor: theme.colors.accent }}>
          {option.mark}<span className={styles.optionText}>{option.label}</span>{value === option.value && <Check size={14} aria-hidden="true" />}
        </button>)}
      </div>
    </details>
  </div>;
}

export function RatingMenu({ value, onChange, theme }: { value: number | null; onChange: (rating: number | null) => void; theme: KitTheme }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [preview, setPreview] = useState<number | null>(null);
  useDismiss(ref);
  const shown = preview ?? value ?? 0;

  function choose(rating: number | null) {
    onChange(rating);
    setPreview(null);
    closeMenu(ref);
  }

  return <div className={styles.field}>
    <span className={styles.label} style={{ color: theme.colors.textMuted }}>Rating</span>
    <details ref={ref} className={styles.menu} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setPreview(null); closeMenu(ref); } }}>
      <summary className={styles.trigger} aria-label={`Rating filter: ${value === null ? "All ratings" : `${value.toFixed(1)} stars`}`} style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated, color: theme.colors.text, outlineColor: theme.colors.accent }}>
        <Star size={16} fill={value === null ? "none" : theme.colors.accent} color={theme.colors.accent} aria-hidden="true" /><span className={styles.triggerText}>{value === null ? "All ratings" : `${value.toFixed(1)} stars`}</span><ChevronDown size={15} className={styles.chevron} style={{ color: theme.colors.accent }} aria-hidden="true" />
      </summary>
      <div className={styles.ratingOptions} style={{ borderColor: theme.colors.accent, background: theme.colors.surface }}>
        <p className="text-[11px]" style={{ color: theme.colors.textMuted }}>Choose a full or half star</p>
        <div className={styles.stars} onPointerLeave={() => setPreview(null)} role="group" aria-label="Choose an exact rating in half-star steps">
          {[0, 1, 2, 3, 4].map((index) => {
            const filled = Math.max(0, Math.min(1, shown - index));
            return <span key={index} className={styles.star}>
              <Star size={42} className={styles.starVisual} color={theme.colors.textMuted} strokeWidth={1.5} aria-hidden="true" />
              {filled > 0 && <span className={styles.starVisual} style={{ clipPath: filled === 1 ? undefined : "inset(0 50% 0 0)" }}><Star size={42} fill={theme.colors.accent} color={theme.colors.accent} strokeWidth={1.5} aria-hidden="true" /></span>}
              {[0.5, 1].map((half) => {
                const rating = index + half;
                return <button key={half} type="button" className={`${styles.half} ${half === 0.5 ? styles.halfLeft : styles.halfRight}`} onPointerEnter={() => setPreview(rating)} onFocus={() => setPreview(rating)} onClick={() => choose(rating)} aria-label={`${rating.toFixed(1)} stars`} aria-pressed={value === rating} style={{ outlineColor: theme.colors.accent }} />;
              })}
            </span>;
          })}
        </div>
        <p className="mt-2 text-xs tabular-nums" style={{ color: theme.colors.accent }}>{shown ? `${shown.toFixed(1)} / 5` : "No rating selected"}</p>
        <button type="button" onClick={() => choose(null)} className={styles.clear} style={{ borderColor: theme.colors.border, background: theme.colors.backgroundElevated, color: theme.colors.text, outlineColor: theme.colors.accent }}>Show all ratings</button>
      </div>
    </details>
  </div>;
}
