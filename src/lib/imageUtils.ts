/**
 * Image utilities for compression and grid composition.
 * All operations run in the browser using native Canvas API — no external deps.
 */

/**
 * Compress a base64 data-URL to WebP.
 * If the image's longest side already fits within maxPx, no scaling is applied.
 * Returns a promise resolving to the new WebP data-URL.
 */
export function compressToWebP(
  dataUrl: string,
  maxPx = 1280,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if either dimension exceeds maxPx
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height / width) * maxPx);
          width = maxPx;
        } else {
          width = Math.round((width / height) * maxPx);
          height = maxPx;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/webp', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}

/**
 * Compose multiple images into a single grid image, exported as WebP.
 *
 * Images are laid out left-to-right, top-to-bottom in a `cols × rows` grid.
 * Each cell is `perImageMaxPx × perImageMaxPx` (aspect-ratio-fitted inside the cell).
 * A numbered label (1…N) is drawn in the top-left corner of each cell so the
 * vision model can reference individual sections.
 *
 * @param images   Array of data-URL strings (length must be ≤ cols × rows).
 * @param cols     Number of columns in the grid.
 * @param rows     Number of rows in the grid.
 * @param perImageMaxPx  Side length of each grid cell in pixels (default 640).
 * @param quality  WebP quality 0–1 (default 0.82).
 */
export function buildImageGrid(
  images: string[],
  cols: number,
  rows: number,
  perImageMaxPx = 640,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cellSize = perImageMaxPx;
    const canvasWidth = cols * cellSize;
    const canvasHeight = rows * cellSize;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Dark background so label text contrasts on any image
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new window.Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error('Failed to load image'));
        img.src = src;
      });

    Promise.all(images.map(loadImage))
      .then((imgs) => {
        imgs.forEach((img, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cellX = col * cellSize;
          const cellY = row * cellSize;

          // Fit image inside cell preserving aspect ratio
          const scale = Math.min(cellSize / img.width, cellSize / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const offsetX = cellX + (cellSize - drawW) / 2;
          const offsetY = cellY + (cellSize - drawH) / 2;

          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

          // Draw number label
          const label = String(i + 1);
          const fontSize = Math.round(cellSize * 0.065);
          ctx.font = `bold ${fontSize}px sans-serif`;
          const padding = Math.round(fontSize * 0.4);
          const textMetrics = ctx.measureText(label);
          const boxW = textMetrics.width + padding * 2;
          const boxH = fontSize + padding * 2;

          // Semi-transparent black background for readability
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillRect(cellX + 4, cellY + 4, boxW, boxH);

          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, cellX + 4 + padding, cellY + 4 + padding + fontSize * 0.85);
        });

        resolve(canvas.toDataURL('image/webp', quality));
      })
      .catch(reject);
  });
}

/**
 * Split an array into chunks of at most `size` elements.
 * The last chunk may be smaller.
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Determine the optimal grid layout (cols × rows) for a given number of images.
 * Strategy: keep it square or slightly wider than tall, up to a max of 4 images.
 */
export function getGridLayout(count: number): { cols: number; rows: number } {
  if (count === 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  return { cols: 2, rows: 2 }; // 4
}
