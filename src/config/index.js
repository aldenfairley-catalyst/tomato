// Extracted from the former monolithic game module.

// 1. PALETTE
// -----------------------------------------------------------------------------
const PALETTE = {
  0:  null,
  1:  '#2288cc',
  2:  '#44cc44',
  3:  '#ffdd00',
  4:  '#ff4444',
  5:  '#884400',
  6:  '#1a0a2e',
  7:  '#ffffff',
  8:  '#ff44aa',
  9:  '#226622',
  10: '#aa2222',
  11: '#ffaa00',
  12: '#66ddff',
  13: '#000000',
  14: '#553311',
  15: '#cc8822',
  16: '#88ff88',
  17: '#ffeecc',
  18: '#777777',
  19: '#cccccc',
  20: '#6b2f9e',   // nuke purple
  21: '#ff9933',   // rust orange (disease)
  22: '#3c3c5c',   // steel blue-grey
  23: '#aaccff',   // ice / ai blue
};

const PALETTE_NAMES = {
  0: 'NULL', 1: 'BLUE', 2: 'GREEN', 3: 'GOLD', 4: 'RED',
  5: 'DIRT', 6: 'ROT', 7: 'WHITE', 8: 'MAGENTA', 9: 'DGREEN',
  10: 'DRED', 11: 'AMBER', 12: 'CYAN', 13: 'BLACK', 14: 'DBROWN',
  15: 'TAN', 16: 'LGREEN', 17: 'CREAM', 18: 'GREY', 19: 'LGREY',
  20: 'NUKE', 21: 'RUST', 22: 'STEEL', 23: 'ICE'
};

// -----------------------------------------------------------------------------

// 3. CONFIG
// -----------------------------------------------------------------------------

const CFG = {
  canvas: { w: 1280, h: 760 },

  // Layout
  newsBarY: 40,        // news ticker y
  newsBarH: 28,
  farmTop: 72,
  shopX: 990,          // shop panel left edge
  shopW: 290,
  weaponBarY: 640,
  weaponBarH: 120,
  farmRight: 980,      // right edge of farm area (before shop)
  farmBottom: 630,
  groundY: 600,

  slotCount: 6,
  slotSize: 64,        // 32x32 dirt sprite at 2x

  plant: {
    segmentHeight: 28,
    maxSegmentsDefault: 5,   // height cap without nutrient feed
    maxSegmentsWithFeed: 12,
    baseGrowMs: 9500,        // slightly slower baseline growth
    segmentHealth: 3,        // lower segments can be damaged this many hits before collapse
    tomatoSpawnIntervalMs: 10000, // slower early fruiting so tomatoes do not appear too quickly
    tomatoSpawnChance: 0.22,
    engineeredGrowthBonus: 0.7,  // multiplier on grow ms
    engineeredSpawnBonus: 1.6,   // multiplier on spawn chance
  },

  tomato: {
    sproutMs: 5000,
    greenMs: 11000,
    ripeMs: 18000,
    renderSize: 28,
    // size system
    sizeChances: { small: 0.38, medium: 0.52, large: 0.10 },
    sizes: { small: 24, medium: 32, large: 48 },
    sizeValueMults: { small: 0.7, medium: 1.0, large: 1.9 },
    heirloomChance: 0.15,
    cocktailChance: 0.05,
    engineeredHeirloomChance: 0.30,
    engineeredCocktailChance: 0.15,
    values: { roma: 200, heirloom: 420, cocktail: 520, penalty: -80 },
    engineeredValueMult: 1.8,
    rotPenaltyPerTick: 10,       // each rotten tomato costs $10 every tick while left on the plant
    rotPenaltyIntervalMs: 10000, // every 10 seconds
  },

  seedCostEmergency: 0,  // emergency auto-grant

  startingCash: 600,
  cashFloor: -2000,       // below this = game over
  maxDurationMs: 12 * 60 * 1000,  // 12 minutes
  taxPocalypseAtMs: 10 * 60 * 1000, // 2 minutes remaining → tax event

  disease: {
    spreadMs: 9000,       // per neighbouring segment
    killMs: 28000,        // if never contained, segment dies
  },

  shop: {
    slots: 4,
    refreshMinMs: 12000,
    refreshMaxMs: 20000,
    offerMinMs: 25000,
    offerMaxMs: 40000,
  },

  weapon: {
    nuke: { cooldownMs: 30000, cost: 1000, radius: 260 },
    drone: { cooldownMs: 60000, costPerSec: 4, killIntervalMs: 700, attackRadius: 130, moveSpeed: 0.18, patrolRetargetMs: 2400 },
    harvestDrone: { moveSpeed: 0.101, harvestRadius: 22, bugAttackDamagePerMs: 1 / 10000, retargetMs: 1500 },
    popup: { cooldownMs: 12000, costPerSec: 20, reduction: 0.75 },
    laser: { cooldownMs: 20000, cost: 2500, radius: 60 },
    manure: { cooldownMs: 2500, cost: 50, radius: 90, slowMs: 4000 },
    flame: { cooldownMs: 5000, cost: 150, radius: 40 },
  },

  ad: { w: 360, h: 220, closeBtnSize: 14 },
};

// Phases now escalate more gently in early minutes and sharply in late
const PHASES = [
  { name: 'SEED ROUND',     until: 180000, pestIntervalMs: 14000, pestWaveSize: 1, ambientIntervalMs: 30000, adIntervalMs: 65000, taxIntervalMs: 18000, taxRate: 0.04, locust: false },
  { name: 'SERIES A',       until: 360000, pestIntervalMs: 10000, pestWaveSize: 1, ambientIntervalMs: 22000, adIntervalMs: 55000, taxIntervalMs: 16000, taxRate: 0.05, locust: false },
  { name: 'GROWTH STAGE',   until: 480000, pestIntervalMs:  7500, pestWaveSize: 2, ambientIntervalMs: 16000, adIntervalMs: 35000, taxIntervalMs: 14000, taxRate: 0.07, locust: false },
  { name: 'DEVPOCALYPSE',   until: 600000, pestIntervalMs:  5000, pestWaveSize: 2, ambientIntervalMs:  8000, adIntervalMs: 22000, taxIntervalMs: 12000, taxRate: 0.10, locust: true,  locustInterval: 40000 },
  { name: 'TAX CATASTROPHE',until: 720000, pestIntervalMs:  3500, pestWaveSize: 3, ambientIntervalMs:  5000, adIntervalMs: 15000, taxIntervalMs:  8000, taxRate: 0.15, locust: true,  locustInterval: 22000 },
];


// -----------------------------------------------------------------------------

export { PALETTE, PALETTE_NAMES, CFG, PHASES };
