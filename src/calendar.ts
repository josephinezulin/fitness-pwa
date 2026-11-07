/** A calendar day in the selected sheet's timezone, independent of the device timezone. */
export function calendarDateInZone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Enumerate date keys, not local instants: device timezone and DST cannot skip days. */
export function calendarDaysEnding(reference: string, count: number): string[] {
  const end = new Date(reference + "T00:00:00.000Z");
  if (
    !/^\d{4}-\d\d-\d\d$/.test(reference) ||
    !Number.isFinite(end.getTime()) ||
    end.toISOString().slice(0, 10) !== reference ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 366
  )
    throw Error("趨勢日期或天數不符。");
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - count + 1 + index);
    return date.toISOString().slice(0, 10);
  });
}
