export function createShopSystem(ctx) {
  const { GameState, CFG, rand, rollShopOffer, drawSprite, scaleFor, getDimensionSnapshot, ownedShares, STOCK_ENDINGS, flashBuff, spawnPoof } = ctx;

// -----------------------------------------------------------------------------
// 15. SHOP SYSTEM
// -----------------------------------------------------------------------------

function updateShop(dt) {
  for (let i = 0; i < GameState.shop.slots.length; i++) {
    const slot = GameState.shop.slots[i];
    if (!slot) continue;
    slot.timeLeft -= dt;
    if (slot.timeLeft <= 0) GameState.shop.slots[i] = null;
  }

  GameState.shop.refreshTimer += dt;
  if (GameState.shop.refreshTimer >= GameState.shop.nextRefreshAt) {
    GameState.shop.refreshTimer = 0;
    GameState.shop.nextRefreshAt = rand(CFG.shop.refreshMinMs, CFG.shop.refreshMaxMs);

    // Refill all empty shop slots on refresh so the panel feels predatory rather than sleepy.
    for (let i = 0; i < GameState.shop.slots.length; i++) {
      if (GameState.shop.slots[i]) continue;
      // Leave some empties on purpose so the shop still feels a little capricious.
      if (Math.random() < 0.18) continue;
      const item = rollShopOffer(GameState);
      if (!item) continue;
      const dur = rand(CFG.shop.offerMinMs, CFG.shop.offerMaxMs);
      GameState.shop.slots[i] = { item, timeLeft: dur, maxTime: dur };
    }
  }
}

function getShopSlotBox(i) {
  const x = CFG.shopX + 10;
  const y = CFG.farmTop + 40 + i * 132;
  return { x, y, w: CFG.shopW - 20, h: 120 };
}

function drawShopPanel(ctx) {
  // panel background
  ctx.fillStyle = '#101418';
  ctx.fillRect(CFG.shopX, CFG.farmTop, CFG.shopW, CFG.weaponBarY - CFG.farmTop);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(CFG.shopX, CFG.farmTop, CFG.shopW, CFG.weaponBarY - CFG.farmTop);
  // title
  ctx.fillStyle = '#ffcc66';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LIMITED TIME OFFERS', CFG.shopX + CFG.shopW/2, CFG.farmTop + 28);

  for (let i = 0; i < GameState.shop.slots.length; i++) {
    const box = getShopSlotBox(i);
    const slot = GameState.shop.slots[i];
    // card bg
    ctx.fillStyle = slot ? '#1c1f25' : '#0c0e11';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = slot ? '#555' : '#222';
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    if (!slot) {
      ctx.fillStyle = '#444';
      ctx.font = '12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('-- slot empty --', box.x + box.w/2, box.y + box.h/2);
      continue;
    }

    // icon
    const iconSize = 32;
    drawSprite(ctx, slot.item.sprite, box.x + 8, box.y + 10, scaleFor(slot.item.sprite, iconSize));
    // name
    ctx.fillStyle = '#eeeeee';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(slot.item.name, box.x + 48, box.y + 22);
    // desc
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px "Courier New", monospace';
    const desc = slot.item.desc;
    // simple wrap
    const maxWidth = box.w - 56;
    const words = desc.split(' ');
    let line = ''; let ly = box.y + 40;
    for (const w of words) {
      const test = line + (line ? ' ' : '') + w;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, box.x + 48, ly); line = w; ly += 14;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, box.x + 48, ly);

    // price
    const affordable = GameState.cash >= slot.item.price;
    ctx.fillStyle = affordable ? '#66ff66' : '#ff6666';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText('$' + slot.item.price, box.x + 8, box.y + box.h - 26);

    // expiry bar
    const pct = Math.max(0, slot.timeLeft / slot.maxTime);
    ctx.fillStyle = '#222';
    ctx.fillRect(box.x + 8, box.y + box.h - 14, box.w - 16, 6);
    ctx.fillStyle = pct > 0.3 ? '#ffcc66' : '#ff4444';
    ctx.fillRect(box.x + 8, box.y + box.h - 14, (box.w - 16) * pct, 6);

    // BUY hint
    ctx.fillStyle = affordable ? '#66ff66' : '#666';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[CLICK]', box.x + box.w - 8, box.y + box.h - 22);
    ctx.textAlign = 'left';
  }


  // dimension panel
  const statY = CFG.weaponBarY - 118;
  ctx.fillStyle = '#0d1016';
  ctx.fillRect(CFG.shopX + 10, statY, CFG.shopW - 20, 108);
  ctx.strokeStyle = '#334455';
  ctx.strokeRect(CFG.shopX + 10, statY, CFG.shopW - 20, 108);
  ctx.fillStyle = '#cceeff';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('PLANT DIMENSIONS', CFG.shopX + 18, statY + 14);
  const basic = getDimensionSnapshot(false);
  const gmo = getDimensionSnapshot(true);
  const rows = [
    ['Plant growth', basic.plantGrowth, gmo.plantGrowth, 'x'],
    ['Tomato growth', basic.tomatoGrowth, gmo.tomatoGrowth, 'x'],
    ['Large chance', basic.largeChance * 100, gmo.largeChance * 100, '%'],
    ['Gold chance', basic.goldChance * 100, gmo.goldChance * 100, '%'],
    ['Pest resist', basic.pestResistance * 100, gmo.pestResistance * 100, '%'],
    ['Rot window', basic.rotWindow * 100, gmo.rotWindow * 100, '%'],
  ];
  ctx.fillStyle = '#88ff88';
  ctx.fillText('BASIC', CFG.shopX + 136, statY + 30);
  ctx.fillStyle = '#ffdd66';
  ctx.fillText('GMO', CFG.shopX + 210, statY + 30);
  ctx.font = '11px "Courier New", monospace';
  for (let r = 0; r < rows.length; r++) {
    const [label, b, g, suffix] = rows[r];
    const y = statY + 46 + r * 10;
    ctx.fillStyle = '#9aa4b2';
    ctx.fillText(label, CFG.shopX + 18, y);
    ctx.fillStyle = '#88ff88';
    ctx.fillText((suffix === '%' ? b.toFixed(0) : b.toFixed(2)) + suffix, CFG.shopX + 136, y);
    ctx.fillStyle = '#ffdd66';
    ctx.fillText((suffix === '%' ? g.toFixed(0) : g.toFixed(2)) + suffix, CFG.shopX + 210, y);
  }
}

function drawPortfolioHint(ctx) {
  const owned = ownedShares();
  if (owned.length === 0) return;
  ctx.fillStyle = '#151820';
  ctx.fillRect(520, 6, 300, 28);
  ctx.strokeStyle = '#334';
  ctx.strokeRect(520, 6, 300, 28);
  ctx.fillStyle = '#ddddff';
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('portfolio: ' + owned.map(k => STOCK_ENDINGS[k].name).join(', '), 528, 24);
}

function handleShopClick(sx, sy) {
  for (let i = 0; i < GameState.shop.slots.length; i++) {
    const box = getShopSlotBox(i);
    if (sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) {
      const slot = GameState.shop.slots[i];
      if (!slot) return true;
      if (GameState.cash < slot.item.price) {
        flashBuff('Insufficient funds');
        return true;
      }
      GameState.cash -= slot.item.price;
      const id = slot.item.id;
      if (id === 'seed_basic' || id === 'seed_gmo') {
        GameState.stats.seedsBought++;
      } else if (!['duck', 'book', 'nft', 'mug', 'crystal', 'lanyard', 'share_xai', 'share_amazon', 'share_nvidia', 'share_claude', 'share_google'].includes(id)) {
        GameState.stats.upgradesBought++;
      }
      slot.item.onBuy(GameState);
      GameState.shop.slots[i] = null;
      spawnPoof(box.x + 40, box.y + 40);
      return true;
    }
  }
  return false;
}



  return { updateShop, getShopSlotBox, drawShopPanel, drawPortfolioHint, handleShopClick };
}
