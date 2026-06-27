/**
 * Canonical formatting + safe-value layer.
 *
 * This module is the single source of truth for rendering domain values
 * (currency, numbers, dates) and for guarding against empty/invalid text
 * leaking into the UI. It replaces the fragmented formatters previously
 * spread across `@/lib/mock-data` and `@/lib/utils/currency`.
 *
 * Design references:
 *   - Requirement 5.4: never render `undefined`/`null`/`NaN`/`""` as text;
 *     render a defined, non-empty visible fallback instead.
 *   - Requirement 5.5: currency renders with a symbol/code and digit grouping,
 *     numbers use digit grouping and consistent precision, and dates use one
 *     consistent, locale-appropriate pattern.
 */

/** The defined visible fallback indicator (Requirement 5.4). */
export const FALLBACK_TEXT = "—";

/** The single locale used for all canonical formatting (Requirement 5.5). */
export const DEFAULT_LOCALE = "id-ID";

/** The default currency used when a caller does not specify one. */
export const DEFAULT_CURRENCY = "IDR";

/** Consistent default precision for plain numbers (Requirement 5.5). */
const DEFAULT_NUMBER_FRACTION_DIGITS = 2;

/** Date presentation styles mapped onto `Intl.DateTimeFormat` `dateStyle`. */
export type DateStyle = "short" | "medium" | "long" | "full";

/** Time presentation styles mapped onto `Intl.DateTimeFormat` `timeStyle`. */
export type TimeStyle = "short" | "medium" | "long" | "full";

/**
 * Returns true for values that must never be rendered as user-facing text:
 * `null`, `undefined`, `NaN`, and empty/whitespace-only strings.
 */
function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return !Number.isFinite(value);
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** True only for a real, finite, renderable number. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Coerces a date-like value into a valid `Date`, or `null` when the input is
 * missing or cannot be parsed into a valid date.
 */
function toValidDate(
  value: string | number | Date | null | undefined,
): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Renders any value as safe display text. Returns the defined `fallback`
 * (default `"—"`) for `null`, `undefined`, `NaN`, and empty strings so that
 * `undefined`/`null`/`NaN`/`""` never reach the screen (Requirement 5.4).
 */
export function safeText(value: unknown, fallback: string = FALLBACK_TEXT): string {
  if (isBlank(value)) return fallback;
  const text = String(value);
  return text.trim() === "" ? fallback : text;
}

/**
 * Formats a monetary value with a currency symbol/code and digit grouping
 * (Requirement 5.5). Returns the fallback for missing/invalid input
 * (Requirement 5.4).
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!isFiniteNumber(value)) return FALLBACK_TEXT;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      useGrouping: true,
    }).format(value);
  } catch {
    // Invalid currency/locale code — never leak a raw or broken value.
    return FALLBACK_TEXT;
  }
}

/**
 * Formats a number with digit grouping and consistent default precision
 * (Requirement 5.5). Caller-supplied `opts` override the defaults. Returns the
 * fallback for missing/invalid input (Requirement 5.4).
 */
export function formatNumber(
  value: number | null | undefined,
  opts?: Intl.NumberFormatOptions,
): string {
  if (!isFiniteNumber(value)) return FALLBACK_TEXT;
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    useGrouping: true,
    maximumFractionDigits: DEFAULT_NUMBER_FRACTION_DIGITS,
    ...opts,
  }).format(value);
}

/**
 * Formats a date using one consistent, locale-appropriate pattern
 * (Requirement 5.5). Returns the fallback for missing/invalid input
 * (Requirement 5.4).
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  style: DateStyle = "medium",
): string {
  const date = toValidDate(value);
  if (!date) return FALLBACK_TEXT;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: style }).format(date);
}

/**
 * Formats a date together with a time using one consistent, locale-appropriate
 * pattern (Requirement 5.5). Returns the fallback for missing/invalid input
 * (Requirement 5.4).
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  dateStyle: DateStyle = "medium",
  timeStyle: TimeStyle = "short",
): string {
  const date = toValidDate(value);
  if (!date) return FALLBACK_TEXT;
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle, timeStyle }).format(date);
}
