[![make.fun - threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/sirfitoo10/volt-protocol/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/sirfitoo10/volt-protocol/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
# VOLT PROTOCOL

A round-based tactical FPS on three.js 0.187.0 — single-player against bots,
built for the make.fun threejs-fps-01 bounty.

- Two teams (T vs CT), 4 bots per side, best-of rounds
- Bomb sites A/B: plant as T, defuse as CT (hold E)
- Buy menu (B) — sidearm, SMG, rifle, breacher, sniper, flashbang
- Headshot multipliers, recoil, movement spread, crouch accuracy
- Bots follow routes, hold positions, strafe, and react to what they see

## Play

```
node serve.ts        # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome. WASD to move, mouse to aim,
click to fire, R reload, B buy menu, E plant/defuse/pick up, G flashbang,
Ctrl crouch.

## Entry

`node main.ts` copies `game/` + `screenshots/` to `/output` (or
`MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`.

License: MIT.
