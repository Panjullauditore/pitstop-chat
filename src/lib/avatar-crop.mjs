/** Square source rectangle, always inside the image so the avatar has no empty edges.
 * @param {number} width
 * @param {number} height
 * @param {number} zoom
 * @param {number} panX
 * @param {number} panY
 */
export function avatarCrop(width,height,zoom,panX,panY){
  if(![width,height,zoom,panX,panY].every(Number.isFinite)||width<=0||height<=0)throw new Error('Ukuran foto tidak valid.');
  const side=Math.min(width,height)/Math.max(1,Math.min(4,zoom));
  const clamp=value=>Math.max(-1,Math.min(1,value));
  return {side,sx:(width-side)*(clamp(panX)+1)/2,sy:(height-side)*(clamp(panY)+1)/2};
}
