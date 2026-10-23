/** Formatos de México: español es-MX, zona America/Mexico_City y pesos MXN. */
export const LOCALE = "es-MX";
export const TIME_ZONE = "America/Mexico_City";
export const CURRENCY = "MXN";

const currency = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const dateTime = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, dateStyle: "long" });

/** Los montos viajan como enteros en centavos para evitar errores de punto flotante. */
export function formatMxn(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError("El monto debe ser un entero en centavos");
  return currency.format(cents / 100);
}

export function formatDateTime(value: Date | string): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDate(value: Date | string): string {
  return dateOnly.format(typeof value === "string" ? new Date(value) : value);
}

/** Rango de `days` días que termina hoy, como fechas "AAAA-MM-DD" en America/Mexico_City. */
export function lastDaysRange(days: number, now: Date = new Date()): { from: string; to: string } {
  const iso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
  return { from: iso(new Date(now.getTime() - (days - 1) * 86_400_000)), to: iso(now) };
}
