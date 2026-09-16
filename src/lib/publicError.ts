export function publicErrorMessage(error: unknown, fallback: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";

  const normalized = message.trim();
  if (!normalized) return fallback;

  const looksTechnical =
    /<\/?(?:html|head|body|title|pre)\b/i.test(normalized) ||
    /\b(?:502|503|504)\s+(?:bad gateway|service unavailable|gateway timeout)\b/i.test(
      normalized,
    ) ||
    /\b(?:postgrest|postgres|sqlstate|cloudflare|nginx)\b/i.test(normalized);

  if (looksTechnical) return fallback;
  return normalized.length > 180 ? fallback : normalized;
}
