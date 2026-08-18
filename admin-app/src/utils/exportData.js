function safeText(value) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  return `"${safeText(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return safeText(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

export function downloadCsv(filename, headers, rows) {
  const content = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function printTable({ title, subtitle = "", headers, rows, summary = [] }) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("El navegador bloqueó la ventana del PDF. Permití las ventanas emergentes para este sitio.");
  popup.opener = null;
  const summaryHtml = summary.length ? `<section class="summary">${summary.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</section>` : "";
  const tableHtml = `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)} | KOVEN</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#111;font-family:Arial,sans-serif;font-size:10px}header{margin-bottom:18px;border-bottom:2px solid #111;padding-bottom:12px}h1{margin:0 0 5px;font-size:23px}p{margin:0;color:#555}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 16px}.summary div{padding:10px;border:1px solid #ccc}.summary span,.summary strong{display:block}.summary span{color:#666;font-size:8px;text-transform:uppercase}.summary strong{margin-top:5px;font-size:14px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#eee;font-size:8px;text-transform:uppercase}tr{break-inside:avoid}footer{margin-top:14px;color:#777;font-size:8px}@media print{button{display:none}}</style></head><body><header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></header>${summaryHtml}${tableHtml}<footer>Generado desde KOVEN Administración · ${escapeHtml(new Date().toLocaleString("es-AR"))}</footer><script>window.onload=()=>setTimeout(()=>window.print(),150);<\/script></body></html>`);
  popup.document.close();
}
