export const sum = (values: (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);

export const observed = (values: (number | null)[]) => ({
  value: values.some((value) => value !== null) ? sum(values) : null,
  matches: values.filter((value) => value !== null).length,
});

export const average = (values: (number | null)[]) => {
  const valid = values.filter((value): value is number => value !== null);
  return { value: valid.length ? sum(valid) / valid.length : null, matches: valid.length };
};

/** Provider percentages are stored as fractions; leave already-scaled values intact. */
export const displayPercent = (value: number | null) => value === null ? null : value >= 0 && value <= 1 ? Math.round(value * 1000) / 10 : value;

/** A trend is observed only when every match in its window has a value. */
export const rollingAverage = (values: (number | null)[], window: number) => values.map((_, index) => {
  if (index < window - 1) return null;
  const slice = values.slice(index - window + 1, index + 1);
  return slice.every((value): value is number => value !== null)
    ? slice.reduce((total, value) => total + value, 0) / window
    : null;
});
