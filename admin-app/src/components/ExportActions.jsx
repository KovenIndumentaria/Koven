export default function ExportActions({ onCsv, onPdf, disabled = false }) {
  return <div className="export-actions">
    {onCsv && <button type="button" className="button-secondary" onClick={onCsv} disabled={disabled}>Exportar CSV</button>}
    {onPdf && <button type="button" className="button-secondary" onClick={onPdf} disabled={disabled}>Exportar PDF</button>}
  </div>;
}
