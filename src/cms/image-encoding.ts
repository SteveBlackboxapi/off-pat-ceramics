// Safari can return PNG when canvas.toBlob is asked for WebP. Keep the
// storage format consistent by loading our own encoder only when needed.
export async function canvasWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  const native = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.84));
  let result = native;
  if (!result || result.type !== 'image/webp') {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not read the photograph. Please try again.');
    const { default: encode } = await import('@jsquash/webp/encode.js');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    result = new Blob([await encode(pixels, { quality: 84 })], { type: 'image/webp' });
  }
  if (result.size > 6 * 1024 * 1024) throw new Error('The converted photograph is still too large. Please try a smaller photograph.');
  return result;
}
