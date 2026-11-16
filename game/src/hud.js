// HUD: health, armor, ammo, money, round timer, score, buy menu, kill feed,
// crosshair that widens with spread, bomb status, minimap.
import { WEAPONS } from './weapon.js';

export class Hud {
  constructor(documentRoot, state) {
    this.root = documentRoot;
    this.state = state; // shared game state ref
    this.el = document.getElementById('hud');
    this.crosshair = document.getElementById('crosshair');
    this.feed = document.getElementById('killfeed');
    this.feedItems = [];
  }
  update(dt, now) {
    const s = this.state;
    const w = s.player.weaponKey ? WEAPONS[s.player.weaponKey] : null;
    document.getElementById('hp').textContent = s.player.health;
    document.getElementById('hpbar').style.width = Math.max(0, s.player.health) + '%';
    document.getElementById('ammo').textContent = s.weapon ? `${s.weapon.ammo} / ${s.weapon.reserve}` : '—';
    document.getElementById('wname').textContent = w ? w.name : '';
    document.getElementById('money').textContent = '$' + s.player.money;
    document.getElementById('timer').textContent = s.roundSeconds >= 0 ? fmt(s.roundSeconds) : '—';
    document.getElementById('score').textContent = `${s.scoreT} : ${s.scoreCT}`;
    document.getElementById('roundmsg').textContent = s.message || '';
    document.getElementById('roundmsg').style.opacity = s.message ? 1 : 0;
    const bomb = s.bomb;
    document.getElementById('bombline').textContent =
      bomb.state === 'carried' && bomb.carrierTeam === s.player.team ? 'BOMB — press E on a site to plant'
      : bomb.state === 'planted' ? 'BOMB PLANTED — DEFUSE IT (hold E)'
      : bomb.state === 'dropped' ? 'BOMB DROPPED — pick it up (E)'
      : s.player.team === 'CT' ? 'DEFEND THE SITES' : 'PLANT THE BOMB';
    // crosshair bloom
    const spread = s.currentSpread ?? 0.004;
    const gap = 4 + spread * 2500;
    const ch = this.crosshair.children;
    ch[0].style.transform = `translate(-50%, ${-gap - 8}px)`;
    ch[1].style.transform = `translate(-50%, ${gap}px)`;
    ch[2].style.transform = `translate(${-gap - 8}px, -50%)`;
    ch[3].style.transform = `translate(${gap}px, -50%)`;
    // kill feed decay
    this.feedItems = this.feedItems.filter((it) => now - it.t < 4);
    this.feed.innerHTML = this.feedItems.map((it) => `<div>${it.txt}</div>`).join('');
  }
  kill(attacker, victim, head) {
    this.feedItems.push({ txt: `${attacker} ⟶ ${head ? '⌖ ' : ''}${victim}`, t: performance.now() / 1000 });
    if (this.feedItems.length > 5) this.feedItems.shift();
  }
}

function fmt(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function buildHudDom() {
  const style = document.createElement('style');
  style.textContent = `
    #hud { position:fixed; inset:0; pointer-events:none; font-family:'Segoe UI',system-ui,sans-serif; color:#e7e3d8; text-shadow:0 1px 2px #000; z-index:5; }
    .panel { position:absolute; background:rgba(10,12,16,.55); border:1px solid rgba(232,163,61,.35); border-radius:6px; padding:8px 12px; }
    #topleft { top:14px; left:14px; font-size:22px; font-weight:700; }
    #hpbar { height:4px; background:#e8a33d; margin-top:4px; border-radius:2px; }
    #hpwrap { width:180px; }
    #topleft2 { top:14px; left:210px; font-size:15px; color:#2dd4bf; }
    #topcenter { top:14px; left:50%; transform:translateX(-50%); text-align:center; }
    #timer { font-size:24px; font-weight:700; letter-spacing:2px; }
    #score { font-size:15px; color:#e8a33d; }
    #roundmsg { font-size:17px; color:#ffd873; margin-top:6px; transition:opacity .3s; font-weight:600; }
    #bombline { font-size:13px; color:#9fb3c8; margin-top:2px; }
    #bottomright { bottom:14px; right:14px; text-align:right; }
    #ammo { font-size:26px; font-weight:700; }
    #wname { font-size:12px; color:#9fb3c8; }
    #bottomleft { bottom:14px; left:14px; font-size:20px; color:#7ee787; font-weight:700; }
    #killfeed { position:absolute; top:14px; right:14px; font-size:13px; text-align:right; }
    #killfeed div { background:rgba(10,12,16,.5); padding:2px 8px; margin-bottom:3px; border-radius:4px; }
    #crosshair { position:fixed; left:50%; top:50%; width:0; height:0; z-index:6; }
    #crosshair div { position:absolute; width:2px; height:10px; background:#e7e3d8; left:0; top:0; box-shadow:0 0 2px #000; }
    #buy { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); background:rgba(8,10,14,.92); border:1px solid #e8a33d; border-radius:10px; padding:20px 26px; color:#e7e3d8; font-family:system-ui; display:none; z-index:10; min-width:320px; }
    #buy h3 { margin:0 0 10px; color:#e8a33d; letter-spacing:1px; }
    #buy .row { display:flex; justify-content:space-between; padding:6px 8px; margin:2px 0; border-radius:4px; font-size:15px; }
    #buy .row.afford:hover { background:rgba(232,163,61,.18); }
    #buy .row.poor { color:#5a6472; }
    #buy .hint { font-size:11px; color:#5a6472; margin-top:10px; }
    #blind { position:fixed; inset:0; background:#fff; opacity:0; pointer-events:none; z-index:20; }
    #hitmark { position:fixed; left:50%; top:50%; transform:translate(-50%,-50%) rotate(45deg); width:18px; height:18px; z-index:6; opacity:0; }
    #hitmark div { position:absolute; background:#ff5a5a; }
    #dmgflash { position:fixed; inset:0; background:radial-gradient(ellipse at center, transparent 40%, rgba(200,30,30,.55)); opacity:0; pointer-events:none; z-index:15; transition:opacity .25s; }
  `;
  document.head.appendChild(style);
  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div class="panel" id="topleft"><span id="hp">100</span><div id="hpbar" style="width:100%"></div></div>
    <div class="panel" id="topleft2">$<span id="money">800</span></div>
    <div class="panel" id="topcenter"><div id="timer">1:55</div><div id="score">0 : 0</div><div id="roundmsg"></div><div id="bombline"></div></div>
    <div class="panel" id="bottomright"><div id="ammo">—</div><div id="wname"></div></div>
    <div class="panel" id="bottomleft">⚡ <span id="kcount">0</span> K</div>
    <div id="killfeed"></div>`;
  document.body.appendChild(hud);
  const ch = document.createElement('div');
  ch.id = 'crosshair';
  ch.innerHTML = '<div></div><div></div><div style="width:10px;height:2px"></div><div style="width:10px;height:2px"></div>';
  document.body.appendChild(ch);
  const hitm = document.createElement('div');
  hitm.id = 'hitmark';
  hitm.innerHTML = '<div style="left:0;top:8px;width:18px;height:2px"></div><div style="left:8px;top:0;width:2px;height:18px"></div>';
  document.body.appendChild(hitm);
  const dmg = document.createElement('div');
  dmg.id = 'dmgflash';
  document.body.appendChild(dmg);
  const blind = document.createElement('div');
  blind.id = 'blind';
  document.body.appendChild(blind);
  const buy = document.createElement('div');
  buy.id = 'buy';
  document.body.appendChild(buy);
  return { buyEl: buy, blindEl: blind, hitmarkEl: hitm, dmgEl: dmg };
}
