export function cropFrame(
  width: number,
  height: number,
  ratio: number,
  x: number,
  y: number,
  following: boolean,
) {
  let sw = width,
    sh = height;
  if (width / height > ratio) sw = height * ratio;
  else sh = width / ratio;
  // Leave panning room even when the source and output share an aspect ratio.
  if (following) {
    sw /= 1.2;
    sh /= 1.2;
  }
  return {
    sx: Math.max(0, Math.min(width - sw, x * width - sw / 2)),
    sy: Math.max(0, Math.min(height - sh, y * height - sh / 2)),
    sw,
    sh,
  };
}
