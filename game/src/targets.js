// Bots: capsule meshes with team-colored bodies, waypoint routes per role,
// vision cone + line of sight, aim with error, reaction delay, and shooting.
import * as THREE from 'three';
import { MAP, moveEntity, lineOfSight } from './world.js';
import { COLORS } from './palette.js';

export class Bot {
  constructor(team, name, scene) {
    this.team = team; this.name = name;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.health = 100; this.alive = true;
    this.money = 800;
    this.weaponKey = 'pistols';
    this.ammo = 13; this.reserve = 52;
    this.reloadT = 0; this.fireT = 0;
    this.target = null; this.aimT = 0; this.reactT = 0;
    this.route = []; this.routeIdx = 0;
    this.holdUntil = 0;
    this.grenades = 0;
    this.blindUntil = 0;
    this.buildMesh(scene);
  }
  buildMesh(scene) {
    const bodyC = this.team === 'CT' ? COLORS.ctBody : COLORS.tBody;
    const headC = this.team === 'CT' ? COLORS.ctHead : COLORS.tHead;
    this.group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 8), new THREE.MeshLambertMaterial({ color: bodyC }));
    body.position.y = 0.75;
    this.group.add(body);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), new THREE.MeshLambertMaterial({ color: headC }));
    this.head.position.y = 1.5;
    this.group.add(this.head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x22262e }));
    gun.position.set(0.25, 1.0, -0.35);
    this.group.add(gun);
    scene.add(this.group);
  }
  eyePos() { return new THREE.Vector3(this.pos.x, 1.5, this.pos.z); }
  setRoute(pts) { this.route = pts; this.routeIdx = 0; }
  pickBuy() {
    // bots buy: T carrier keeps money, others scale weapon to money
    if (this.money >= 2700) { this.weaponKey = 'rifle'; this.ammo = 30; this.reserve = 90; this.money -= 2700; }
    else if (this.money >= 1900) { this.weaponKey = 'shotgun'; this.ammo = 7; this.reserve = 28; this.money -= 1900; }
    else if (this.money >= 1500 && !this.buy) { this.weaponKey = 'smg'; this.ammo = 30; this.reserve = 120; this.money -= 1500; }
    this.health = 100;
  }
  // returns {dir, def} when it fires, null otherwise
  update(dt, state) {
    const def = { pistols: { dmg: 26, rpm: 320, spread: 0.02, range: 60 }, rifle: { dmg: 33, rpm: 600, spread: 0.028, range: 90 }, smg: { dmg: 21, rpm: 800, spread: 0.04, range: 50 }, shotgun: { dmg: 15, rpm: 90, spread: 0.06, range: 26 } }[this.weaponKey];
    // reload
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) { const need = def.mag ?? 13; const take = Math.min(need - this.ammo, this.reserve); this.ammo += take; this.reserve -= take; }
      return null;
    }
    if (this.ammo <= 0) {
      if (this.reserve > 0) this.reloadT = 2.0;
      return null;
    }
    // acquire target: nearest visible enemy
    const enemies = state.allFighters().filter((f) => f !== this && f.team !== this.team && f.alive && performance.now() > (f.blindUntil || 0) - 1e9);
    let best = null, bestD = 1e9;
    for (const e of enemies) {
      const d = this.pos.distanceTo(e.pos);
      if (d < bestD && d < (def.range ?? 60)) {
        const ep = e.eyePos ? e.eyePos() : new THREE.Vector3(e.pos.x, 1.5, e.pos.z);
        if (lineOfSight(this.eyePos(), ep)) { best = e; bestD = d; }
      }
    }
    if (best !== this.target) { this.target = best; this.reactT = 0.25 + Math.random() * 0.35; }
    if (!this.target) this.target = best;
    if (this.target && this.reactT > 0) { this.reactT -= dt; }
    // movement: chase route; engage strafe when target
    let moveX = 0, moveZ = 0;
    const SPEED = this.target && this.reactT <= 0 ? 3.2 : 4.2;
    if (this.target && this.reactT <= 0) {
      // strafe-circle at mid range, stand still occasionally to shoot accurately
      const dx = this.target.pos.x - this.pos.x, dz = this.target.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 14) { moveX = dx / d; moveZ = dz / d; }
      else if (d < 6) { moveX = -dx / d * 0.6; moveZ = -dz / d * 0.6; }
      else {
        this.strafeDir = this.strafeDir || (Math.random() < 0.5 ? 1 : -1);
        if (Math.random() < dt * 0.5) this.strafeDir *= -1;
        if (Math.random() < dt * 0.8) this.holdT = 0.4; // stop to shoot
        if (this.holdT > 0) { this.holdT -= dt; }
        else { moveX = (-dz / d) * this.strafeDir; moveZ = (dx / d) * this.strafeDir; }
      }
      this.yaw = Math.atan2(-dx, -dz);
    } else {
      // follow route waypoints
      if (this.route.length && this.routeIdx < this.route.length) {
        const wp = this.route[this.routeIdx];
        const dx = wp[0] - this.pos.x, dz = wp[1] - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) { this.routeIdx++; if (this.routeIdx >= this.route.length) this.holdUntil = performance.now() / 1000 + 3 + Math.random() * 4; }
        else { moveX = dx / d; moveZ = dz / d; this.yaw = Math.atan2(-dx, -dz); }
      } else {
        // hold position; occasionally re-scan by turning
        if (this.route.length) this.routeIdx = 0;
        this.yaw += dt * 0.6;
      }
    }
    this.vel.set(moveX * SPEED, 0, moveZ * SPEED);
    moveEntity(this.pos, this.vel, dt);
    // fire
    let shot = null;
    if (this.target && this.reactT <= 0) {
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 60 / (def.rpm ?? 320) * (1 + Math.random() * 0.4);
        this.ammo--;
        shot = { def };
      }
    }
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.yaw;
    return shot;
  }
  takeDamage(dmg, head) {
    const total = head ? dmg * 3 : dmg;
    this.health -= total;
    if (this.health <= 0) { this.alive = false; this.group.visible = false; return true; }
    return false;
  }
}
