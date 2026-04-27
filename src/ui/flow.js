export function createFlowUI(ctx) {
  const { GameState, CFG, formatMoney, MINES_PROPAGANDA, pick } = ctx;

// -----------------------------------------------------------------------------
// 22. INTRO + GAME OVER
// -----------------------------------------------------------------------------

let _introPulse = 0;
function drawIntro(ctx) {
  _introPulse += 16;
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);

  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TOMATO  BILLIONAIRE', CFG.canvas.w/2, 140);

  ctx.fillStyle = '#cccccc';
  ctx.font = '18px "Courier New", monospace';
  ctx.fillText('hold together a tomato side hustle for 12 minutes', CFG.canvas.w/2, 180);
  ctx.fillText('while the AI-augmented economy devours itself', CFG.canvas.w/2, 206);

  ctx.fillStyle = '#ffcc66';
  ctx.font = 'bold 15px "Courier New", monospace';
  const rules = [
    '-  buy seeds from the shop on your right',
    '-  click the dirt to plant   -   click ripe tomatoes to harvest',
    '-  click pests to swat them',
    '-  weapons live on the bottom bar   (hotkeys 1-6)',
    '-  nukes need a launch pad; drone rent is brutal; rot attracts trouble',
    '-  at 10:00, the wealth tax takes everything above zero',
    '-  if cash drops below -$2000 you go to the cobalt mines',
    '-  survive until 0:00 to avoid the mines',
  ];
  for (let i = 0; i < rules.length; i++) {
    ctx.fillText(rules[i], CFG.canvas.w/2, 268 + i * 26);
  }

  ctx.fillStyle = '#66ddff';
  ctx.font = 'bold 22px "Courier New", monospace';
  const pulse = Math.sin(_introPulse / 200) > 0;
  if (pulse) ctx.fillText('[ CLICK ANYWHERE TO START ]', CFG.canvas.w/2, 540);

  ctx.fillStyle = '#444';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('press  `  (backtick) at any time to open the sprite editor', CFG.canvas.w/2, CFG.canvas.h - 20);

  ctx.textAlign = 'left';
}

function drawGameOver(ctx) {
  const ending = GameState.gameoverEnding;
  const survived = ending ? ending.category !== 'fail' : GameState.gameoverReason === 'survived';
  const currentFrame = ending ? Math.max(1, Math.min(ending.frameCount, (ending.frameIndex || 0) + 1)) : 1;
  const imagePath = ending ? `${ending.dir}/${currentFrame}.png` : '';
  const frameImage = imagePath ? getEndingImage(imagePath) : null;
  const hasImage = !!(frameImage && frameImage.complete && frameImage.naturalWidth > 0);

  ctx.fillStyle = survived ? '#000803' : '#0a0000';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);

  // CRT scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = 0; y < CFG.canvas.h; y += 3) {
    ctx.fillRect(0, y, CFG.canvas.w, 1);
  }

  ctx.textAlign = 'center';
  const showSequence = ending && !ending.complete;

  if (showSequence) {
    if (hasImage) {
      const pad = 70;
      const maxW = CFG.canvas.w - pad * 2;
      const maxH = CFG.canvas.h - 170;
      const scale = Math.min(maxW / frameImage.width, maxH / frameImage.height);
      const w = frameImage.width * scale;
      const h = frameImage.height * scale;
      ctx.drawImage(frameImage, (CFG.canvas.w - w) / 2, 40, w, h);
    } else {
      ctx.fillStyle = survived ? '#66ff66' : '#ff2222';
      ctx.font = 'bold 42px "Courier New", monospace';
      ctx.fillText(ending ? ending.name : 'ENDING', CFG.canvas.w/2, 140);
      ctx.fillStyle = survived ? '#ccffcc' : '#ff9999';
      ctx.font = '18px "Courier New", monospace';
      const fallback = ending && ending.category === 'fail'
        ? '"' + (GameState.gameoverPropaganda || MINES_PROPAGANDA[0]) + '"'
        : 'Add 1.png, 2.png, 3.png... in this ending directory.';
      ctx.fillText(fallback, CFG.canvas.w/2, 190);
    }
  }

  // Stats (only shown after sequence is finished or if no specialized ending)
  if (!ending || ending.complete) {
    // Title
    ctx.fillStyle = survived ? '#66ff66' : '#ff2222';
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.fillText(ending ? ending.name : 'ENDING', CFG.canvas.w/2, 140);

    const s = GameState.stats;
    const lines = [
      'tomatoes harvested:      ' + s.tomatoesHarvested,
      'tomatoes confiscated:    ' + s.tomatoesConfiscated,
      'pests killed:            ' + s.pestsKilled,
      'plants collapsed:        ' + s.plantsCollapsed,
      'plants planted:          ' + s.plantsPlanted,
      'weapons fired:           ' + s.weaponsFired,
      'seeds purchased:         ' + s.seedsBought,
      'upgrades bought:         ' + s.upgradesBought,
      'ads closed:              ' + s.adsClosed,
      'total earned:            ' + formatMoney(s.totalEarned),
      'total taxed:             ' + formatMoney(s.totalTaxed),
      'rot penalties:           ' + formatMoney(s.rotPenalties),
      'avoided the mines:       ' + (survived ? 'yes' : 'NO'),
    ];
    ctx.fillStyle = survived ? '#88ff88' : '#ffaaaa';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'left';
    const baseX = CFG.canvas.w/2 - 200;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], baseX, 250 + i * 20);
    }
  }

  // Retry
  ctx.textAlign = 'center';
  ctx.fillStyle = '#66ddff';
  ctx.font = 'bold 18px "Courier New", monospace';
  const nextLabel = ending && !ending.complete ? '[ CLICK TO CONTINUE ]' : '[ CLICK ANYWHERE TO TRY AGAIN ]';
  ctx.fillText(nextLabel, CFG.canvas.w/2, CFG.canvas.h - 60);
  if (ending) {
    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = '#ffdd66';
    ctx.fillText(`${ending.name}  •  frame ${currentFrame}`, CFG.canvas.w/2, CFG.canvas.h - 88);
  }

  ctx.textAlign = 'left';
}

const endingImageCache = new Map();
function getEndingImage(path) {
  if (endingImageCache.has(path)) return endingImageCache.get(path);
  const img = new Image();
  img.src = path;
  endingImageCache.set(path, img);
  return img;
}



  return { drawIntro, drawGameOver };
}
