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
  const survived = GameState.gameoverReason === 'survived';
  const shareholder = GameState.gameoverReason === 'shareholder';

  ctx.fillStyle = (survived || shareholder) ? '#000803' : '#0a0000';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);

  // CRT scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = 0; y < CFG.canvas.h; y += 3) {
    ctx.fillRect(0, y, CFG.canvas.w, 1);
  }

  ctx.textAlign = 'center';

  if (shareholder) {
    const ending = GameState.gameoverEnding || getShareEnding();
    ctx.fillStyle = '#ffdd66';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText(ending ? ending.title : 'YOU WON. PROBABLY.', CFG.canvas.w/2, 110);
    ctx.fillStyle = '#ffeecc';
    ctx.font = '16px "Courier New", monospace';
    const lines = ending ? ending.lines : ['Your portfolio matured into a staffing event.'];
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], CFG.canvas.w/2, 150 + i * 22);
  } else if (survived) {
    ctx.fillStyle = '#66ff66';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillText('YOU SURVIVED', CFG.canvas.w/2, 120);
    ctx.fillStyle = '#ccffcc';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('you avoided the cobalt mines', CFG.canvas.w/2, 160);
    ctx.fillText('this does not mean things are okay', CFG.canvas.w/2, 186);
  } else {
    ctx.fillStyle = '#ff2222';
    ctx.font = 'bold 44px "Courier New", monospace';
    ctx.fillText('REDEPLOYED TO COBALT SECTOR', CFG.canvas.w/2, 120);
    ctx.fillStyle = '#ff9999';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText('"' + (GameState.gameoverPropaganda || MINES_PROPAGANDA[0]) + '"',
                 CFG.canvas.w/2, 170);
  }

  // Stats
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
    'avoided the mines:       ' + ((survived || shareholder) ? 'yes' : 'NO'),
  ];
  ctx.fillStyle = survived ? '#88ff88' : '#ffaaaa';
  ctx.font = '14px "Courier New", monospace';
  ctx.textAlign = 'left';
  const baseX = CFG.canvas.w/2 - 200;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], baseX, 240 + i * 22);
  }

  // Retry
  ctx.textAlign = 'center';
  ctx.fillStyle = '#66ddff';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText('[ CLICK ANYWHERE TO TRY AGAIN ]', CFG.canvas.w/2, CFG.canvas.h - 60);

  ctx.textAlign = 'left';
}



  return { drawIntro, drawGameOver };
}
