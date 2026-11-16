// Weapons: damage model with head multipliers, spread that punishes movement,
// recoil that kicks the view, magazine + reserve ammo and reload timers.
export const WEAPONS = {
  pistols: { name: 'SIDEARM', price: 0, dmg: 26, headMul: 3.2, rpm: 320, mag: 13, reserve: 52, spread: 0.006, moveSpread: 0.030, recoil: 0.011, range: 60, automatic: false, reload: 1.6 },
  rifle: { name: 'VK-7 RIFLE', price: 2700, dmg: 33, headMul: 3.6, rpm: 600, mag: 30, reserve: 90, spread: 0.004, moveSpread: 0.055, recoil: 0.009, range: 90, automatic: true, reload: 2.3 },
  smg: { name: 'SR-9 SMG', price: 1500, dmg: 21, headMul: 2.9, rpm: 800, mag: 30, reserve: 120, spread: 0.010, moveSpread: 0.030, recoil: 0.006, range: 50, automatic: true, reload: 1.9 },
  shotgun: { name: 'BR-12 BREACHER', price: 1900, dmg: 15, pellets: 8, headMul: 2.0, rpm: 90, mag: 7, reserve: 28, spread: 0.030, moveSpread: 0.075, recoil: 0.030, range: 26, automatic: false, reload: 2.8 },
  sniper: { name: 'LR-50 LANCE', price: 4600, dmg: 115, headMul: 2.6, rpm: 45, mag: 5, reserve: 20, spread: 0.001, moveSpread: 0.090, recoil: 0.045, range: 140, automatic: false, reload: 3.2, zoom: true },
};

export const GRENADE = { name: 'FLASH', price: 300, fuse: 1.6, radius: 12, blindTime: 3.0 };

export class WeaponState {
  constructor(key) {
    this.set(key);
  }
  set(key) {
    this.key = key;
    this.def = WEAPONS[key];
    this.ammo = this.def.mag;
    this.reserve = this.def.reserve;
    this.reloading = 0;
    this.cooldown = 0;
    this.shotsInBurst = 0;
  }
  get canFire() { return !this.reloading && this.cooldown <= 0 && this.ammo > 0; }
  get empty() { return this.ammo === 0 && this.reserve === 0; }
  startReload() {
    if (this.reloading > 0 || this.ammo >= this.def.mag || this.reserve <= 0) return false;
    this.reloading = this.def.reload;
    return true;
  }
  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        const needed = this.def.mag - this.ammo;
        const take = Math.min(needed, this.reserve);
        this.ammo += take; this.reserve -= take;
      }
    }
    // burst decay: the longer you hold, the wider the cone (recoil control matters)
    this.shotsInBurst = Math.max(0, this.shotsInBurst - dt * 6);
  }
  fire() {
    if (!this.canFire) return null;
    this.ammo--;
    this.cooldown = 60 / this.def.rpm;
    this.shotsInBurst = Math.min(this.shotsInBurst + 1, 12);
    return this.def;
  }
  // total angular spread in radians for a shot taken now
  currentSpread(moving, crouched) {
    const d = this.def;
    let s = d.spread + (moving ? d.moveSpread : 0) + this.shotsInBurst * d.recoil * 0.55;
    if (crouched) s *= 0.55;
    return s;
  }
  refill() {
    this.ammo = this.def.mag;
    this.reserve = this.def.reserve;
  }
}
