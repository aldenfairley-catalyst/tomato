export function createRenderUI(ctx) {
  const { GameState, CFG, PHASES, drawSprite, drawSpriteMatrix, scaleFor, formatMoney, drawParticles, drawTicker, drawShopPanel, drawWeaponBar, drawPortfolioHint, getCurrentPhase, getDimensionSnapshot, WEAPON_LABELS, getSlotBox, slotCenterX, hasDuckCurse, adCloseBox, rand, clamp, ownedShares } = ctx;

// -----------------------------------------------------------------------------
// 21. RENDER
// -----------------------------------------------------------------------------

function drawHUD(ctx) {
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.newsBarY);

  // Cash
  const cash = GameState.cash;
  const negative = cash < 0;
  const severe = cash < -1750;
  const warning = cash < -1000;
  let colour = '#66ff66';
  if (negative) {
    const pulse = Math.sin(GameState.gameTime / 180) * 0.5 + 0.5;
    if (severe) colour = pulse > 0.5 ? '#ff2222' : '#880000';
    else if (warning) colour = pulse > 0.5 ? '#ff4444' : '#661111';
    else colour = '#ff8866';
  }
  ctx.fillStyle = colour;
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(formatMoney(cash), 16, 27);

  // Cash floor indicator
  if (negative) {
    ctx.fillStyle = '#aa4444';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('floor: ' + formatMoney(CFG.cashFloor), 160, 27);
  }

  // Timer
  const remaining = Math.max(0, CFG.maxDurationMs - GameState.gameTime);
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const timeStr = m + ':' + (s < 10 ? '0' : '') + s;
  ctx.fillStyle = GameState.taxPocalypseTriggered ? '#ff4444' : '#cccccc';
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('T- ' + timeStr, CFG.canvas.w/2, 27);

  // Seeds
  ctx.fillStyle = '#aaaaaa';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.fillText('SEEDS: ' + GameState.seeds.basic + '  GMO: ' + GameState.seeds.engineered,
               CFG.shopX - 20, 27);

  ctx.textAlign = 'left';
}

function drawGoldenTicket(ctx) {
  const owned = ownedShares ? ownedShares() : [];
  if (!owned.length) return;
  const x = 10;
  const y = CFG.newsBarY + 4;
  // glow
  ctx.save();
  ctx.globalAlpha = 0.2 + 0.1 * Math.sin(GameState.gameTime / 250);
  ctx.fillStyle = '#ffcc66';
  ctx.fillRect(x - 2, y - 2, 36, 24);
  ctx.restore();
  // ticket bg
  ctx.fillStyle = '#1a1508';
  ctx.fillRect(x, y, 32, 20);
  ctx.strokeStyle = '#ffcc66';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 32, 20);
  drawSprite(ctx, 'golden_ticket', x + 8, y + 2, 1);
  // label
  ctx.fillStyle = '#ffdd66';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SHARE', x + 36, y + 14);
}

function drawPlant(ctx, plant) {
  const x = plant.getScreenX();
  for (let i = 0; i < plant.segments.length; i++) {
    const seg = plant.segments[i];
    const y = plant.getScreenYForSegment(i);
    // stem colour variation for disease or damage
    const diseased = seg.diseased;
    const healthRatio = seg.health / seg.maxHealth;
    const tintOpts = {};
    if (diseased) tintOpts.tint = { 4: 21, 16: 21, 2: 21 }; // green → rust
    else if (plant.engineered) tintOpts.tint = { 2: 16, 9: 8 };
    if (healthRatio < 0.5) tintOpts.alpha = 0.7;

    drawSprite(ctx, 'stem', x - 12, y, 2, tintOpts);

    // fruits
    for (const side of ['L','R']) {
      const t = seg.fruits[side];
      if (!t) continue;
      const fruitSize = t.getRenderSize();
      const fx = x + (side === 'L' ? -(fruitSize - 8) : 10);
      const fy = y - Math.max(6, fruitSize * 0.2);
      const opts = {};
      if (plant.engineered && !opts.tint) { opts.tint = { 2: 16, 9: 8, 4: 8 }; }

      if (plant.radiated || t.radiated) {
        // radiated glow: pulse colour tint
        const pulse = Math.sin(GameState.gameTime / 150) > 0;
        if (pulse) opts.tint = { 13: 20, 12: 20 };
      }

      if (t.state === 'rotten') {
        const pulse = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(GameState.gameTime / 180));
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ff2244';
        ctx.beginPath();
        ctx.arc(fx + fruitSize / 2, fy + fruitSize / 2, fruitSize * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#ffdd00';
        ctx.lineWidth = 2;
        ctx.strokeRect(fx - 3, fy - 3, fruitSize + 6, fruitSize + 6);
        ctx.restore();
      }

      drawSprite(ctx, t.getSprite(), fx, fy, scaleFor(t.getSprite(), fruitSize), opts);

      if (t.state === 'rotten') {
        const blink = Math.floor(GameState.gameTime / 220) % 2 === 0;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillStyle = blink ? '#ffdd00' : '#ff4444';
        ctx.fillText('ROT', fx + fruitSize / 2, fy - 8);
        ctx.restore();
      }
    }

    // disease overlay tinge
    if (diseased) {
      ctx.fillStyle = 'rgba(180, 90, 30, 0.15)';
      ctx.fillRect(x - 18, y - 4, 36, CFG.plant.segmentHeight + 4);
    }
  }

  // Dramatic irradiated glow (from patch layer)
  if (plant.radiated) {
    for (let i = 0; i < plant.segments.length; i++) {
      const x = plant.getScreenX();
      const y = plant.getScreenYForSegment(i) + CFG.plant.segmentHeight * 0.55;
      const pulse = 0.22 + 0.12 * (0.5 + 0.5 * Math.sin(GameState.gameTime / 120 + i));
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#b64dff';
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#88ff44';
      ctx.globalAlpha = pulse * 0.7;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawDrone(ctx) {
  const d = GameState.weapons.drone;
  if (!d.unlocked || (!d.active && d.beamFlash <= 0)) return;

  if (d.active) {
    ctx.save();
    ctx.strokeStyle = 'rgba(102,221,255,0.28)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(d.x, d.y, CFG.weapon.drone.attackRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (d.beamFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, d.beamFlash / 140);
    ctx.strokeStyle = '#66ddff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.beamTargetX, d.beamTargetY);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.beamTargetX, d.beamTargetY);
    ctx.stroke();
    ctx.restore();
  }

  const bobY = Math.sin(GameState.gameTime / 180) * 4;
  drawSprite(ctx, 'icon_drone', d.x - 20, d.y - 20 + bobY, scaleFor('icon_drone', 40));
}

function drawHarvestDrone(ctx) {
  const hd = GameState.weapons.harvestDrone;
  if (!hd.unlocked || !hd.active) return;

  const bobY = Math.sin(GameState.gameTime / 220) * 3;
  const beingAttacked = !!hd.attackerPestId;

  // Attack warning pulse
  if (beingAttacked) {
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.12 * Math.sin(GameState.gameTime / 80);
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(hd.x, hd.y + bobY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Harvest beam flash
  if (hd.beamFlash > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(hd.beamFlash / 300, 0, 1) * 0.8;
    ctx.strokeStyle = '#ffcc44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hd.x, hd.y + bobY + 10);
    ctx.lineTo(hd.x, hd.y + bobY + 28);
    ctx.stroke();
    ctx.restore();
  }

  // Sprite
  drawSprite(ctx, 'icon_harvest_drone', hd.x - 20, hd.y - 20 + bobY, scaleFor('icon_harvest_drone', 40));

  // Health bar (only when damaged)
  if (hd.health < 1.2) {
    const bw = 36, bh = 4;
    const bx = hd.x - bw / 2;
    const by = hd.y - 27 + bobY;
    ctx.fillStyle = '#330000';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = hd.health > 0.6 ? '#ffcc44' : '#ff4444';
    ctx.fillRect(bx, by, bw * (hd.health / 1.2), bh);
    ctx.strokeStyle = '#ffffff44';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
  }
}

function getAssistantSpriteKey(state) {
  switch (state) {
    case 'noticing': return 'assistant_robot_noticing';
    case 'purchasing': return 'assistant_robot_purchasing';
    case 'apologising': return 'assistant_robot_apologising';
    case 'popup': return 'assistant_robot_popup';
    case 'worried': return 'assistant_robot_worried';
    default: return 'assistant_robot_idle';
  }
}

function drawPendingMutants(ctx) {
  if (!GameState.pendingMutants || !GameState.pendingMutants.length) return;
  for (const mutant of GameState.pendingMutants) {
    const plant = GameState.plants[mutant.plantSlot];
    if (!plant || mutant.segIndex >= plant.segments.length) continue;
    const detachT = 1 - mutant.timeLeft / mutant.maxTime;
    const pulse = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(GameState.gameTime / 110 + mutant.segIndex));
    const wobble = Math.sin(GameState.gameTime / 70 + mutant.segIndex * 0.9) * (1.2 + detachT * 3.5);
    const x = mutant.x + wobble;
    const y = mutant.y - detachT * 4;
    const anchorX = plant.getScreenX();
    const anchorY = plant.getScreenYForSegment(mutant.segIndex) + 10;

    ctx.save();
    ctx.strokeStyle = `rgba(140,255,68,${0.35 + detachT * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(x + 16, y + 20);
    ctx.stroke();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = detachT > 0.7 ? '#ff66aa' : '#8cff44';
    ctx.beginPath();
    ctx.arc(x + 16, y + 16, 18 + detachT * 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35 + detachT * 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 16, y + 16, 10 + detachT * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawSprite(ctx, 'tomato_mutant', x, y, scaleFor('tomato_mutant', 32));

    if (detachT > 0.55) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.25 * Math.sin(GameState.gameTime / 60);
      ctx.fillStyle = '#ffdd66';
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('UNSTABLE', x + 16, y - 6);
      ctx.restore();
      ctx.textAlign = 'left';
    }
  }
}

function drawSpeechBubble(ctx, x, y, maxWidth, text, tailX, tailY, state) {
  if (!text) return;
  const pad = 12;
  const lineHeight = 15;
  ctx.save();
  ctx.font = '13px "Courier New", monospace';
  const lines = wrapTextLines(ctx, text, maxWidth - pad * 2).slice(0, 4);
  const width = maxWidth;
  const height = pad * 2 + lines.length * lineHeight;
  const border = state === 'worried' ? '#ff9966' : '#8be7ff';
  const fill = state === 'worried' ? 'rgba(40,18,18,0.96)' : 'rgba(230,244,255,0.96)';
  const textColor = state === 'worried' ? '#ffe6d2' : '#13202b';

  ctx.fillStyle = fill;
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);

  ctx.beginPath();
  ctx.moveTo(Math.min(x + width - 30, Math.max(x + 24, tailX - 12)), y + height);
  ctx.lineTo(tailX - 6, tailY - 12);
  ctx.lineTo(Math.min(x + width - 10, Math.max(x + 44, tailX + 8)), y + height);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + pad, y + pad + 12 + i * lineHeight);
  }
  ctx.restore();
}

function drawAssistantCursor(ctx) {
  const fx = GameState.assistant && GameState.assistant.cursorFx;
  if (!fx || !fx.active) return;
  const pulse = 1 + 0.12 * Math.sin(GameState.gameTime / 90);
  drawSprite(ctx, 'ai_cursor_large', fx.x - 18, fx.y - 8, scaleFor('ai_cursor_large', 72) * pulse);

  if (fx.phase === 'clicking' || fx.phase === 'purchased') {
    ctx.save();
    ctx.strokeStyle = fx.phase === 'clicking' ? '#ffffff' : '#8be7ff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = fx.phase === 'clicking' ? 0.9 : 0.75;
    ctx.beginPath();
    ctx.arc(fx.targetX, fx.targetY, fx.phase === 'clicking' ? 18 : 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawAssistant(ctx) {
  const assistant = GameState.assistant;
  if (!assistant || !assistant.unlocked || !assistant.alive) return;

  const spriteKey = getAssistantSpriteKey(assistant.state);
  const bob = Math.sin(GameState.gameTime / (assistant.state === 'worried' ? 90 : 180)) * (assistant.state === 'worried' ? 5 : 3);
  const x = assistant.x;
  const y = assistant.y + bob;

  ctx.save();
  ctx.globalAlpha = 0.18 + (assistant.state === 'worried' ? 0.16 : 0.08) * (0.5 + 0.5 * Math.sin(GameState.gameTime / 120));
  ctx.fillStyle = assistant.state === 'worried' ? '#ff9966' : '#8be7ff';
  ctx.beginPath();
  ctx.arc(x + 64, y + 68, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawSprite(ctx, spriteKey, x, y, scaleFor(spriteKey, 128));

  ctx.save();
  ctx.fillStyle = 'rgba(9,14,18,0.88)';
  ctx.fillRect(x + 10, y + 112, 118, 16);
  ctx.strokeStyle = assistant.state === 'worried' ? '#ff9966' : '#8be7ff';
  ctx.strokeRect(x + 10, y + 112, 118, 16);
  ctx.fillStyle = '#e9f8ff';
  let labelSize = 10;
  const label = assistant.name || 'AI ASSISTANT';
  do {
    ctx.font = `bold ${labelSize}px "Courier New", monospace`;
    labelSize--;
  } while (labelSize >= 8 && ctx.measureText(label).width > 110);
  ctx.textAlign = 'center';
  ctx.fillText(label, x + 69, y + 123);
  ctx.restore();
  ctx.textAlign = 'left';

  if (assistant.speech && assistant.speech.timeLeft > 0) {
    const bubbleW = 238;
    const bubbleX = Math.max(16, Math.min(CFG.shopX - bubbleW - 12, x - 92));
    const bubbleY = Math.max(CFG.farmTop + 8, y - 64);
    drawSpeechBubble(ctx, bubbleX, bubbleY, bubbleW, assistant.speech.text, x + 52, y + 34, assistant.state);
  }
}

function drawBuffsRow(ctx) {
  const buffs = GameState.buffs;
  if (buffs.length === 0) return;
  const baseX = 16;
  const baseY = CFG.weaponBarY - 48;
  for (let i = 0; i < buffs.length; i++) {
    const b = buffs[i];
    const x = baseX + i * 120;
    const y = baseY;
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(x, y, 112, 36);
    ctx.strokeStyle = '#446699';
    ctx.strokeRect(x, y, 112, 36);
    drawSprite(ctx, b.sprite, x + 4, y + 4, scaleFor(b.sprite, 24));
    ctx.fillStyle = '#cceeff';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(b.name, x + 34, y + 16);
    // timer bar
    const pct = Math.max(0, b.timeLeft / b.maxTime);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 34, y + 22, 72, 5);
    ctx.fillStyle = '#66ddff';
    ctx.fillRect(x + 34, y + 22, 72 * pct, 5);
  }
}

function drawPhaseBanner(ctx) {
  const b = GameState.phaseBanner;
  const a = Math.min(1, b.age < 400 ? b.age / 400 : (b.duration - b.age) / 400);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 160, CFG.canvas.w, 70);
  ctx.strokeStyle = '#ffcc66';
  ctx.strokeRect(0, 160, CFG.canvas.w, 70);
  ctx.fillStyle = '#ffcc66';
  ctx.font = 'bold 32px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('>>  ' + b.name + '  <<', CFG.canvas.w/2, 205);
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawAd(ctx, a, idx) {
  const t = GameState.gameTime + a.flashOffset;
  const pulse = Math.sin(t / 120) * 0.5 + 0.5;
  const jiggleX = Math.sin(t / 90) * a.jiggle;
  const jiggleY = Math.cos(t / 110) * a.jiggle;
  const x = a.x + jiggleX;
  const y = a.y + jiggleY;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x + 6, y + 6, a.w, a.h);

  ctx.fillStyle = pulse > 0.5 ? a.palette.border : a.palette.fill;
  ctx.fillRect(x - 5, y - 5, a.w + 10, a.h + 10);
  ctx.fillStyle = a.palette.bg;
  ctx.fillRect(x, y, a.w, a.h);

  ctx.fillStyle = pulse > 0.55 ? a.palette.fill : a.palette.border;
  ctx.fillRect(x + 8, y + 8, a.w - 16, 28);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SPONSORED CONTENT', x + a.w / 2, y + 27);

  const close = adCloseBox(a);
  ctx.fillStyle = '#000';
  ctx.fillRect(close.x - 1, close.y - 1, close.w + 2, close.h + 2);
  drawSprite(ctx, 'close_x', close.x, close.y, 1, { tint: pulse > 0.5 ? { 7: 4 } : null });

  ctx.fillStyle = a.palette.accent;
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText(a.copy.title, x + a.w / 2, y + 64);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Courier New", monospace';
  const lines = a.copy.body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + a.w / 2, y + 100 + i * 22);
  }

  ctx.fillStyle = pulse > 0.4 ? '#ff4444' : '#ffee66';
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillText("CLICKING ELSEWHERE WON'T HELP", x + a.w / 2, y + a.h - 28);

  ctx.restore();
  ctx.textAlign = 'left';
}

function drawNukeFlash(ctx) {
  const fx = GameState.nukeFX;
  if (!fx) return;
  const t = 1 - fx.timeLeft / fx.maxTime;
  const strobe = Math.floor(GameState.gameTime / 80) % 2 === 0;
  ctx.save();
  ctx.fillStyle = strobe ? 'rgba(255,255,255,0.18)' : 'rgba(107,47,158,0.14)';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);
  for (let i = 0; i < fx.balls.length; i++) {
    const b = fx.balls[i];
    const pulse = 0.85 + 0.35 * Math.sin(GameState.gameTime / (90 + i * 20));
    ctx.beginPath();
    ctx.fillStyle = b.c;
    ctx.arc(fx.x + b.ox, fx.y + b.oy, Math.max(18, b.r * (0.55 + t * pulse)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAnnouncement(ctx) {
  const a = GameState.announcementOverlay;
  const alpha = Math.min(1, a.age < 400 ? a.age / 400 : (a.duration - a.age) / 400);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(20, 0, 0, 0.92)';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.textAlign = 'center';
  const cx = CFG.canvas.w/2;
  const cy = CFG.canvas.h/2 - a.lines.length * 14;
  for (let i = 0; i < a.lines.length; i++) {
    ctx.fillText(a.lines[i], cx, cy + i * 36);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}


function wrapTextLines(ctx, text, maxWidth) {
  const paras = String(text).split('\n');
  const lines = [];
  for (const para of paras) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawGagDialog(ctx) {
  const g = GameState.gagDialog;
  const alpha = Math.min(1, g.age < 180 ? g.age / 180 : (g.duration - g.age) / 240);
  const w = 620, h = 220;
  const x = CFG.farmRight / 2 - w / 2, y = CFG.farmTop + 96;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(8, 10, 18, 0.96)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffcc66';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#ffcc66';
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(g.title, x + w / 2, y + 34);
  ctx.fillStyle = '#f2e6c0';
  ctx.font = '16px "Courier New", monospace';
  const lines = wrapTextLines(ctx, g.body, w - 44);
  const maxLines = 8;
  const shown = lines.slice(0, maxLines);
  for (let i = 0; i < shown.length; i++) {
    ctx.fillText(shown[i], x + w / 2, y + 72 + i * 20);
  }
  if (lines.length > maxLines) {
    ctx.fillStyle = '#ff9999';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('[message truncated by legal department]', x + w / 2, y + h - 16);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawBuffFlash(ctx) {
  const f = GameState.buffFlash;
  const a = Math.min(1, f.age < 200 ? f.age / 200 : (1500 - f.age) / 300);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#66ddff';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(f.text, CFG.farmRight/2, CFG.farmTop + 200);
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawGlitch(ctx) {
  const intensity = Math.min(1, GameState.glitchTimer / 600);
  ctx.save();
  ctx.globalAlpha = intensity * 0.3;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#66ddff' : '#ff4444';
    const y = Math.random() * CFG.canvas.h;
    ctx.fillRect(0, y, CFG.canvas.w, rand(1, 4));
  }
  ctx.restore();
}


function drawLaserFlash(ctx) {
  const t = GameState.laserFlashTimer;
  if (t <= 0) return;
  const cycle = Math.floor((1200 - t) / 70);
  const pulse = cycle % 2 === 0 ? 1 : 0.45;
  const a = clamp(t / 1200, 0, 1);
  ctx.save();
  ctx.globalAlpha = a * 0.95 * pulse;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);
  ctx.globalAlpha = a * 0.45;
  ctx.fillStyle = cycle % 3 === 0 ? '#66ddff' : '#ff4444';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);
  ctx.globalAlpha = a * 0.35;
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#66ddff';
    const y = (i / 10) * CFG.canvas.h + Math.sin((GameState.gameTime + i * 40) / 60) * 8;
    ctx.fillRect(0, y, CFG.canvas.w, 18);
  }
  ctx.restore();
}

function drawCursorTarget(ctx) {
  if (!GameState.weapons.selected) return;
  if (GameState.weapons.selected === 'drone') return;
  const x = GameState.mouseX, y = GameState.mouseY;
  if (y < CFG.farmTop || y > CFG.weaponBarY) return;
  if (x > CFG.shopX) return;
  const key = GameState.weapons.selected;
  const r = key === 'nuke' ? CFG.weapon.nuke.radius :
            key === 'laser' ? CFG.weapon.laser.radius :
            key === 'manure' ? CFG.weapon.manure.radius :
            key === 'flame' ? CFG.weapon.flame.radius : 30;
  ctx.save();
  ctx.strokeStyle = key === 'nuke' ? '#6b2f9e' :
                    key === 'laser' ? '#66ddff' :
                    key === 'manure' ? '#cc8822' : '#ff6600';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function render(ctx) {
  // background
  ctx.fillStyle = '#090b10';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);

  // sky/ground for farm area
  ctx.fillStyle = '#0f131a';
  ctx.fillRect(0, CFG.farmTop, CFG.farmRight, CFG.groundY - CFG.farmTop);
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(0, CFG.groundY, CFG.farmRight, CFG.weaponBarY - CFG.groundY);

  // HUD + ticker
  drawHUD(ctx);
  drawTicker(ctx);
  drawGoldenTicket(ctx);

  // Slots + launch pads
  for (let i = 0; i < CFG.slotCount; i++) {
    const box = getSlotBox(i);
    drawSprite(ctx, 'dirt', box.x, box.y, 2);
    if (GameState.launchpads.includes(i)) {
      drawSprite(ctx, 'launchpad', slotCenterX(i) - 32, CFG.groundY - 20, 2);
    }
  }

  // Decorative cursed ducks on the ground
  if (GameState.duckGrounds && GameState.duckGrounds.length) {
    for (const duck of GameState.duckGrounds) {
      const bob = Math.sin((GameState.gameTime + duck.wobble) / 280) * 1.8;
      drawSprite(ctx, 'icon_duck', duck.x - 8, duck.y + bob, 1);
      if (hasDuckCurse() && Math.floor((GameState.gameTime + duck.wobble) / 420) % 2 === 0) {
        ctx.fillStyle = '#ffdd66';
        ctx.fillRect(duck.x + 1, duck.y + bob + 4, 2, 2);
        ctx.fillRect(duck.x + 5, duck.y + bob + 4, 2, 2);
      }
    }
  }

  // Nutrient feed bag indicator if unlocked
  if (GameState.upgrades.nutrientFeed) {
    for (let i = 0; i < CFG.slotCount; i++) {
      if (!GameState.plants[i]) continue;
      const x = slotCenterX(i);
      drawSprite(ctx, 'feedbag', x + 16, CFG.groundY - 8, 1);
    }
  }

  // Plants
  for (const p of GameState.plants) {
    if (p) drawPlant(ctx, p);
  }
  drawPendingMutants(ctx);

  // Pests
  for (const p of GameState.pests) {
    if (!p.dead) {
      if (p.radiated) {
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.08 * Math.sin((GameState.gameTime + p.x) / 120);
        ctx.fillStyle = '#8cff44';
        ctx.beginPath();
        ctx.arc(p.x + p.size / 2, p.y + p.size / 2, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      p.draw(ctx);
    }
  }

  // Drone support units
  drawDrone(ctx);
  drawHarvestDrone(ctx);

  // Particles + popups + debris
  drawParticles(ctx);

  // Cursor target overlay
  drawCursorTarget(ctx);

  // Shop + weapon bar + buffs
  drawShopPanel(ctx);
  drawWeaponBar(ctx);
  drawBuffsRow(ctx);
  drawAssistant(ctx);
  drawAssistantCursor(ctx);

  // Phase banner
  if (GameState.phaseBanner) drawPhaseBanner(ctx);

  // Ad
  if (GameState.ads && GameState.ads.length) {
    for (let i = 0; i < GameState.ads.length; i++) drawAd(ctx, GameState.ads[i], i);
  }

  // Glitch / dramatic strike flash
  if (GameState.glitchTimer > 0) drawGlitch(ctx);
  if (GameState.laserFlashTimer > 0) drawLaserFlash(ctx);
  if (GameState.nukeFX) drawNukeFlash(ctx);

  if (GameState.gagDialog) drawGagDialog(ctx);

  // Announcement overlay (on top)
  if (GameState.announcementOverlay) drawAnnouncement(ctx);

  // Buff flash
  if (GameState.buffFlash) drawBuffFlash(ctx);
}



  return { drawHUD, drawGoldenTicket, drawPlant, drawPendingMutants, drawDrone, drawHarvestDrone, drawSpeechBubble, drawAssistant, drawAssistantCursor, drawBuffsRow, drawPhaseBanner, drawAd, drawNukeFlash, drawAnnouncement, wrapTextLines, drawGagDialog, drawBuffFlash, drawGlitch, drawLaserFlash, drawCursorTarget, render };
}
