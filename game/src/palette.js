// VOLT PROTOCOL — palette: industrial amber/teal
export const COLORS = {
  sky: 0x10141c, fog: 0x10141c,
  floor: 0x2a2f38, floorAlt: 0x333a45,
  wallA: 0x4a5568, wallB: 0x3c4656,
  accent: 0xe8a33d, accent2: 0x2dd4bf,
  crate: 0x6b5b3e, crateTop: 0x8a7a52,
  ctBody: 0x3b82f6, ctHead: 0x1d4ed8,
  tBody: 0xef4444, tHead: 0x991b1b,
  muzzle: 0xffd873, tracer: 0xffe9a8,
  bomb: 0x22c55e,
};
export function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
