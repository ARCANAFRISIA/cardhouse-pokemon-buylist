export function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }

  return value;
}

export const brandName = env("BUYLIST_BRAND_NAME", "Card House of the East");
export const publicUrl = env("BUYLIST_PUBLIC_URL", "http://localhost:4000");