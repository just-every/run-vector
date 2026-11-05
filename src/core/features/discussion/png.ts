/** Read the mandatory PNG header, never dimensions supplied by a caller. */
export function pngDimensions(data: Uint8Array): { width: number; height: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (data.length < 33 || signature.some((byte, i) => data[i] !== byte)) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...data.slice(12, 16)) !== 'IHDR') return null;
  const width = view.getUint32(16), height = view.getUint32(20);
  return width > 0 && height > 0 && width <= 0x7fffffff && height <= 0x7fffffff ? { width, height } : null;
}
