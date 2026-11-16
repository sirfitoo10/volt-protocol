// VOLT PROTOCOL main: fixed-step simulation (60 Hz) decoupled from render (rAF),
// round manager, bomb logic, buy menu, shooting with ray casts, grenades.
import * as THREE from 'three';
import { COLORS } from './palette.js';
import { buildWorld, MAP, moveEntity, collide, lineOfSight } from './world.js';
import { Input } from './input.js';
import { WEAPONS, WeaponState, GRENADE } from './weapon.js';
import { Player } from './player.js';
import { Bot } from './targets.js';
import { Hud, buildHudDom } from './hud.js';

const FIXED = 1 / 60;
const ROUND_TIME = 115, BOMB_TIME = 40, DEFUSE_TIME = 6, PLANT_TIME = 3.2, FREEZE = 4;
const BUY_MENU_KEYS = { '1': 'pistols', '2': 'smg', '3': 'rifle', '4': 'shotgun', '5': 'sniper', '6': 'grenade' };

const ui = buildHudDom();
const canvas = document.createElement('canvas');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0';
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.fog, 30, 110);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);
buildWorld(scene);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const input = new Input(canvas);
const hud = new Hud(document, null);

// ---- state -----------------------------------------------------------
const player = new Player('T');
player.pos.set(...MAP.spawnT[0]);
player.yaw = -Math.PI / 2; // face east, into the yard
const state = {
  player, weapon: new WeaponState('pistols'),
  scoreT: 0, scoreCT: 0, round: 1, roundSeconds: FREEZE,
  phase: 'freeze', // freeze | live | end
  message: '', currentSpread: 0.004,
  bomb: { state: 'carried', carrierTeam: 'T', pos: new THREE.Vector3(), timer: 0 },
  bots: [],
  grenades: [], tracers: [], impacts: [],
  playerMoney: 800,
};
hud.state = state;
player.money = 800;

const BOT_NAMES_T = ['Vector', 'Jolt', 'Wick', 'Sable'];
const BOT_NAMES_CT = ['Onyx', 'Talon', 'Volt', 'Cinder'];
const ROUTES_T = [
  [[-20, 18], [-2, 22], [14, 24], [22, 20]],
  [[-20, 12], [-2, 12], [10, 12], [18, 20], [22, 20]],
  [[-20, -18], [-2, -22], [14, -24], [22, -20]],
  [[-20, -12], [-2, -12], [10, -12], [18, -20], [22, -20]],
];
const ROUTES_CT = [
  [[20, -18], [8, -22], [-6, -18], [0, 0]],
  [[20, -12], [8, -10], [-4, 0], [0, 8]],
  [[20, 18], [8, 22], [-6, 18], [0, 0]],
  [[20, 12], [8, 10], [-4, 0], [0, -8]],
];
let allBots = [];

function spawnRound() {
  // reset fighters
  player.alive = true; player.health = 100; player.blindUntil = 0;
  player.pos.set(...MAP.spawnT[(state.round - 1) % MAP.spawnT.length]);
  player.vel.set(0, 0, 0);
  player.yaw = -Math.PI / 2; player.pitch = 0;
  state.bomb = { state: 'carried', carrierTeam: 'T', pos: new THREE.Vector3(), timer: 0 };
  state.phase = 'freeze';
  state.roundSeconds = FREEZE;
  state.message = `ROUND ${state.round} — VOLT PROTOCOL`;
  for (const b of allBots) {
    b.alive = true; b.health = 100; b.blindUntil = 0;
    b.group.visible = true;
    const spawns = b.team === 'T' ? MAP.spawnT : MAP.spawnCT;
    b.pos.set(...spawns[(allBots.indexOf(b)) % spawns.length]);
    b.route = (b.team === 'T' ? ROUTES_T : ROUTES_CT)[allBots.indexOf(b) % 4].map((p) => [...p]);
    b.routeIdx = 0;
  }
  for (const g of state.grenades) scene.remove(g.mesh);
  state.grenades.length = 0;
}

function startMatch() {
  player.money = 800;
  for (const b of BOT_NAMES_T) allBots.push(new Bot('T', b, scene));
  for (const b of BOT_NAMES_CT) allBots.push(new Bot('CT', b, scene));
  for (const b of allBots) { b.money = 800; b.pickBuy(); }
  state.bots = allBots;
  spawnRound();
}
startMatch();

state.allFighters = () => [player, ...allBots];

// ---- shooting --------------------------------------------------------
function shootRay(origin, dir, shooter) {
  const raycaster = new THREE.Raycaster(origin, dir, 0, 120);
  raycaster.camera = camera;
  const targets = [];
  for (const f of state.allFighters()) {
    if (f === shooter || !f.alive) continue;
    const isBot = f instanceof Bot;
    targets.push({ obj: isBot ? f.head : null, fighter: f, head: true, isBot });
    targets.push({ obj: isBot ? f.group.children[0] : null, fighter: f, head: false, isBot });
  }
  // map hit distance
  let mapDist = 120;
  const mapMeshes = scene.children.filter((c) => c.isMesh && c.geometry.type === 'BoxGeometry');
  for (const m of mapMeshes) {
    const hit = raycaster.intersectObject(m, false)[0];
    if (hit && hit.distance < mapDist) mapDist = hit.distance;
  }
  let best = null;
  for (const t of targets) {
    if (!t.obj) continue;
    const hit = raycaster.intersectObject(t.obj, false)[0];
    if (hit && (!best || hit.distance < best.dist)) best = { ...t, dist: hit.distance };
  }
  return { best, mapDist };
}

function playerShoot(def) {
  const spread = state.weapon.currentSpread(player.isMoving(), player.crouch);
  state.currentSpread = spread;
  const origin = player.eyePos();
  const dir = player.lookDir();
  const pellets = def.pellets || 1;
  let anyHit = false, anyKill = false, headshot = false;
  for (let p = 0; p < pellets; p++) {
    const d = dir.clone();
    d.x += (Math.random() - 0.5) * 2 * spread;
    d.y += (Math.random() - 0.5) * 2 * spread;
    d.z += (Math.random() - 0.5) * 2 * spread;
    d.normalize();
    const { best, mapDist } = shootRay(origin, d, player);
    spawnTracer(origin, origin.clone().addScaledVector(d, Math.min(best ? best.dist : mapDist, def.range)));
    if (best && best.dist < mapDist && best.dist < def.range) {
      const dmg = Math.max(4, def.dmg * (1 - best.dist / (def.range * 1.8)));
      const victim = best.fighter;
      const dead = victim === player ? false : victimTakeDamage(victim, dmg, best.head, player);
      anyHit = true; if (dead) anyKill = true; if (best.head) headshot = true;
    } else {
      spawnImpact(origin.clone().addScaledVector(d, mapDist));
    }
  }
  if (anyHit) flashHitmark(headshot);
  player.recoilPitch += def.recoil * (1 + player.recoilPitch * 4);
  player.recoilYaw += (Math.random() - 0.5) * def.recoil * 2;
}

function victimTakeDamage(victim, dmg, head, attacker) {
  const nameOf = (f) => f === player ? 'YOU' : f.name;
  if (victim === player) {
    player.health -= head ? dmg * 3 : dmg;
    flashDamage();
    if (player.health <= 0) {
      player.alive = false; player.deaths++;
      hud.kill(nameOf(attacker), 'YOU', head);
      checkRoundEnd();
      return false;
    }
    return false;
  }
  const dead = victim.takeDamage(dmg, head);
  if (dead) {
    const reward = head ? 350 : 300;
    player.money += reward; player.kills++;
    hud.kill('YOU', victim.name, head);
    checkRoundEnd();
  }
  return dead;
}

function botShoot(bot, def) {
  const target = bot.target;
  if (!target || !target.alive) return;
  const origin = bot.eyePos();
  const ep = target === player ? player.eyePos() : new THREE.Vector3(target.pos.x, target.pos.y + 1.0, target.pos.z);
  const dir = ep.clone().sub(origin).normalize();
  // aim error: worse at range and while both moving
  const dist = origin.distanceTo(ep);
  const err = (def.spread ?? 0.03) * (0.4 + dist / 30) * (target.isMoving && target.isMoving() ? 1.5 : 1);
  dir.x += (Math.random() - 0.5) * 2 * err;
  dir.y += (Math.random() - 0.5) * 2 * err * 0.5;
  dir.z += (Math.random() - 0.5) * 2 * err;
  dir.normalize();
  const { best, mapDist } = shootRay(origin, dir, bot);
  spawnTracer(origin, origin.clone().addScaledVector(dir, Math.min(best ? best.dist : mapDist, 90)));
  if (best && best.dist < mapDist && best.dist < (def.range ?? 60)) {
    const dmg = Math.max(4, (def.dmg ?? 26) * (1 - best.dist / 110));
    if (best.fighter === player) victimTakeDamage(player, dmg, best.head, bot);
    else if (best.fighter.team !== bot.team) {
      const dead = best.fighter.takeDamage(dmg, best.head);
      if (dead) { bot.money += 300; checkRoundEnd(); }
    }
  }
}

// ---- effects ---------------------------------------------------------
function spawnTracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: COLORS.tracer, transparent: true, opacity: 0.85 }));
  scene.add(line);
  state.tracers.push({ mesh: line, life: 0.06 });
}
function spawnImpact(p) {
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
  dot.position.copy(p);
  scene.add(dot);
  state.impacts.push({ mesh: dot, life: 1.5 });
}
function flashHitmark(head) {
  ui.hitmarkEl.style.opacity = 1;
  ui.hitmarkEl.style.background = head ? '#ffd873' : '#ff5a5a';
  setTimeout(() => { ui.hitmarkEl.style.opacity = 0; }, 90);
}
function flashDamage() {
  ui.dmgEl.style.opacity = 1;
  setTimeout(() => { ui.dmgEl.style.opacity = 0; }, 200);
}
function updateEffects(dt) {
  for (const arr of [state.tracers, state.impacts]) {
    for (let i = arr.length - 1; i >= 0; i--) {
      arr[i].life -= dt;
      if (arr[i].life <= 0) { scene.remove(arr[i].mesh); arr.splice(i, 1); }
    }
  }
  for (const g of state.grenades) {
    g.vy -= 9.8 * dt;
    g.pos.x += g.vx * dt; g.pos.z += g.vz * dt; g.pos.y += g.vy * dt;
    if (g.pos.y < 0.15) { g.pos.y = 0.15; g.vy *= -0.35; g.vx *= 0.7; g.vz *= 0.7; }
    if (collide(g.pos.x, g.pos.z, 0.2)) { g.vx *= -0.5; g.vz *= -0.5; }
    g.mesh.position.copy(g.pos);
    g.fuse -= dt;
    if (g.fuse <= 0) {
      // flashbang: blind anyone facing it within radius
      const flashPoint = g.pos;
      scene.remove(g.mesh);
      state.grenades.splice(state.grenades.indexOf(g), 1);
      const light = new THREE.PointLight(0xffffff, 30, GRENADE.radius * 3);
      light.position.copy(flashPoint);
      scene.add(light);
      setTimeout(() => scene.remove(light), 120);
      for (const f of state.allFighters()) {
        if (!f.alive) continue;
        const fp = f.eyePos ? f.eyePos() : f.eyePos();
        const d = fp.distanceTo(flashPoint);
        if (d < GRENADE.radius && lineOfSight(flashPoint, fp)) {
          const dirTo = fp.clone().sub(flashPoint).normalize();
          const facing = f.lookDir ? f.lookDir().dot(dirTo) : 1;
          const t = (facing > 0.2 ? GRENADE.blindTime : GRENADE.blindTime * 0.4) * (1 - d / GRENADE.radius);
          f.blindUntil = performance.now() / 1000 + Math.max(0.5, t);
        }
      }
    }
  }
}

// ---- rounds ----------------------------------------------------------
function teamAlive(team) {
  return state.allFighters().filter((f) => f.team === team && f.alive).length;
}
function checkRoundEnd() {
  if (state.phase !== 'live') return;
  const bomb = state.bomb;
  if (bomb.state === 'planted') {
    if (teamAlive('CT') === 0) endRound('T', 'BOMB SECURED — T WIN');
    else if (teamAlive('T') === 0 && !defusing) endRound('CT', 'ALL T DOWN — CT WIN');
    return;
  }
  if (teamAlive('CT') === 0) endRound('T', 'CT ELIMINATED — T WIN');
  else if (teamAlive('T') === 0) endRound('CT', 'T ELIMINATED — CT WIN');
}
let defusing = false, defuseT = 0, planting = false, plantT = 0;

function endRound(winner, msg) {
  state.phase = 'end';
  if (winner === 'T') state.scoreT++; else state.scoreCT++;
  state.message = msg;
  // economy: winner 3250, loser 1900 (+ plant bonus)
  const payout = (f) => { f.money = Math.min(9000, f.money + (winner === f.team ? 3250 : 1900)); };
  for (const f of state.allFighters()) payout(f);
  setTimeout(() => {
    state.round++;
    for (const b of allBots) b.pickBuy();
    state.weapon.refill();
    spawnRound();
  }, 3000);
}

// ---- buy menu --------------------------------------------------------
let buyOpen = false;
function renderBuy() {
  const rows = Object.entries(WEAPONS).map(([k, w], i) => {
    const afford = player.money >= w.price;
    return `<div class="row ${afford ? 'afford' : 'poor'}" data-k="${k}">${i + 1}. ${w.name} — $${w.price}</div>`;
  }).join('');
  const g = `<div class="row ${player.money >= GRENADE.price ? 'afford' : 'poor'}" data-k="grenade">6. FLASHBANG — $${GRENADE.price}</div>`;
  ui.buyEl.innerHTML = `<h3>BUY MENU — $${player.money}</h3>${rows}${g}<div class="hint">press the number again to buy · B / ESC to close</div>`;
  ui.buyEl.style.display = 'block';
  buyOpen = true;
}
function closeBuy() { ui.buyEl.style.display = 'none'; buyOpen = false; }
ui.buyEl.addEventListener('click', (e) => {
  const k = e.target.dataset?.k;
  if (k) tryBuy(k);
});
function tryBuy(k) {
  if (k === 'grenade') {
    if (player.money >= GRENADE.price) { player.money -= GRENADE.price; player.grenades++; }
  } else if (WEAPONS[k] && player.money >= WEAPONS[k].price) {
    player.money -= WEAPONS[k].price;
    state.weapon.set(k);
    player.weaponKey = k;
  }
  if (buyOpen) renderBuy();
}

// ---- player actions --------------------------------------------------
function playerPlantDefuse(dt) {
  const bomb = state.bomb;
  if (player.team === 'T' && bomb.state === 'carried' && bomb.carrierTeam === 'T' && player.alive) {
    const onSite = dist2(player.pos, MAP.siteA) < 25 || dist2(player.pos, MAP.siteB) < 25;
    if (onSite && input.keys['KeyE']) {
      plantT += dt;
      state.message = `PLANTING ${Math.round((plantT / PLANT_TIME) * 100)}%`;
      if (plantT >= PLANT_TIME) {
        bomb.state = 'planted';
        bomb.pos.set(player.pos.x, 0.3, player.pos.z);
        bomb.timer = BOMB_TIME;
        planting = false;
        state.message = 'BOMB PLANTED';
        plantBombMesh();
      }
    } else { plantT = 0; if (state.phase === 'live') state.message = ''; }
  }
  if (player.team === 'CT' && bomb.state === 'planted' && player.alive) {
    if (dist2(player.pos, bomb.pos) < 9 && input.keys['KeyE']) {
      defusing = true;
      defuseT += dt;
      state.message = `DEFUSING ${Math.round((defuseT / DEFUSE_TIME) * 100)}%`;
      if (defuseT >= DEFUSE_TIME) {
        bomb.state = 'defused';
        endRound('CT', 'BOMB DEFUSED — CT WIN');
      }
    } else { defuseT = 0; defusing = false; if (state.phase === 'live') state.message = ''; }
  }
}
function dist2(p, s) { const dx = p.x - s.x, dz = p.z - s.z; return dx * dx + dz * dz; }
let bombMesh = null;
function plantBombMesh() {
  bombMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), new THREE.MeshLambertMaterial({ color: COLORS.bomb }));
  bombMesh.position.copy(state.bomb.pos);
  scene.add(bombMesh);
  const led = new THREE.PointLight(0x22c55e, 2, 6);
  led.position.set(state.bomb.pos.x, 1, state.bomb.pos.z);
  scene.add(led);
  bombMesh.userData.led = led;
}

// ---- fixed step simulation -------------------------------------------
function simulate(dt, nowSec) {
  const p = player;
  // recoil recovery
  p.recoilPitch *= Math.max(0, 1 - dt * 6);
  p.recoilYaw *= Math.max(0, 1 - dt * 6);
  state.weapon.update(dt);
  // movement
  if (p.alive && !buyOpen) {
    const [ax, az] = input.axis();
    const SPEED = p.crouch ? 2.4 : (state.weapon.key === 'sniper' ? 4.4 : 5.4);
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const wx = (ax * cos - az * sin), wz = (ax * sin + az * cos);
    p.vel.x += (wx * SPEED - p.vel.x) * Math.min(1, dt * 10);
    p.vel.z += (wz * SPEED - p.vel.z) * Math.min(1, dt * 10);
    moveEntity(p.pos, p.vel, dt);
  }
  p.crouch = !!input.keys['ControlLeft'];
  // mouse look
  const [mdx, mdy] = input.consumeMouse();
  p.yaw -= mdx * 0.0023;
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch - mdy * 0.0023));
  // shooting
  const def = WEAPONS[p.weaponKey];
  if (input.consumeAction('reload') ) state.weapon.startReload();
  if (input.consumeAction('buy')) { buyOpen ? closeBuy() : renderBuy(); }
  if (buyOpen && input.consumeAction('buyQueued')) { const k = input.buyQueued; tryBuy(BUY_MENU_KEYS[k] || k); }
  const wantsFire = def.automatic ? input.fire : input.firePressed;
  if (wantsFire && p.alive && !buyOpen && state.phase === 'live' && nowSec > p.blindUntil) {
    if (state.weapon.empty) state.weapon.startReload();
    else if (state.weapon.canFire) {
      const fired = state.weapon.fire();
      if (fired) playerShoot(fired.def || fired);
    }
  }
  input.firePressed = false;
  // grenade
  if (input.consumeAction('grenade') && p.grenades > 0 && p.alive) {
    p.grenades--;
    const dir = p.lookDir();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    const g = { mesh, pos: p.eyePos().addScaledVector(dir, 0.6), vx: dir.x * 14, vy: dir.y * 14 + 3, vz: dir.z * 14, fuse: GRENADE.fuse };
    mesh.position.copy(g.pos);
    scene.add(mesh);
    state.grenades.push(g);
  }
  // plant / defuse + pickup dropped bomb
  playerPlantDefuse(dt);
  const bomb = state.bomb;
  if (bomb.state === 'dropped' && p.team === 'T' && p.alive && dist2(p.pos, bomb.pos) < 6) {
    bomb.state = 'carried'; bomb.carrierTeam = 'T';
    if (bombMesh) { scene.remove(bombMesh); bombMesh.userData.led && scene.remove(bombMesh.userData.led); bombMesh = null; }
  }
  // round timers
  if (state.phase === 'freeze') {
    state.roundSeconds -= dt;
    if (state.roundSeconds <= 0) { state.phase = 'live'; state.roundSeconds = ROUND_TIME; state.message = ''; }
  } else if (state.phase === 'live') {
    if (bomb.state === 'planted') {
      bomb.timer -= dt;
      if (bombMesh) bombMesh.userData.led.intensity = 2 + Math.sin(nowSec * 10) * 1.5;
      if (bomb.timer <= 0) endRound('T', 'THE BOMB DETONATED — T WIN');
    } else {
      state.roundSeconds -= dt;
      if (state.roundSeconds <= 0) {
        if (p.team === 'CT' || bomb.state !== 'carried') endRound('CT', 'TIME UP — CT WIN');
        else endRound('CT', 'TIME UP — CT WIN');
      }
    }
    // bots
    for (const b of allBots) {
      if (!b.alive) continue;
      const blind = nowSec < b.blindUntil;
      if (blind) { b.vel.set(0, 0, 0); continue; }
      const shot = b.update(dt, state);
      if (shot) botShoot(b, shot.def);
    }
    // bots plant/defuse (simple): T bot on site with bomb plants automatically
    if (bomb.state === 'carried' && bomb.carrierTeam === 'T') {
      const carrier = state.allFighters().find((f) => f.team === 'T' && f.alive);
      if (carrier && carrier !== player) {
        const onSite = dist2(carrier.pos, MAP.siteA) < 30 || dist2(carrier.pos, MAP.siteB) < 30;
        if (onSite && (carrier.pos.x > 14)) {
          bomb.state = 'planted';
          bomb.pos.set(carrier.pos.x, 0.3, carrier.pos.z);
          bomb.timer = BOMB_TIME;
          plantBombMesh();
          state.message = 'BOMB PLANTED';
        }
      }
    }
    // CT bots defuse
    if (bomb.state === 'planted' && teamAlive('CT') > 0 && teamAlive('T') === 0) {
      const ct = state.allFighters().find((f) => f.team === 'CT' && f.alive);
      if (ct && dist2(ct.pos, bomb.pos) < 25) {
        ct.botDefuse = (ct.botDefuse || 0) + dt;
        if (ct.botDefuse >= DEFUSE_TIME) { bomb.state = 'defused'; endRound('CT', 'BOMB DEFUSED — CT WIN'); }
      }
    }
    checkRoundEnd();
  }
  updateEffects(dt);
  // camera
  camera.position.set(p.pos.x, p.eyeHeight, p.pos.z);
  camera.rotation.set(0, 0, 0);
  camera.rotateY(p.yaw + p.recoilYaw);
  camera.rotateX(p.pitch + p.recoilPitch);
  if (nowSec < p.blindUntil) ui.blindEl.style.opacity = Math.min(1, (p.blindUntil - nowSec));
  else ui.blindEl.style.opacity = 0;
}

// ---- loop ------------------------------------------------------------
let last = performance.now() / 1000, acc = 0, hudT = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now() / 1000;
  let dt = now - last; last = now;
  dt = Math.min(dt, 0.1);
  acc += dt;
  while (acc >= FIXED) { simulate(FIXED, now); acc -= FIXED; }
  hudT += dt;
  if (hudT > 0.1) { hudT = 0; state.currentSpread = state.weapon.currentSpread(player.isMoving(), player.crouch); hud.update(dt, now); }
  renderer.render(scene, camera);
}
// kick input for buy-menu alias B
document.addEventListener('keydown', (e) => { if (e.code === 'KeyB') { buyOpen ? closeBuy() : renderBuy(); } });
frame();
