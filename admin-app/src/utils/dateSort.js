const time = (value) => value ? new Date(value).getTime() : 0;

export function newestDatedFirst(dateField) {
  return (a, b) => String(b[dateField] || "").localeCompare(String(a[dateField] || "")) || time(b.created_at) - time(a.created_at);
}

export function oldestDatedFirst(dateField) {
  return (a, b) => String(a[dateField] || "").localeCompare(String(b[dateField] || "")) || time(a.created_at) - time(b.created_at);
}
