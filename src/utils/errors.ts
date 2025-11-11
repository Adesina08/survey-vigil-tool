export function getErrorBreakdown(rows: Record<string, unknown>[]) {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    const field = typeof row === "object" && row ? (row as Record<string, unknown>)["QC Issues"] : undefined;
    if (typeof field !== "string" || field.trim().length === 0) {
      continue;
    }

    field.split("|").forEach((chunk) => {
      const code = chunk.trim().split(":")[0];
      if (!code) {
        return;
      }
      counts[code] = (counts[code] ?? 0) + 1;
    });
  }

  return counts;
}
