export function createInputHandlers(ctx) {
  const { GameState, CFG, flashBuff, spawnPopup, spawnBurst, spawnPoof, handleShopClick, handleWeaponBarClick, applyWeapon, getSlotClickBox, pick, formatMoney, clamp, noteTomatoAttack, slotCenterX, Plant, restart, randInt, rand, AD_COPY, adCloseBox, spawnGlobalPopup } = ctx;

// -----------------------------------------------------------------------------
// 19. INPUT HANDLERS
// -----------------------------------------------------------------------------

function handleTomatoClick(sx, sy) {
  for (const plant of GameState.plants) {
    if (!plant) continue;
    const px = plant.getScreenX();
    for (let i = 0; i < plant.segments.length; i++) {
      const sy2 = plant.getScreenYForSegment(i);
      for (const side of ['L', 'R']) {
        const t = plant.segments[i].fruits[side];
        if (!t) continue;
        const size = t.getRenderSize();
        const tx = px + (side === 'L' ? -(size - 8) : 10);
        const ty = sy2 - Math.max(6, size * 0.2);
        if (sx >= tx - 4 && sx <= tx + size + 4 && sy >= ty - 4 && sy <= ty + size + 4) {
          if (t.state === 'ripe') {
            const v = t.getValue();
            if (GameState.taxPocalypseTriggered) {
              spawnPopup(tx + size / 2, ty - 6, '+' + formatMoney(v), '#66ff66');
              spawnPopup(tx + size / 2, ty + 14, '-' + formatMoney(v), '#ff4444');
              GameState.stats.tomatoesConfiscated++;
              GameState.stats.totalTaxed += v;
            } else {
              GameState.cash += v;
              GameState.stats.totalEarned += v;
              spawnPopup(tx + size / 2, ty - 6, '+' + formatMoney(v), '#66ff66');
            }
            GameState.stats.tomatoesHarvested++;
            plant.segments[i].fruits[side] = null;
            spawnPoof(tx + size / 2, ty + size / 2);
            return true;
          } else if (t.state === 'rotten') {
            GameState.cash += CFG.tomato.values.penalty;
            spawnPopup(tx + size / 2, ty - 6, formatMoney(CFG.tomato.values.penalty), '#ff4444');
            plant.segments[i].fruits[side] = null;
            spawnPoof(tx + size / 2, ty + size / 2);
            return true;
          }
        }
      }
    }
  }
  return false;
}

function handleSlotClick(sx, sy) {
  for (let i = 0; i < CFG.slotCount; i++) {
    const box = getSlotClickBox(i);
    if (sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) {
      // Launch pad placement has priority
      if (GameState.weapons.nuke.padPending) {
        if (GameState.plants[i]) { flashBuff('Slot occupied'); return true; }
        if (GameState.launchpads.includes(i)) { flashBuff('Pad already here'); return true; }
        GameState.launchpads.push(i);
        GameState.weapons.nuke.padPlaced = true;
        GameState.weapons.nuke.padSlot = i;
        GameState.weapons.nuke.padPending = false;
        spawnPoof(slotCenterX(i), CFG.groundY);
        spawnGlobalPopup('LAUNCH PAD INSTALLED', '#6b2f9e');
        return true;
      }
      // Plant a seed
      if (GameState.plants[i]) return true;
      if (GameState.launchpads.includes(i)) { flashBuff('Launch pad here'); return true; }
      if (GameState.seeds.engineered > 0) {
        GameState.seeds.engineered--;
        GameState.plants[i] = new Plant(i, true);
        GameState.stats.plantsPlanted++;
        spawnPoof(slotCenterX(i), CFG.groundY);
        return true;
      }
      if (GameState.seeds.basic > 0) {
        GameState.seeds.basic--;
        GameState.plants[i] = new Plant(i, false);
        GameState.stats.plantsPlanted++;
        spawnPoof(slotCenterX(i), CFG.groundY);
        return true;
      }
      flashBuff('No seeds');
      return true;
    }
  }
  return false;
}

function handlePestClick(sx, sy) {
  for (const p of GameState.pests) {
    if (p.dead) continue;
    if (sx >= p.x && sx <= p.x + p.size && sy >= p.y && sy <= p.y + p.size) {
      p.hit();
      return true;
    }
  }
  return false;
}

function makeAggroAd() {
  const copy = pick(AD_COPY);
  const palettes = [
    { bg: '#220022', border: '#ff44aa', fill: '#ffcc00', accent: '#ffffff' },
    { bg: '#001133', border: '#66ddff', fill: '#ff4444', accent: '#ffee66' },
    { bg: '#221100', border: '#ffaa00', fill: '#ff44aa', accent: '#ffffff' },
    { bg: '#200000', border: '#ff2222', fill: '#66ddff', accent: '#ffffff' },
  ];
  const palette = pick(palettes);
  const w = randInt(CFG.ad.w - 40, CFG.ad.w + 60);
  const h = randInt(CFG.ad.h - 30, CFG.ad.h + 40);
  return {
    copy,
    x: rand(70, CFG.farmRight - w - 20),
    y: rand(90, CFG.weaponBarY - h - 30),
    w, h,
    palette,
    flashOffset: Math.random() * 1000,
    jiggle: rand(0.5, 1.5),
  };
}



function handleAdClick(sx, sy) {
  if (!GameState.ads || GameState.ads.length === 0) return false;
  for (let i = GameState.ads.length - 1; i >= 0; i--) {
    const ad = GameState.ads[i];
    const close = adCloseBox(ad);
    if (sx >= close.x && sx <= close.x + close.w && sy >= close.y && sy <= close.y + close.h) {
      GameState.ads.splice(i, 1);
      GameState.stats.adsClosed++;
      spawnBurst(close.x + close.w / 2, close.y + close.h / 2, 6, ['#ff44aa', '#66ddff', '#ffcc00']);
      return true;
    }
    if (sx >= ad.x && sx <= ad.x + ad.w && sy >= ad.y && sy <= ad.y + ad.h) {
      // Deliberately obnoxious: the ad body eats clicks but does NOT close.
      GameState.cash -= 5;
      spawnPopup(sx, sy, 'MISCLICK -$5', '#ff4444');
      return true;
    }
  }
  return false;
}

function handleClick(sx, sy) {
  // Intro screen
  if (GameState.phase === 'intro') {
    GameState.phase = 'playing';
    return;
  }
  if (GameState.phase === 'gameover') {
    const ending = GameState.gameoverEnding;
    if (ending && !ending.complete) {
      ending.frameIndex = (ending.frameIndex || 0) + 1;
      if (ending.frameIndex >= ending.frameCount) {
        ending.complete = true;
      }
      return;
    }
    restart();
    return;
  }
  if (GameState.phase !== 'playing') return;

  // Announcement overlay swallows clicks (player reads)
  if (GameState.announcementOverlay) return;

  // Ads take absolute priority. While any ad is on screen, the player must
  // close an ad via its tiny close button before interacting with the game.
  if (GameState.ads && GameState.ads.length > 0) {
    handleAdClick(sx, sy);
    return;
  }

  // Weapon bar
  if (sy >= CFG.weaponBarY) {
    handleWeaponBarClick(sx, sy);
    return;
  }

  // Shop panel
  if (sx >= CFG.shopX) {
    handleShopClick(sx, sy);
    return;
  }

  // Farm area clicks
  // 1. If a targeted weapon is selected and click is in farm area, fire it
  if (GameState.weapons.selected && sy >= CFG.farmTop) {
    const fired = applyWeapon(GameState.weapons.selected, sx, sy);
    if (fired && ['nuke', 'laser'].includes(GameState.weapons.selected)) {
      GameState.weapons.selected = null;
    }
    return;
  }

  // 2. Pests
  if (handlePestClick(sx, sy)) return;
  // 3. Tomatoes
  if (handleTomatoClick(sx, sy)) return;
  // 4. Slots (planting / pad placement)
  if (handleSlotClick(sx, sy)) return;
}



  return { handleTomatoClick, handleSlotClick, handlePestClick, makeAggroAd, adCloseBox, handleAdClick, handleClick };
}
