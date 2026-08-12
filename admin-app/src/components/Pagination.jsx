export default function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  return <div className="pagination" aria-label="Paginación">
    <span>Mostrando {from}–{to} de {total}</span>
    <label>Filas <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
    <div><button type="button" disabled={safePage === 1} onClick={() => onPage(safePage - 1)}>Anterior</button><span>Página {safePage} de {pages}</span><button type="button" disabled={safePage === pages} onClick={() => onPage(safePage + 1)}>Siguiente</button></div>
  </div>;
}
