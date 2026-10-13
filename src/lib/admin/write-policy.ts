/** Production admin mutations stay disabled unless explicitly activated. */
export function productionAdminEditingEnabled(value: string | undefined): boolean {
  return value === "1";
}
