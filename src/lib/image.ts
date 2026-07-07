// =============================================================================
// image
// -----------------------------------------------------------------------------
// Små hjælpere til billed-håndtering i browseren:
//   - fileToDataUrl : læs en uploadet fil som base64 dataURL
//   - downscaleImage: nedskalér + JPEG-komprimér, så localStorage ikke sprænges
//   - loadImage     : promise-wrapper om HTMLImageElement
//
// Rå telefonbilleder er ofte 3-8 MB. localStorage har kun ~5 MB i alt, så vi
// nedskalerer altid før vi gemmer.
// =============================================================================

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Kunne ikke læse filen"));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Kunne ikke indlæse billedet"));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/**
 * Nedskalér et billede så længste side ≤ maxDim, og returnér en komprimeret
 * JPEG-dataURL. Bevarer størrelsesforhold. Bruges før alt der gemmes lokalt.
 */
export async function downscaleImage(
  src: string,
  maxDim = 1400,
  quality = 0.82,
  mime: "image/jpeg" | "image/png" = "image/jpeg",
  background?: string, // fx "#fff" – nødvendig når transparent PNG → JPEG
): Promise<string> {
  const img = await loadImage(src);
  const { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL(mime, quality);
}

/**
 * Stempl et lille badge (fx "AI-visualisering") i billedets nederste højre
 * hjørne. Bruges til at AI-mærke kundevendte billeder, jf. god skik og
 * markedsføringsloven – kunden skal kunne se, at billedet er AI-genereret.
 */
export async function stampBadge(src: string, label: string): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, w, h);

  const pad = Math.max(8, Math.round(Math.min(w, h) * 0.02));
  const fs = Math.max(12, Math.round(Math.min(w, h) * 0.022));
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  const tw = ctx.measureText(label).width;
  const boxW = tw + pad * 1.4;
  const boxH = fs + pad;
  ctx.fillStyle = "rgba(15,26,10,0.55)";
  ctx.fillRect(w - boxW - pad, h - boxH - pad, boxW, boxH);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(label, w - boxW - pad + pad * 0.7, h - pad - pad * 0.5);

  return canvas.toDataURL("image/jpeg", 0.88);
}

/**
 * Læs en fil, nedskalér den og returnér en gemme-venlig dataURL.
 * PNG bevares som PNG (så gennemsigtighed på fx produktbilleder ikke bliver
 * til sort baggrund); alt andet komprimeres som JPEG.
 */
export async function fileToScaledDataUrl(
  file: File,
  maxDim = 1400,
  quality = 0.82,
): Promise<string> {
  const raw = await fileToDataUrl(file);
  if (!file.type.startsWith("image/")) return raw;
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  try {
    return await downscaleImage(raw, maxDim, quality, mime);
  } catch {
    return raw;
  }
}
