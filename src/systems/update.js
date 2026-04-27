export function createUpdater(ctx) {
  const { 
    GameState, CFG, PHASES, rand, randInt, pick, formatMoney,
    checkPhaseChange, updateShop, updateWeaponSystems, updateTicker, checkFailsafeSeed, 
    updateParticles, getCorruptionPressure, spawnRandomPest, spawnGlobalPopup, 
    ownedShares, spawnPopup, makeEndingState
  } = ctx;

// -----------------------------------------------------------------------------
// 20. MAIN UPDATE LOOP
// -----------------------------------------------------------------------------

function syncPendingMutant(mutant) {
  const plant = GameState.plants[mutant.plantSlot];
  if (!plant || mutant.segIndex >= plant.segments.length) return false;
  mutant.x = plant.getScreenX() + (mutant.side === 'L' ? -18 : 18);
  mutant.y = plant.getScreenYForSegment(mutant.segIndex) - 8;
  return true;
}

function updatePendingMutants(dt) {
  if (!GameState.pendingMutants.length) return;
  const survivors = [];
  const ready = [];
  for (const mutant of GameState.pendingMutants) {
    if (!syncPendingMutant(mutant)) continue;
    mutant.timeLeft -= dt;
    if (mutant.timeLeft <= 0) ready.push(mutant);
    else survivors.push(mutant);
  }
  GameState.pendingMutants = survivors;
  for (const mutant of ready) {
    if (!ctx.MutantTomato) continue;
    GameState.pests.push(new ctx.MutantTomato(mutant.x, mutant.y, mutant.plantSlot));
    GameState.stats.mutantsDetached = (GameState.stats.mutantsDetached || 0) + 1;
    spawnPopup(mutant.x, mutant.y - 8, 'DETACHED!', '#8cff44');
    if (ctx.noteTomatoAttack && Math.random() < 0.65) ctx.noteTomatoAttack();
  }
}

function getSpecialEndingPool() {
  const pool = [];
  const shareToEnding = {
    xai: 'share_xai',
    amazon: 'share_amazon',
    nvidia: 'share_nvidia',
    claude: 'share_claude',
    google: 'share_google',
  };
  for (const key of (ownedShares ? ownedShares() : [])) {
    const endingId = shareToEnding[key];
    if (endingId && ctx.makeEndingState) pool.push(ctx.makeEndingState(endingId));
  }
  if ((GameState.duckCount || 0) > 10 && ctx.makeEndingState) {
    pool.push(ctx.makeEndingState('quackening'));
  }
  if ((GameState.stats.mutantsDetached || 0) > 1 && ctx.makeEndingState) {
    pool.push(ctx.makeEndingState('mutant_apocalypse'));
  }
  return pool;
}

function chooseGoodEnding() {
  if (!ctx.makeEndingState) return null;
  if ((GameState.stats.plantsPlanted || 0) === 0) return ctx.makeEndingState('no_planting');
  if (GameState.cash > 0) return ctx.makeEndingState('modest_solvency');
  return ctx.makeEndingState('not_yet_claimed');
}

function setAssistantState(state, duration) {
  const assistant = GameState.assistant;
  assistant.state = state;
  assistant.stateTime = duration || 0;
}

function setAssistantSpeech(text, duration) {
  const assistant = GameState.assistant;
  assistant.speech = {
    text,
    timeLeft: duration,
    maxTime: duration,
  };
}

function clearAssistantTarget() {
  GameState.assistant.targetItemId = null;
  GameState.assistant.targetSlotIndex = -1;
}

function cancelAssistantPurchase() {
  GameState.assistant.cursorFx = null;
  clearAssistantTarget();
  setAssistantState('apologising', 1400);
  setAssistantSpeech(ctx.getAssistantIdleLine(GameState.assistant.name, pick), 3200);
  GameState.assistant.buyTimer = randInt(10000, 18000);
}

function getAssistantPurchaseTarget() {
  const offers = [];
  for (let i = 0; i < GameState.shop.slots.length; i++) {
    const slot = GameState.shop.slots[i];
    if (!slot || slot.item.category !== 'junk') continue;
    if (slot.item.price > GameState.cash) continue;
    offers.push({ index: i, slot });
  }
  if (!offers.length) return null;
  const duck = offers.find(entry => entry.slot.item.id === 'duck');
  return duck || pick(offers);
}

function startAssistantPurchase(entry) {
  const assistant = GameState.assistant;
  const box = ctx.getShopSlotBox(entry.index);
  const targetX = box.x + box.w * 0.52;
  const targetY = box.y + box.h * 0.46;
  assistant.targetItemId = entry.slot.item.id;
  assistant.targetSlotIndex = entry.index;
  setAssistantState('noticing', 1500);
  setAssistantSpeech(ctx.getAssistantPurchaseLine(assistant.name, entry.slot.item.name, pick), 3600);
  assistant.cursorFx = {
    active: true,
    x: assistant.x + 92,
    y: assistant.y + 84,
    targetX,
    targetY,
    itemName: entry.slot.item.name,
    itemPrice: entry.slot.item.price,
    phase: 'moving',
    timeLeft: 900,
    slotIndex: entry.index,
  };
  assistant.buyTimer = randInt(18000, 35000);
}

function updateAssistantCursor(dt) {
  const assistant = GameState.assistant;
  const fx = assistant.cursorFx;
  if (!fx || !fx.active) return;
  const slot = GameState.shop.slots[fx.slotIndex];
  if (fx.phase !== 'purchased' && (!slot || slot.item.id !== assistant.targetItemId)) {
    cancelAssistantPurchase();
    return;
  }

  if (fx.phase === 'moving') {
    const dx = fx.targetX - fx.x;
    const dy = fx.targetY - fx.y;
    const dist = Math.hypot(dx, dy);
    const step = 0.45 * dt;
    fx.timeLeft -= dt;
    if (dist <= step || fx.timeLeft <= 0) {
      fx.x = fx.targetX;
      fx.y = fx.targetY;
      fx.phase = 'clicking';
      fx.timeLeft = 260;
    } else {
      fx.x += dx / dist * step;
      fx.y += dy / dist * step;
    }
    return;
  }

  if (fx.phase === 'clicking') {
    fx.timeLeft -= dt;
    if (fx.timeLeft > 0) return;
    const purchased = ctx.purchaseShopSlot ? ctx.purchaseShopSlot(fx.slotIndex) : null;
    if (!purchased) {
      cancelAssistantPurchase();
      return;
    }
    spawnPopup(fx.targetX, fx.targetY - 18, `${fx.itemName} Purchased`, '#aaccff');
    spawnPopup(fx.targetX, fx.targetY + 10, `-${formatMoney(fx.itemPrice)}`, '#ff6666');
    setAssistantState('purchasing', 1500);
    fx.phase = 'purchased';
    fx.timeLeft = 700;
    clearAssistantTarget();
    assistant.speakTimer = randInt(9000, 16000);
    return;
  }

  fx.timeLeft -= dt;
  if (fx.timeLeft <= 0) assistant.cursorFx = null;
}

function updateAssistant(dt) {
  const assistant = GameState.assistant;
  if (!assistant || !assistant.unlocked || !assistant.alive) return;

  if (assistant.stateTime > 0) {
    assistant.stateTime = Math.max(0, assistant.stateTime - dt);
  } else if (!assistant.cursorFx && GameState.weapons.selected !== 'nuke') {
    assistant.state = 'idle';
  }

  if (assistant.speech) {
    assistant.speech.timeLeft -= dt;
    if (assistant.speech.timeLeft <= 0) assistant.speech = null;
  }

  updateAssistantCursor(dt);

  if (!assistant.cursorFx && GameState.weapons.selected !== 'nuke') {
    assistant.buyTimer -= dt;
    if (assistant.buyTimer <= 0) {
      const target = getAssistantPurchaseTarget();
      if (target) startAssistantPurchase(target);
      else assistant.buyTimer = randInt(18000, 35000);
    }
  }

  assistant.speakTimer -= dt;
  if (assistant.speakTimer <= 0 && !assistant.cursorFx && !assistant.speech && GameState.weapons.selected !== 'nuke') {
    assistant.speakTimer = randInt(8000, 18000);
    if (GameState.ads.length >= 3 || GameState.popups.length >= 6) {
      setAssistantState('popup', 2400);
      setAssistantSpeech(ctx.getAssistantPopupLine(assistant.name, pick), 3600);
    } else {
      setAssistantState('apologising', 2200);
      setAssistantSpeech(ctx.getAssistantIdleLine(assistant.name, pick), 3600);
    }
  }
}

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
  updatePendingMutants(dt);

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
  updateAssistant(dt);
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
    if (ctx.makeEndingState) GameState.gameoverEnding = ctx.makeEndingState('cobalt_mines');
  }

  // End-of-run ending selection
  if (GameState.gameTime >= CFG.maxDurationMs && GameState.phase === 'playing') {
    GameState.phase = 'gameover';
    const pool = getSpecialEndingPool();
    GameState.gameoverReason = 'survived';
    GameState.gameoverEnding = pool.length === 0
      ? chooseGoodEnding()
      : (pool.length >= 2 ? pick(pool) : pool[0]);
  }
}

  return { update };
}
