export function createUpdater(ctx) {
  const { 
    GameState, CFG, PHASES, rand, randInt, pick, formatMoney,
    checkPhaseChange, updateShop, updateWeaponSystems, updateTicker, checkFailsafeSeed, 
    updateParticles, getCorruptionPressure, spawnRandomPest, spawnGlobalPopup, 
    hasAnyShare, getShareEnding, spawnPopup
  } = ctx;

// -----------------------------------------------------------------------------
// 20. MAIN UPDATE LOOP
// -----------------------------------------------------------------------------

function update(dt) {
  if (GameState.phase !== 'playing') return;

  GameState.gameTime += dt;

  checkPhaseChange(dt);

  const phase = PHASES[GameState.currentPhaseIndex];
  const corruption = getCorruptionPressure();

  // Tax pocalypse trigger
  if (!GameState.taxPocalypseTriggered && GameState.gameTime >= CFG.taxPocalypseAtMs) {
    if (ctx.triggerTaxPocalypse) ctx.triggerTaxPocalypse();
  }

  // Standard tax
  GameState.taxTimer += dt;
  const taxInterval = GameState.taxPocalypseTriggered ? 3000 : phase.taxIntervalMs;
  if (GameState.taxTimer >= taxInterval) {
    GameState.taxTimer = 0;
    if (GameState.taxPocalypseTriggered) {
      const wipe = Math.max(0, GameState.cash);
      if (wipe > 0) {
        GameState.cash -= wipe;
        GameState.stats.totalTaxed += wipe;
        spawnPopup(CFG.farmRight/2, 110, 'WEALTH TAX: -' + formatMoney(wipe), '#ff4444');
      }
    } else {
      if (GameState.cash > 100) {
        const t = Math.floor(GameState.cash * phase.taxRate);
        GameState.cash -= t;
        GameState.stats.totalTaxed += t;
        spawnPopup(CFG.farmRight/2, 110, 'TAX: -' + formatMoney(t), '#ff9933');
      }
    }
  }

  // Pest waves accelerate when rot and disease are left unmanaged.
  GameState.pestTimer += dt;
  const pestInterval = Math.max(900, phase.pestIntervalMs / corruption.modifier);
  if (GameState.pestTimer >= pestInterval) {
    GameState.pestTimer = 0;
    for (let i = 0; i < phase.pestWaveSize; i++) spawnRandomPest(GameState.currentPhaseIndex);
  }

  // Ambient bugs (quieter before 8 min, except when the garden starts to spoil)
  GameState.ambientPestTimer += dt;
  const ambientBase = GameState.gameTime < 480000 ? phase.ambientIntervalMs * 1.6 : phase.ambientIntervalMs;
  const ambientInterval = Math.max(1600, ambientBase / Math.min(2.6, 1 + corruption.rotten * 0.025 + corruption.diseased * 0.07));
  if (GameState.ambientPestTimer >= ambientInterval) {
    GameState.ambientPestTimer = 0;
    if (GameState.plants.some(p => p) && ctx.spawnPestOfType) ctx.spawnPestOfType('whitefly');
  }

  // Locust
  if (phase.locust) {
    GameState.locustTimer += dt;
    if (GameState.locustTimer >= phase.locustInterval) {
      GameState.locustTimer = 0;
      if (ctx.VCLocust) {
        GameState.pests.push(new ctx.VCLocust());
        spawnGlobalPopup('VC LOCUST INCOMING', '#aa4444');
      }
    }
  }

  // Ads: stack them up so they feel like a real infestation.
  GameState.adTimer += dt;
  const popupReduction = GameState.weapons.popup.active ? (1 - CFG.weapon.popup.reduction) : 1;
  const adCap = GameState.gameTime < 420000 ? 3 : 6;
  const adInterval = GameState.gameTime < 420000 ? phase.adIntervalMs * 0.75 : phase.adIntervalMs * 0.45;
  if (GameState.adTimer >= adInterval) {
    GameState.adTimer = 0;
    const burst = GameState.gameTime > 420000 ? randInt(1, 2) : 1;
    for (let i = 0; i < burst; i++) {
      if (GameState.ads.length < adCap && Math.random() < popupReduction && ctx.makeAggroAd) {
        GameState.ads.push(ctx.makeAggroAd());
      }
    }
  }

  // Propaganda popups
  if (ctx.hasMLBook && ctx.hasMLBook()) {
    if (GameState.gameTime > 420000 && GameState.gameTime < 500000) {
      if (Math.random() < 0.018 * popupReduction) {
        spawnPopup(rand(80, CFG.farmRight - 80), rand(130, CFG.groundY - 100),
                   pick(ctx.POPUP_POOL || []), '#ffcc66');
      }
    } else if (Math.random() < 0.003 * popupReduction) {
      spawnPopup(rand(80, CFG.farmRight - 80), rand(130, CFG.groundY - 100),
                 pick(ctx.POPUP_POOL || []), '#aaccff');
    }
  }

  // Plants
  for (const p of GameState.plants) {
    if (p) p.update(dt);
  }
  if (ctx.updateRotPenalty) ctx.updateRotPenalty(dt);
  checkFailsafeSeed();

  // Pests
  for (const p of GameState.pests) {
    if (!p.dead) p.update(dt);
  }
  for (const p of GameState.pests) {
    if (p.dead && p.onDeath) { p.onDeath(); p.onDeath = null; }
  }
  GameState.pests = GameState.pests.filter(p => !p.dead);

  // Shop, weapons, buffs, particles, ticker
  updateShop(dt);
  if (updateWeaponSystems) updateWeaponSystems(dt);
  if (ctx.updateBuffs) ctx.updateBuffs(dt);
  updateParticles(dt);
  updateTicker(dt);

  // Announcement overlay
  if (GameState.announcementOverlay) {
    GameState.announcementOverlay.age += dt;
    if (GameState.announcementOverlay.age > GameState.announcementOverlay.duration) {
      GameState.announcementOverlay = null;
    }
  }
  if (GameState.gagDialog) {
    GameState.gagDialog.age += dt;
    if (GameState.gagDialog.age > GameState.gagDialog.duration) GameState.gagDialog = null;
  }
  if (GameState.buffFlash) {
    GameState.buffFlash.age += dt;
    if (GameState.buffFlash.age > 1500) GameState.buffFlash = null;
  }
  if (GameState.laserFlashTimer > 0) GameState.laserFlashTimer = Math.max(0, GameState.laserFlashTimer - dt);
  if (GameState.nukeFX) {
    GameState.nukeFX.timeLeft -= dt;
    if (GameState.nukeFX.timeLeft <= 0) GameState.nukeFX = null;
  }
  if (GameState.glitchTimer > 0) GameState.glitchTimer -= dt;

  // Cash floor → game over (Cobalt Mines)
  if (GameState.cash < CFG.cashFloor) {
    GameState.phase = 'gameover';
    GameState.gameoverReason = 'mines';
    GameState.gameoverPropaganda = pick(ctx.MINES_PROPAGANDA || []);
  }

  // Survived timer or secret shareholder ending
  if (GameState.gameTime >= CFG.maxDurationMs && GameState.phase === 'playing') {
    GameState.phase = 'gameover';
    if (hasAnyShare()) {
      GameState.gameoverReason = 'shareholder';
      GameState.gameoverEnding = getShareEnding();
    } else {
      GameState.gameoverReason = 'survived';
    }
  }
}

  return { update };
}
