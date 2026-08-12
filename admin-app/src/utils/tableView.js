export function nextSort(current, column, defaultDirection = "asc") {
  if (current.column !== column) return { column, direction: defaultDirection };
  return { column, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function compareValues(left, right, direction = "asc") {
  const multiplier = direction === "asc" ? 1 : -1;
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === "number" && typeof right === "number") return (left - right) * multiplier;
  return String(left).localeCompare(String(right), "es", { sensitivity: "base", numeric: true }) * multiplier;
}

export function paginate(rows, page, pageSize) {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}
