/** Solo día y mes: el año de nacimiento no es necesario para esta preferencia. */
export const BIRTHDAY_CONSENT_VERSION = "2026-10-26";

export function parseBirthday(monthValue: unknown, dayValue: unknown): { month: number; day: number } | null {
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) return null;
  const maxDay = new Date(Date.UTC(2000, month, 0)).getUTCDate();
  return day >= 1 && day <= maxDay ? { month, day } : null;
}
