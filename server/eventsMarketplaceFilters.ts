const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ParsedEventDateRange = {
  dateFrom: string | null;
  dateTo: string | null;
};

/** Normalize and validate marketplace date filters for SQL DATE() comparisons. */
export function parseEventDateRange(
  dateFromRaw: string | null | undefined,
  dateToRaw: string | null | undefined,
): ParsedEventDateRange {
  const dateFrom =
    dateFromRaw && ISO_DATE.test(dateFromRaw) ? dateFromRaw : null;
  let dateTo = dateToRaw && ISO_DATE.test(dateToRaw) ? dateToRaw : null;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { dateFrom: dateTo, dateTo: dateFrom };
  }

  return { dateFrom, dateTo };
}
