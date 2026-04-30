function snakeToCamel(input: string): string {
  return input.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toCamel<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((v) => toCamel(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[snakeToCamel(k)] = toCamel(v);
    }
    return out as T;
  }
  return value as T;
}
