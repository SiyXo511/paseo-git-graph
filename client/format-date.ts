export function formatCommitDate(value: string, compact = false): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const date = parsed.toLocaleDateString(undefined, {
    month: compact ? "numeric" : "short",
    day: "numeric",
  });
  const time = parsed.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}
