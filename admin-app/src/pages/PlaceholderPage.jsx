export default function PlaceholderPage({ title, description }) {
  return (
    <section>
      <p className="eyebrow">Panel administrativo</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
      <div className="empty-state">Esta sección se implementará en su fase correspondiente.</div>
    </section>
  );
}
