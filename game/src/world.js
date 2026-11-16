import * as THREE from 'three';
import { COLORS } from './palette.js';

// Map: VOLT YARD — a compact industrial yard. T-spawn west, CT-spawn east,
// mid corridor with a raised catwalk, two bomb sites (A north, B south).
// All geometry is boxes; walls block movement and bullets.

export const MAP = {
  bounds: { minX: -40, maxX: 40, minZ: -30, maxZ: 30 },
  boxes: [],       // {min:{x,z}, max:{x,z}, h} for collision
  spawnT: [[-34, 20], [-36, 16], [-34, 12], [-30, 20], [-36, 8]],
  spawnCT: [[34, -20], [36, -16], [34, -12], [30, -20], [36, -8]],
  siteA: { x: 22, z: 20 },
  siteB: { x: 22, z: -20 },
};

function solid(x1, z1, x2, z2, h, color, y = 0) {
  const w = x2 - x1, d = z2 - z1;
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  mesh.position.set((x1 + x2) / 2, y + h / 2, (z1 + z2) / 2);
  MAP.boxes.push({ x1, z1, x2, z2, h, y });
  return mesh;
}

export function buildWorld(scene) {
  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshLambertMaterial({ color: COLORS.floor }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  // outer walls
  const H = 6;
  scene.add(solid(-40, -30, 40, -29, H, COLORS.wallB));
  scene.add(solid(-40, 29, 40, 30, H, COLORS.wallB));
  scene.add(solid(-40, -30, -39, 30, H, COLORS.wallB));
  scene.add(solid(39, -30, 40, 30, H, COLORS.wallB));

  // T base (west) open yard; CT base (east)
  scene.add(solid(-14, -30, -13, -6, 4, COLORS.wallA));   // west inner wall lower
  scene.add(solid(-14, 6, -13, 30, 4, COLORS.wallA));
  scene.add(solid(13, -30, 14, -6, 4, COLORS.wallA));
  scene.add(solid(13, 6, 14, 30, 4, COLORS.wallA));

  // mid corridor walls with door gaps
  scene.add(solid(-6, -10, -5, 10, 5, COLORS.wallA));
  scene.add(solid(5, -10, 6, 10, 5, COLORS.wallA));

  // site A (north) walls + crates
  scene.add(solid(16, 14, 17, 26, 3.5, COLORS.wallA));
  scene.add(solid(28, 26, 34, 27, 3.5, COLORS.wallA));
  scene.add(solid(24, 16, 27, 19, 1.6, COLORS.crate));
  scene.add(solid(19, 21, 22, 24, 1.6, COLORS.crate));
  scene.add(solid(30, 18, 33, 21, 2.6, COLORS.crate));

  // site B (south)
  scene.add(solid(16, -26, 17, -14, 3.5, COLORS.wallA));
  scene.add(solid(28, -27, 34, -26, 3.5, COLORS.wallA));
  scene.add(solid(24, -19, 27, -16, 1.6, COLORS.crate));
  scene.add(solid(19, -24, 22, -21, 1.6, COLORS.crate));
  scene.add(solid(30, -21, 33, -18, 2.6, COLORS.crate));

  // scattered cover in yards
  scene.add(solid(-26, 4, -23, 8, 2, COLORS.crate));
  scene.add(solid(-30, -12, -26, -8, 2, COLORS.crate));
  scene.add(solid(24, 2, 28, 5, 2, COLORS.crate));
  scene.add(solid(22, -6, 26, -3, 2, COLORS.crate));
  scene.add(solid(-2, 20, 2, 23, 2, COLORS.crate));
  scene.add(solid(-2, -23, 2, -20, 2, COLORS.crate));
  scene.add(solid(0, -3, 4, 3, 2.6, COLORS.crate));

  // site markers (flat glowing pads)
  for (const [site, color] of [[MAP.siteA, COLORS.accent], [MAP.siteB, COLORS.accent2]]) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(site.x, 0.02, site.z);
    scene.add(pad);
  }

  // lights: warm key from above, cool sky bounce, so the yard reads at a glance
  scene.add(new THREE.HemisphereLight(0x9fb8dd, 0x3a3326, 1.15));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.5);
  sun.position.set(-30, 50, -20);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6ea8ff, 0.5);
  rim.position.set(30, 25, 30);
  scene.add(rim);
  const fill = new THREE.PointLight(COLORS.accent, 0.6, 40);
  fill.position.set(22, 6, 20);
  scene.add(fill);
  const fill2 = new THREE.PointLight(COLORS.accent2, 0.6, 40);
  fill2.position.set(22, 6, -20);
  scene.add(fill2);
}

export function collide(x, z, r = 0.5) {
  for (const b of MAP.boxes) {
    if (b.h < 0.5) continue;
    const nx = Math.max(b.x1, Math.min(x, b.x2));
    const nz = Math.max(b.z1, Math.min(z, b.z2));
    const dx = x - nx, dz = z - nz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

export function moveEntity(pos, vel, dt) {
  const nx = pos.x + vel.x * dt;
  if (!collide(nx, pos.z)) pos.x = nx;
  const nz = pos.z + vel.z * dt;
  if (!collide(pos.x, nz)) pos.z = nz;
  pos.x = Math.max(MAP.bounds.minX + 1, Math.min(MAP.bounds.maxX - 1, pos.x));
  pos.z = Math.max(MAP.bounds.minZ + 1, Math.min(MAP.bounds.maxZ - 1, pos.z));
}

// line of sight between two points, eye height ~1.5; boxes taller than 1.4 block
export function lineOfSight(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const steps = Math.ceil(len / 0.8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = a.x + dx * t, z = a.z + dz * t;
    for (const box of MAP.boxes) {
      if (box.h > 1.4 && x > box.x1 && x < box.x2 && z > box.z1 && z < box.z2) return false;
    }
  }
  return true;
}
