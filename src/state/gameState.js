// Central mutable game state.
import { CFG } from '../config/index.js';

// 6. GAME STATE
// -----------------------------------------------------------------------------

const GameState = {
  phase: 'intro',      // 'intro' | 'playing' | 'gameover' | 'editor'
  cash: CFG.startingCash,
  gameTime: 0,
  lastTime: 0,
  mouseX: 0, mouseY: 0,

  plants: [],          // indexed by slot, null if empty or other structure
  launchpads: [],      // slot indices that hold a launch pad (blocks planting)
  pests: [],
  particles: [],
  popups: [],
  fallingDebris: [],   // {x, y, vx, vy, life, spriteKey}

  seeds: { basic: 0, engineered: 0 },
  junk: [],            // list of junk item names
  duckCurse: false,
  duckCount: 0,
  duckGrounds: [],
  flags: {
    launchPadPurchased: false,
    tomatoAttackStories: 0,
  },

  // Timers
  taxTimer: 0,
  adTimer: 0,
  pestTimer: 0,
  ambientPestTimer: 0, // small bugs (rare before 8 min)
  locustTimer: 0,

  // Shop
  shop: {
    slots: [null, null, null, null],   // each: { item, timeLeft, maxTime }
    refreshTimer: 0,
    nextRefreshAt: 8000,
  },

  // Weapons
  weapons: {
    nuke:   { unlocked: false, padPlaced: false, padSlot: -1, padPending: false, charges: 0, lastUsed: -999999 },
    drone:  { unlocked: false, chargesLeft: 0, active: false, lastToggleOff: -999999, killTimer: 0, costAccum: 0, x: 180, y: 170, targetX: 180, targetY: 170, patrolTimer: 0, currentTargetId: null, beamFlash: 0, beamTargetX: 0, beamTargetY: 0 },
    popup:  { unlocked: false, active: false, lastToggleOff: -999999, costAccum: 0 },
    laser:  { unlocked: false, charges: 0, lastUsed: -999999 },
    manure: { unlocked: false, lastUsed: -999999 },
    flame:  { unlocked: false, lastUsed: -999999 },
    selected: null,   // 'nuke' | 'laser' | 'manure' | 'flame' | null
  },

  upgrades: {
    nutrientFeed: false,
    plantGrowthRate: 0,
    tomatoGrowthRate: 0,
    largeChance: 0,
    goldChance: 0,
    pestResistance: 0,
    rotWindow: 0,
  },

  portfolio: { xai: 0, amazon: 0, nvidia: 0, claude: 0, google: 0 },

  // Temporary buffs
  buffs: [],  // { type, name, sprite, timeLeft, maxTime, multiplier }

  // UI overlays
  ads: [],
  phaseBanner: null,
  glitchTimer: 0,
  announcementOverlay: null,   // { lines, age, duration }
  gagDialog: null,             // { title, body, age, duration }
  buffFlash: null,             // { text, age }
  laserFlashTimer: 0,
  nukeFX: null,
  currentPhaseIndex: 0,

  // News ticker
  ticker: { scroll: 0, text: '' },

  // Late-game
  taxPocalypseTriggered: false,

  // Stats
  stats: {
    tomatoesHarvested: 0,
    totalEarned: 0,
    totalTaxed: 0,
    pestsKilled: 0,
    adsClosed: 0,
    plantsPlanted: 0,
    plantsCollapsed: 0,
    rotPenalties: 0,
    tomatoesConfiscated: 0,
    seedsBought: 0,
    upgradesBought: 0,
    weaponsFired: 0,
  },
};

// -----------------------------------------------------------------------------

export { GameState };
