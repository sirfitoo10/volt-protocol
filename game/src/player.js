// Player: capsule-free simple FPS character. Eye height 1.6, crouch lowers it.
// Movement has acceleration and friction (stopping to aim pays).
import * as THREE from 'three';
import { COLORS } from './palette.js';
export class Player {
  constructor(team) {
    this.team = team;                 // 'T' | 'CT'
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.health = 100; this.alive = true;
    this.crouch = false;
    this.money = 800;
    this.kills = 0; this.deaths = 0;
    this.weaponKey = 'pistols';
    this.grenades = 0;
    this.blindUntil = 0;
    this.recoilPitch = 0; this.recoilYaw = 0;
  }
  get eyeHeight() { return this.crouch ? 1.1 : 1.6; }
  eyePos() { return new THREE.Vector3(this.pos.x, this.eyeHeight, this.pos.z); }
  lookDir() {
    const cp = Math.cos(this.pitch + this.recoilPitch);
    return new THREE.Vector3(-Math.sin(this.yaw + this.recoilYaw) * cp, Math.sin(this.pitch + this.recoilPitch), -Math.cos(this.yaw + this.recoilYaw) * cp);
  }
  isMoving() { return Math.hypot(this.vel.x, this.vel.z) > 0.6; }
}
