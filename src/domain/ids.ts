export function uuid(): string {
  return crypto.randomUUID();
}

export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]+$/i.test(value);
}
