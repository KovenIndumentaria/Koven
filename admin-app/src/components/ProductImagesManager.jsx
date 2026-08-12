import { useRef, useState } from "react";
import {
  deleteProductImage,
  getProductImageUrl,
  MAX_PRODUCT_IMAGES,
  reorderProductImages,
  replaceProductImage,
  uploadProductImage,
} from "../services/productImagesService";

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ProductImagesManager({ product, onChanged }) {
  const [images, setImages] = useState(() => [...(product.images || [])].sort((a, b) => a.sort_order - b.sort_order));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const replaceInput = useRef(null);
  const replacingImage = useRef(null);

  async function handleUpload(event) {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    if (images.length + files.length > MAX_PRODUCT_IMAGES) return setError(`Cada producto admite hasta ${MAX_PRODUCT_IMAGES} imágenes.`);
    setBusy(true); setError(""); setNotice("");
    const uploaded = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        uploaded.push(await uploadProductImage(product.id, files[index], images.length + index));
      }
      const nextImages = [...images, ...uploaded.map(({ optimization: _optimization, ...image }) => image)];
      setImages(nextImages);
      const before = uploaded.reduce((sum, item) => sum + item.optimization.sourceBytes, 0);
      const after = uploaded.reduce((sum, item) => sum + item.optimization.outputBytes, 0);
      setNotice(`${uploaded.length} imagen(es) cargada(s): ${formatBytes(before)} → ${formatBytes(after)} en WebP.`);
      onChanged?.(nextImages);
    } catch (uploadError) {
      if (uploaded.length) {
        const nextImages = [...images, ...uploaded.map(({ optimization: _optimization, ...image }) => image)];
        setImages(nextImages);
        onChanged?.(nextImages);
      }
      setError(uploadError.message || "No se pudieron cargar las imágenes.");
    } finally {
      setBusy(false);
    }
  }

  function requestReplacement(image) {
    replacingImage.current = image;
    replaceInput.current?.click();
  }

  async function handleReplacement(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const current = replacingImage.current;
    if (!file || !current) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await replaceProductImage({ ...current, product_id: product.id }, file);
      const nextImages = images.map((image) => image.id === current.id ? result.image : image);
      setImages(nextImages);
      setNotice(`Imagen reemplazada: ${formatBytes(result.optimization.sourceBytes)} → ${formatBytes(result.optimization.outputBytes)}.${result.orphanWarning ? " El archivo anterior requiere revisión en Storage." : ""}`);
      onChanged?.(nextImages);
    } catch (replaceError) {
      setError(replaceError.message || "No se pudo reemplazar la imagen.");
    } finally {
      replacingImage.current = null;
      setBusy(false);
    }
  }

  async function removeImage(image) {
    if (!window.confirm("¿Eliminar esta imagen definitivamente?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await deleteProductImage(image);
      const nextImages = images.filter((current) => current.id !== image.id);
      await reorderProductImages(nextImages);
      const normalized = nextImages.map((current, index) => ({ ...current, sort_order: index }));
      setImages(normalized);
      setNotice("Imagen eliminada correctamente.");
      onChanged?.(normalized);
    } catch (deleteError) {
      setError(deleteError.message || "No se pudo eliminar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  async function moveImage(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const nextImages = [...images];
    [nextImages[index], nextImages[target]] = [nextImages[target], nextImages[index]];
    setBusy(true); setError("");
    try {
      await reorderProductImages(nextImages);
      const normalized = nextImages.map((image, imageIndex) => ({ ...image, sort_order: imageIndex }));
      setImages(normalized);
      onChanged?.(normalized);
    } catch (orderError) {
      setError(orderError.message || "No se pudo cambiar el orden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="images-manager">
      <div className="variants-header">
        <div><h3>Imágenes</h3><p>La primera imagen será la portada. Máximo {MAX_PRODUCT_IMAGES}; JPG, PNG o WebP hasta 10 MB.</p></div>
        <label className={`button-secondary file-button ${busy || images.length >= MAX_PRODUCT_IMAGES ? "disabled" : ""}`}>
          Cargar imágenes
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || images.length >= MAX_PRODUCT_IMAGES} onChange={handleUpload} />
        </label>
      </div>
      <input ref={replaceInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleReplacement} />
      {!images.length ? <div className="images-empty">Este producto todavía no tiene imágenes. La tienda utilizará el placeholder.</div> : (
        <div className="images-grid">
          {images.map((image, index) => <article className="image-card" key={image.id}>
            <div className="image-preview"><img src={getProductImageUrl(image.storage_path)} alt={image.alt_text || product.name} />{index === 0 && <span>Portada</span>}</div>
            <div className="image-card-actions">
              <button type="button" disabled={busy || index === 0} onClick={() => moveImage(index, -1)} aria-label="Mover imagen a la izquierda">←</button>
              <button type="button" disabled={busy || index === images.length - 1} onClick={() => moveImage(index, 1)} aria-label="Mover imagen a la derecha">→</button>
              <button type="button" disabled={busy} onClick={() => requestReplacement(image)}>Reemplazar</button>
              <button type="button" disabled={busy} onClick={() => removeImage(image)}>Eliminar</button>
            </div>
          </article>)}
        </div>
      )}
      {notice && <div className="success-notice compact-notice">{notice}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
