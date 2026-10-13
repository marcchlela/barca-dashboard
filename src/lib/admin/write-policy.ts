/** Production admin mutations stay disabled unless explicitly activated. */
export function productionAdminEditingEnabled(value: string | undefined): boolean {
  return value === "1";
}

export function adminExecutionEnabled(environment: string | undefined, flag: string | undefined): boolean {
  return environment !== "production" || productionAdminEditingEnabled(flag);
}
