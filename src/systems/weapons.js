export function createWeaponSystem(ctx) {
  const { GameState, CFG, flashBuff, drawSprite, drawSpriteMatrix, scaleFor, formatMoney, spawnGlobalPopup, spawnShockwave, spawnBurst, spawnPoof, rand, randInt, clamp, spawnPopup } = ctx;

// -----------------------------------------------------------------------------
// 16. WEAPON SYSTEM
// -----------------------------------------------------------------------------

const WEAPON_SLOTS = ['nuke', 'drone', 'popup', 'laser', 'manure', 'flame'];

const WEAPON_LABELS = {
  nuke:   { name: 'NUKE',    sprite: 'icon_nuke',   key: '1' },
  drone:  { name: 'DRONE',   sprite: 'icon_drone',  key: '2' },
  popup:  { name: 'BLOCKER', sprite: 'icon_book',   key: '3' },
  laser:  { name: 'LASER',   sprite: 'icon_laser',  key: '4' },
  manure: { name: 'MANURE',  sprite: 'icon_manure', key: '5' },
  flame:  { name: 'FLAME',   sprite: 'icon_flame',  key: '6' },
};

function getWeaponButtonBox(idx) {
  const x = 10 + idx * 150;
  const y = CFG.weaponBarY + 14;
  return { x, y, w: 140, h: 96 };
}

function drawWeaponBar(ctx) {
  // background
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, CFG.weaponBarY, CFG.canvas.w, CFG.canvas.h - CFG.weaponBarY);
  ctx.strokeStyle = '#222';
  ctx.strokeRect(0, CFG.weaponBarY, CFG.canvas.w, CFG.canvas.h - CFG.weaponBarY);

  // weapon buttons
  for (let i = 0; i < WEAPON_SLOTS.length; i++) {
    const key = WEAPON_SLOTS[i];
    const box = getWeaponButtonBox(i);
    const state = GameState.weapons[key];
    const cfg = CFG.weapon[key];
    const unlocked = state.unlocked;
    const selected = GameState.weapons.selected === key;

    ctx.fillStyle = selected ? '#2a3040' : (unlocked ? '#151820' : '#0a0b0d');
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = selected ? '#66ddff' : (unlocked ? '#444' : '#222');
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.lineWidth = 1;

    const label = WEAPON_LABELS[key] || { name: key.toUpperCase(), sprite: 'icon_book', key: '?' };

    // icon
    drawSprite(ctx, label.sprite, box.x + 8, box.y + 8, scaleFor(label.sprite, 32));

    // name
    ctx.fillStyle = unlocked ? '#eeeeee' : '#555';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label.name, box.x + 46, box.y + 20);
    // hotkey
    ctx.fillStyle = '#666';
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText('[' + label.key + ']', box.x + 46, box.y + 34);

    if (!unlocked) {
      ctx.fillStyle = '#ff6666';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillText('LOCKED', box.x + 46, box.y + 52);
      continue;
    }

    // cost / status line
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px "Courier New", monospace';
    if (key === 'drone') {
      ctx.fillText('$' + CFG.weapon.drone.costPerSec + '/s  r:' + CFG.weapon.drone.attackRadius + '  ch:' + state.chargesLeft, box.x + 46, box.y + 52);
      if (state.active) {
        ctx.fillStyle = '#66ff66';
        ctx.fillText('ACTIVE', box.x + 46, box.y + 66);
      } else {
        ctx.fillStyle = '#888';
        ctx.fillText('LOCAL AREA', box.x + 46, box.y + 66);
      }
    } else if (key === 'popup') {
      ctx.fillText('$' + CFG.weapon.popup.costPerSec + '/s  -75% popups', box.x + 46, box.y + 52);
      ctx.fillStyle = state.active ? '#66ff66' : '#888';
      ctx.fillText(state.active ? 'FILTERING' : 'OFFLINE', box.x + 46, box.y + 66);
    } else if (key === 'nuke') {
      if (!state.padPlaced) {
        ctx.fillStyle = '#ffaa00';
        ctx.fillText(state.padPending ? 'PLACE PAD' : 'NEEDS PAD', box.x + 46, box.y + 52);
      } else {
        ctx.fillText(formatMoney(cfg.cost) + ' / strike', box.x + 46, box.y + 52);
      }
    } else if (key === 'laser') {
      ctx.fillText(formatMoney(cfg.cost) + ' / strike', box.x + 46, box.y + 52);
    } else {
      ctx.fillText('$' + cfg.cost, box.x + 46, box.y + 52);
    }

    // cooldown bar
    const now = GameState.gameTime;
    const cdEnd = state.lastUsed + cfg.cooldownMs;
    if (now < cdEnd) {
      const pct = Math.max(0, Math.min(1, (cdEnd - now) / cfg.cooldownMs));
      ctx.fillStyle = '#222';
      ctx.fillRect(box.x + 8, box.y + box.h - 14, box.w - 16, 6);
      ctx.fillStyle = '#ff9933';
      ctx.fillRect(box.x + 8, box.y + box.h - 14, (box.w - 16) * pct, 6);
    } else {
      ctx.fillStyle = '#224422';
      ctx.fillRect(box.x + 8, box.y + box.h - 14, box.w - 16, 6);
      ctx.fillStyle = '#66ff66';
      ctx.fillRect(box.x + 8, box.y + box.h - 14, box.w - 16, 2);
    }
  }

  // selected weapon hint
  if (GameState.weapons.selected) {
    ctx.fillStyle = '#66ddff';
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SELECTED: ' + ((WEAPON_LABELS[GameState.weapons.selected] && WEAPON_LABELS[GameState.weapons.selected].name) || GameState.weapons.selected.toUpperCase()) + '   (ESC to cancel)',
                 CFG.canvas.w - 12, CFG.weaponBarY + 20);
    ctx.textAlign = 'left';
  }
}

function handleWeaponBarClick(sx, sy) {
  if (sy < CFG.weaponBarY) return false;
  for (let i = 0; i < WEAPON_SLOTS.length; i++) {
    const box = getWeaponButtonBox(i);
    if (sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) {
      selectWeapon(WEAPON_SLOTS[i]);
      return true;
    }
  }
  return true; // consumed even if no button matched (we're inside the panel)
}

function selectWeapon(key) {
  const state = GameState.weapons[key];
  if (!state.unlocked) { flashBuff('Not unlocked'); return; }
  if (key === 'drone') {
    toggleDrone();
    return;
  }
  if (key === 'popup') {
    togglePopupBlocker();
    return;
  }
  if (GameState.weapons.selected === key) {
    GameState.weapons.selected = null;
  } else {
    GameState.weapons.selected = key;
  }
}

function togglePopupBlocker() {
  const p = GameState.weapons.popup;
  const now = GameState.gameTime;
  if (!p.active) {
    if (now < p.lastToggleOff + CFG.weapon.popup.cooldownMs) { flashBuff('Blocker cooldown'); return; }
    p.active = true;
    p.costAccum = 0;
    flashBuff('Popup blocker engaged');
  } else {
    p.active = false;
    p.lastToggleOff = now;
    p.costAccum = 0;
    flashBuff('Popup blocker offline');
  }
}

function toggleDrone() {
  const d = GameState.weapons.drone;
  const now = GameState.gameTime;
  if (!d.active) {
    if (d.chargesLeft <= 0) { flashBuff('Subscription expired'); return; }
    if (now < d.lastToggleOff + CFG.weapon.drone.cooldownMs) { flashBuff('Drone cooldown'); return; }
    d.active = true;
    d.chargesLeft--;
    d.killTimer = 0;
    d.costAccum = 0;
    d.beamFlash = 0;
    d.beamTargetX = d.x;
    d.beamTargetY = d.y;
    const living = GameState.plants.filter(Boolean);
    if (living.length) {
      const plant = living[Math.floor(Math.random() * living.length)];
      d.x = plant.getScreenX();
      d.y = Math.max(CFG.farmTop + 40, plant.getScreenYForSegment(Math.max(0, plant.segments.length - 1)) - 70);
    } else {
      d.x = CFG.farmRight * 0.35;
      d.y = CFG.farmTop + 120;
    }
    d.targetX = d.x;
    d.targetY = d.y;
    d.patrolTimer = 0;
    d.currentTargetId = null;
    flashBuff('Drone online');
    spawnGlobalPopup('AI PESTICIDE DRONE ACTIVE', '#66ddff');
  } else {
    d.active = false;
    d.lastToggleOff = now;
    d.currentTargetId = null;
    flashBuff('Drone offline');
  }
}

function applyWeapon(key, x, y) {
  const now = GameState.gameTime;
  const cfg = CFG.weapon[key];
  const state = GameState.weapons[key];
  if (!state.unlocked) return false;
  if (now < state.lastUsed + cfg.cooldownMs) { flashBuff('Cooldown'); return false; }

  switch (key) {
    case 'nuke':
      if (!state.padPlaced) { flashBuff('No launch pad'); return false; }
      if (GameState.cash < cfg.cost) { flashBuff('Need ' + formatMoney(cfg.cost)); return false; }
      GameState.cash -= cfg.cost;
      state.lastUsed = now;
      detonateNuke(x, y);
      GameState.stats.weaponsFired++;
      break;
    case 'laser':
      if (GameState.cash < cfg.cost) { flashBuff('Need ' + formatMoney(cfg.cost)); return false; }
      GameState.cash -= cfg.cost;
      state.lastUsed = now;
      fireOrbitalLaser(x, y);
      GameState.stats.weaponsFired++;
      break;
    case 'manure':
      if (GameState.cash < cfg.cost) { flashBuff('Insufficient funds'); return false; }
      GameState.cash -= cfg.cost;
      state.lastUsed = now;
      fireManure(x, y);
      GameState.stats.weaponsFired++;
      break;
    case 'flame':
      if (GameState.cash < cfg.cost) { flashBuff('Insufficient funds'); return false; }
      GameState.cash -= cfg.cost;
      state.lastUsed = now;
      useFlame(x, y);
      GameState.stats.weaponsFired++;
      break;
  }
  return true;
}

function detonateNuke(x, y) {
  const r = CFG.weapon.nuke.radius;
  spawnShockwave(x, y, r * 1.2, ['#6b2f9e', '#ffffff', '#ffaa00', '#ff4444']);
  spawnBurst(x, y, 140, ['#6b2f9e', '#ffaa00', '#ff4444', '#ffffff']);
  GameState.nukeFX = {
    x, y,
    timeLeft: 1450,
    maxTime: 1450,
    balls: [
      { ox: 0, oy: 0, r: r * 0.95, c: 'rgba(255,255,255,0.28)' },
      { ox: -r * 0.22, oy: -r * 0.12, r: r * 0.70, c: 'rgba(255,68,68,0.25)' },
      { ox: r * 0.24, oy: -r * 0.15, r: r * 0.68, c: 'rgba(255,170,0,0.22)' },
      { ox: -r * 0.18, oy: r * 0.18, r: r * 0.62, c: 'rgba(107,47,158,0.28)' },
      { ox: r * 0.18, oy: r * 0.20, r: r * 0.58, c: 'rgba(255,255,255,0.20)' },
      { ox: 0, oy: -r * 0.28, r: r * 0.52, c: 'rgba(255,221,0,0.18)' }
    ]
  };
  for (const p of GameState.pests) {
    const c = p.center();
    const dist = Math.hypot(c.x - x, c.y - y);
    if (dist < r * 1.02) {
      p.dead = true;
      GameState.stats.pestsKilled++;
    } else if (dist < r * 1.95) {
      p.radiated = true;
      p.hitsRemaining += 2;
    }
  }
  for (let i = 0; i < GameState.plants.length; i++) {
    const plant = GameState.plants[i];
    if (!plant) continue;
    const px = plant.getScreenX();
    const py = plant.getScreenYForSegment(0);
    const dist = Math.hypot(px - x, py - y);
    if (dist < r * 0.95) {
      plant.collapseAt(0, 'blast');
    } else if (dist < r * 1.95) {
      plant.radiated = true;
      for (const seg of plant.segments) {
        for (const side of ['L','R']) {
          if (seg.fruits[side]) seg.fruits[side].radiated = true;
        }
      }
      if (plant.segments[0]) plant.damageSegment(0, 1);
    }
  }
  GameState.glitchTimer = 900;
  spawnGlobalPopup('NUCLEAR STRIKE AUTHORISED', '#6b2f9e');
  spawnGlobalPopup('NUCLEAR FALLOUT DETECTED', '#ff66ff');
  GameState.announcementOverlay = {
    lines: [
      'ALERT',
      '',
      'NUCLEAR FALLOUT HAS BEEN DETECTED.',
      'Nearby plants and pests are now irradiated.',
      'Shelf life may be reduced.',
      'Do not consume anything with opinions.'
    ],
    age: 0,
    duration: 2600
  };
}

function fireOrbitalLaser(x, y) {
  const beamHalfWidth = 5;
  spawnShockwave(x, y, CFG.weapon.laser.radius * 2.6, ['#66ddff', '#ffffff', '#ffffff', '#ff4444']);
  GameState.laserFlashTimer = 1500;
  GameState.glitchTimer = Math.max(GameState.glitchTimer, 450);
  // dramatic vertical beam particles from sky to ground
  for (let t = 0; t < 320; t++) {
    GameState.particles.push({
      x: x + rand(-18, 18),
      y: rand(CFG.farmTop, CFG.groundY),
      vx: rand(-0.08, 0.08), vy: rand(1.8, 6.5),
      size: randInt(3, 9), colour: Math.random() < 0.7 ? '#ffffff' : (Math.random() < 0.9 ? '#66ddff' : '#ff4444'),
      life: 850, maxLife: 850
    });
  }
  // kill pests in a narrow line from the top of the screen to the ground
  for (const p of GameState.pests) {
    const c = p.center();
    if (Math.abs(c.x - x) <= beamHalfWidth && c.y >= CFG.farmTop && c.y <= CFG.groundY) {
      p.dead = true;
      GameState.stats.pestsKilled++;
    }
  }
  // destroy plant sections and tomatoes intersecting the beam
  for (const plant of GameState.plants) {
    if (!plant) continue;
    const px = plant.getScreenX();
    for (let i = plant.segments.length - 1; i >= 0; i--) {
      const seg = plant.segments[i];
      const sy = plant.getScreenYForSegment(i);
      // stem/core hit
      const stemLeft = px - 14;
      const stemRight = px + 14;
      if (x + beamHalfWidth >= stemLeft && x - beamHalfWidth <= stemRight) {
        plant.collapseAt(i, 'blast');
        break;
      }
      // tomato hits along the line
      for (const side of ['L','R']) {
        const t = seg.fruits[side];
        if (!t) continue;
        const size = CFG.tomato.sizes[t.sizeTier || 'medium'] || CFG.tomato.renderSize;
        const tx = px + (side === 'L' ? -size : 0);
        const left = tx, right = tx + size;
        if (x + beamHalfWidth >= left && x - beamHalfWidth <= right) {
          seg.fruits[side] = null;
          spawnBurst(tx + size/2, sy + size/2, 10, ['#66ddff','#ffffff','#ff4444']);
        }
      }
    }
  }
  spawnGlobalPopup('ORBITAL LANCE', '#66ddff');
}

function fireManure(x, y) {
  spawnShockwave(x, y, CFG.weapon.manure.radius, ['#8b5a2b', '#553311', '#cc8822']);
  spawnBurst(x, y, 20, ['#8b5a2b', '#553311', '#cc8822']);
  for (const p of GameState.pests) {
    const c = p.center();
    if (Math.hypot(c.x - x, c.y - y) < CFG.weapon.manure.radius) {
      p.slowTime = CFG.weapon.manure.slowMs;
      p.hit();
    }
  }
  // fertilise nearby plants slightly
  for (const plant of GameState.plants) {
    if (!plant) continue;
    const px = plant.getScreenX();
    const py = plant.getScreenYForSegment(0);
    if (Math.hypot(px - x, py - y) < CFG.weapon.manure.radius + 30) {
      for (const seg of plant.segments) {
        for (const side of ['L','R']) {
          if (seg.fruits[side]) seg.fruits[side].manureBoost = 0.6;
        }
      }
    }
  }
  spawnPopup(x, y - 10, 'SPLAT', '#8b5a2b');
}

function useFlame(x, y) {
  // find nearest plant segment
  let best = null, bestDist = Infinity;
  for (const plant of GameState.plants) {
    if (!plant) continue;
    for (let i = 0; i < plant.segments.length; i++) {
      const sx = plant.getScreenX(), sy = plant.getScreenYForSegment(i);
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestDist) { bestDist = d; best = { plant, i }; }
    }
  }
  spawnBurst(x, y, 24, ['#ff6600', '#ffaa00', '#ffff00']);
  if (best && bestDist < 80) {
    best.plant.collapseAt(best.i, 'burn');
  } else {
    flashBuff('Missed');
  }
}

function updatePopupBlocker(dt) {
  const p = GameState.weapons.popup;
  if (!p.unlocked || !p.active) return;
  p.costAccum += dt * CFG.weapon.popup.costPerSec / 1000;
  while (p.costAccum >= 1) {
    GameState.cash -= 1;
    p.costAccum -= 1;
  }
  if (GameState.cash < 0 && p.active && Math.random() < 0.002) flashBuff('Blocker is expensive');
}

function updateDroneWeapon(dt) {
  const d = GameState.weapons.drone;
  if (d.beamFlash > 0) d.beamFlash = Math.max(0, d.beamFlash - dt);
  if (!d.unlocked || !d.active) return;

  d.costAccum += dt * CFG.weapon.drone.costPerSec / 1000;
  while (d.costAccum >= 1) {
    GameState.cash -= 1;
    d.costAccum -= 1;
  }

  const alive = GameState.pests.filter(p => !p.dead && p.type !== 'locust');
  let target = null;
  let bestDist = Infinity;
  for (const p of alive) {
    const c = p.center();
    const dist = Math.hypot(c.x - d.x, c.y - d.y);
    if (dist < bestDist) {
      bestDist = dist;
      target = p;
    }
  }

  d.patrolTimer += dt;
  if (target) {
    const c = target.center();
    const desired = Math.min(bestDist, CFG.weapon.drone.attackRadius * 0.55);
    const ang = Math.atan2(c.y - d.y, c.x - d.x);
    if (bestDist > CFG.weapon.drone.attackRadius * 0.45) {
      d.targetX = c.x - Math.cos(ang) * desired;
      d.targetY = c.y - Math.sin(ang) * desired - 24;
    } else {
      d.targetX = d.x + Math.cos(GameState.gameTime / 600) * 18;
      d.targetY = d.y + Math.sin(GameState.gameTime / 500) * 14;
    }
  } else if (d.patrolTimer >= CFG.weapon.drone.patrolRetargetMs) {
    d.patrolTimer = 0;
    const livingPlants = GameState.plants.filter(Boolean);
    if (livingPlants.length) {
      const plant = livingPlants[Math.floor(Math.random() * livingPlants.length)];
      d.targetX = plant.getScreenX() + rand(-50, 50);
      d.targetY = Math.max(CFG.farmTop + 60, plant.getScreenYForSegment(Math.max(0, plant.segments.length - 1)) - rand(40, 90));
    } else {
      d.targetX = rand(80, CFG.farmRight - 80);
      d.targetY = rand(CFG.farmTop + 60, CFG.groundY - 130);
    }
  }

  d.targetX = clamp(d.targetX, 30, CFG.farmRight - 30);
  d.targetY = clamp(d.targetY, CFG.farmTop + 30, CFG.groundY - 110);
  const dx = d.targetX - d.x;
  const dy = d.targetY - d.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    const step = CFG.weapon.drone.moveSpeed * dt;
    d.x += dx / dist * Math.min(step, dist);
    d.y += dy / dist * Math.min(step, dist);
  }

  d.killTimer += dt;
  if (d.killTimer >= CFG.weapon.drone.killIntervalMs) {
    d.killTimer = 0;
    const inRange = alive.filter(p => Math.hypot(p.center().x - d.x, p.center().y - d.y) <= CFG.weapon.drone.attackRadius);
    if (inRange.length > 0) {
      const victim = inRange.sort((a, b) => Math.hypot(a.center().x - d.x, a.center().y - d.y) - Math.hypot(b.center().x - d.x, b.center().y - d.y))[0];
      const vc = victim.center();
      d.beamTargetX = vc.x;
      d.beamTargetY = vc.y;
      victim.hit();
      d.beamFlash = 140;
      spawnBurst(victim.x + victim.size/2, victim.y + victim.size/2, 6, ['#66ddff', '#ffffff']);
      spawnPopup(victim.x + victim.size/2, victim.y - 6, 'ZAP', '#66ddff');
    }
  }
}



  return { WEAPON_SLOTS, WEAPON_LABELS, getWeaponButtonBox, drawWeaponBar, handleWeaponBarClick, selectWeapon, togglePopupBlocker, toggleDrone, applyWeapon, detonateNuke, fireOrbitalLaser, fireManure, useFlame, updatePopupBlocker, updateDroneWeapon };
}
