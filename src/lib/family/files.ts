const MAX_BYTES = 4_500_000; // ~3–4 Mo après base64, plus tolérant mobile
const VISION_MAX_CHARS = 1_400_000;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

function looksLikeJpeg(b: Uint8Array): boolean {
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}
function looksLikePng(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}
function looksLikeGif(b: Uint8Array): boolean {
  return b.length >= 3 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
}
function looksLikeWebp(b: Uint8Array): boolean {
  return b.length >= 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
}

export async function sniffIsImage(file: File): Promise<boolean> {
  if (file.type.startsWith("image/")) return true;
  if (/\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name)) return true;
  try {
    const buf = await file.slice(0, 16).arrayBuffer();
    const b = new Uint8Array(buf);
    return looksLikeJpeg(b) || looksLikePng(b) || looksLikeGif(b) || looksLikeWebp(b);
  } catch {
    return false;
  }
}

export function isHeic(file: File): boolean {
  return /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image non lisible"));
    image.src = src;
  });
}

type Raster = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  close?: () => void;
};

async function rasterizeFile(file: File): Promise<Raster> {
  const url = URL.createObjectURL(file);
  try {
    if (typeof createImageBitmap === "function") {
      try {
        const bmp = await createImageBitmap(file, {
          imageOrientation: "from-image",
        } as ImageBitmapOptions);
        return {
          width: bmp.width,
          height: bmp.height,
          draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
          close: () => bmp.close(),
        };
      } catch {
        // fall through
      }
    }
    const img = await loadHtmlImage(url);
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterizeDataUrl(dataUrl: string): Promise<Raster> {
  if (typeof createImageBitmap === "function") {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const bmp = await createImageBitmap(blob, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
        close: () => bmp.close(),
      };
    } catch {
      // fall through
    }
  }
  const img = await loadHtmlImage(dataUrl);
  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL("image/jpeg", quality);
}

function cropDocumentBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): { sx: number; sy: number; sw: number; sh: number } | null {
  const data = ctx.getImageData(0, 0, width, height).data;
  const threshold = 242;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 420));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luma < threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const padX = Math.round(width * 0.02);
  const padY = Math.round(height * 0.02);
  const sx = Math.max(0, minX - padX);
  const sy = Math.max(0, minY - padY);
  const ex = Math.min(width, maxX + padX);
  const ey = Math.min(height, maxY + padY);
  const sw = ex - sx;
  const sh = ey - sy;
  if (sw < width * 0.55 || sh < height * 0.55) return null;
  if (sw > width * 0.98 && sh > height * 0.98) return null;
  return { sx, sy, sw, sh };
}

function paintRaster(
  src: Raster,
  maxEdge: number,
  quality: number,
  opts?: { crop?: boolean; contrast?: boolean },
): string {
  const scale = Math.min(1, maxEdge / Math.max(src.width, src.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(src.width * scale));
  canvas.height = Math.max(1, Math.round(src.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: Boolean(opts?.crop || opts?.contrast) });
  if (!ctx) throw new Error("Image non lisible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  src.draw(ctx, canvas.width, canvas.height);

  if (opts?.crop && canvas.width > 40 && canvas.height > 40) {
    const box = cropDocumentBounds(ctx, canvas.width, canvas.height);
    if (box) {
      const cut = document.createElement("canvas");
      cut.width = box.sw;
      cut.height = box.sh;
      const c2 = cut.getContext("2d");
      if (c2) {
        c2.drawImage(canvas, box.sx, box.sy, box.sw, box.sh, 0, 0, box.sw, box.sh);
        canvas.width = cut.width;
        canvas.height = cut.height;
        ctx.drawImage(cut, 0, 0);
      }
    }
  }

  if (opts?.contrast) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const boosted = Math.max(0, Math.min(255, (y - 128) * 1.18 + 128));
      const mix = 0.35;
      d[i] = d[i] * (1 - mix) + boosted * mix;
      d[i + 1] = d[i + 1] * (1 - mix) + boosted * mix;
      d[i + 2] = d[i + 2] * (1 - mix) + boosted * mix;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvasToJpeg(canvas, quality);
}

export async function compressImage(
  file: File,
  maxEdge = 1800,
  quality = 0.84,
): Promise<string> {
  try {
    const src = await rasterizeFile(file);
    try {
      return paintRaster(src, maxEdge, quality);
    } finally {
      src.close?.();
    }
  } catch (err) {
    if (isHeic(file)) {
      throw new Error(
        "Photo iPhone (HEIC) illisible ici. Dans Photos : partager → « Enregistrer en JPEG », ou Réglages → Appareil photo → Formats → « Le plus compatible ».",
      );
    }
    throw err instanceof Error ? err : new Error("Image non lisible");
  }
}

export async function fileToStoredDataUrl(file: File): Promise<string> {
  const isImage = await sniffIsImage(file);

  let dataUrl = isImage ? await compressImage(file) : await readFileAsDataUrl(file);

  if (isImage && dataUrl.length > MAX_BYTES) {
    dataUrl = await compressImage(file, 1200, 0.68);
  }
  if (isImage && dataUrl.length > MAX_BYTES) {
    dataUrl = await compressImage(file, 960, 0.55);
  }
  if (dataUrl.length > MAX_BYTES) {
    throw new Error(
      "Fichier trop volumineux (max ~3 Mo). Compressez le PDF ou choisissez une photo plus légère.",
    );
  }
  return dataUrl;
}

/**
 * Prépare une photo d'emploi du temps pour la vision :
 * orientation EXIF, recadrage des bords vides, netteté, budget payload.
 */
export async function prepareImageForVision(
  dataUrl: string,
  budget = VISION_MAX_CHARS,
): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  const src = await rasterizeDataUrl(dataUrl);
  try {
    const longest = Math.max(src.width, src.height, 1);
    const steps: Array<{ edge: number; quality: number }> = [];
    if (longest > 2000) steps.push({ edge: 2000, quality: 0.88 });
    steps.push({ edge: Math.min(1800, longest), quality: 0.86 });
    steps.push({ edge: 1500, quality: 0.78 });
    steps.push({ edge: 1280, quality: 0.7 });

    let best = dataUrl;
    for (const step of steps) {
      try {
        const next = paintRaster(src, step.edge, step.quality, { crop: true, contrast: true });
        best = next;
        if (next.length <= budget) return next;
      } catch {
        // try next budget
      }
    }
    return best.length < dataUrl.length ? best : dataUrl;
  } finally {
    src.close?.();
  }
}

/** Plus léger pour l'API vision (payload serveur). */
export async function imageDataUrlForAi(
  dataUrl: string,
  maxEdge = 1800,
  quality = 0.84,
): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  try {
    return await prepareImageForVision(dataUrl);
  } catch {
    if (dataUrl.length <= 500_000) return dataUrl;
    const img = await loadHtmlImage(dataUrl);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvasToJpeg(canvas, quality);
  }
}

export function downloadDataUrl(dataUrl: string, name: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
