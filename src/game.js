// =============================================================================
//  TOMATO BILLIONAIRE v2
//  A satirical survival / farm-defense game about holding together a
//  commercial tomato side hustle during a managed economic collapse.
//
//  Press ` (backtick) at any time to toggle the sprite editor.
// =============================================================================

'use strict';

import { PALETTE, PALETTE_NAMES, CFG, PHASES } from './config/index.js';
import { SPRITES, S, A } from './entities/sprites.js';
import {
  TICKER_HEADLINES,
  AD_COPY,
  POPUP_POOL,
  MINES_PROPAGANDA,
  TAX_ANNOUNCEMENT,
  ASSISTANT_DESIGN_SPEC,
  ASSISTANT_NAME_POOL,
  getAssistantPurchaseLine,
  getAssistantIdleLine,
  getAssistantPopupLine,
  getAssistantNukeWarningLine,
} from './content/index.js';
import { GameState } from './state/gameState.js';
import { createShopSystem, createWeaponSystem, createInputHandlers, createUpdater } from './systems/index.js';
import { createRenderUI, createFlowUI, createEditorUI } from './ui/index.js';


// -----------------------------------------------------------------------------
// 5. SHOP ITEM REGISTRY
// -----------------------------------------------------------------------------
// Each item has: id, name, desc, price, weight (for weighted pick), sprite,
// onBuy(gs) callback, and optional `limit` (max in inventory or per-run).
// Some items have `available(gs)` gate.

const SHOP_ITEMS = [
  // Seeds
  { id: 'seed_basic',  name: 'Tomato Seed',       desc: 'Standard. Mostly grows.',           price: 40,   weight: 20, sprite: 'seed_packet', category: 'seed',
    onBuy: gs => { gs.seeds.basic++; flashBuff('Seed +1'); } },
  { id: 'seed_gmo',    name: 'GMO Tomato Seed',   desc: 'Faster. Bigger. Unregulated.',      price: 900,  weight: 6,  sprite: 'seed_engineered', category: 'seed',
    onBuy: gs => { gs.seeds.engineered++; flashBuff('GMO Seed +1'); } },

  // Permanent / persistent structural
  { id: 'nutrient_feed', name: 'Nutrient Feed',   desc: 'Unlocks full plant height.',        price: 1500,  weight: 10,  sprite: 'icon_feed', category: 'upgrade',
    available: gs => !gs.upgrades.nutrientFeed,
    onBuy: gs => { gs.upgrades.nutrientFeed = true; flashBuff('Height cap raised'); spawnGlobalPopup('NUTRIENT FEED INSTALLED', '#66ddff'); } },

  // Temporary upgrades (buffs)
  { id: 'grow_fast',   name: 'GrowthGel Pro (30s)', desc: '+35% growth speed.',              price: 180,  weight: 10, sprite: 'icon_growth', category: 'upgrade',
    onBuy: gs => { addBuff('growthSpeed', 30000, 1.35, 'icon_growth', 'Growth +35%'); } },
  { id: 'spawn_up',    name: 'Fertility Pulse (25s)', desc: 'More tomatoes spawn per segment.', price: 220, weight: 9, sprite: 'icon_spawn', category: 'upgrade',
    onBuy: gs => { addBuff('spawnRate', 25000, 1.45, 'icon_spawn', 'Spawn +45%'); } },
  { id: 'bigger_chance', name: 'Premium Pollen (40s)', desc: 'Much higher chance of heirlooms.', price: 260, weight: 8, sprite: 'icon_bigger', category: 'upgrade',
    onBuy: gs => { addBuff('bigChance', 40000, 3.0, 'icon_bigger', 'Big fruit x3'); } },

  // Weapon unlocks (permanent)
  { id: 'unlock_manure', name: 'Manure Cannon™', desc: 'Short-range splash weapon.',         price: 250,  weight: 6,  sprite: 'icon_manure', category: 'weapon',
    available: gs => !gs.weapons.manure.unlocked,
    onBuy: gs => { gs.weapons.manure.unlocked = true; gs.weapons.manure.selected = false; flashBuff('Weapon unlocked'); spawnGlobalPopup('MANURE CANNON ACQUIRED', '#cc8822'); } },
  { id: 'unlock_flame',  name: 'Controlled Burn',  desc: 'Sears off diseased plant parts.',   price: 180,  weight: 6,  sprite: 'icon_flame', category: 'weapon',
    available: gs => !gs.weapons.flame.unlocked,
    onBuy: gs => { gs.weapons.flame.unlocked = true; flashBuff('Weapon unlocked'); spawnGlobalPopup('FLAMETHROWER ACQUIRED', '#ffaa00'); } },
  { id: 'unlock_drone',  name: 'Pesticide Drone Sub.', desc: 'Garden drone. Local attack radius. $4/sec when on.', price: 2000, weight: 10, sprite: 'icon_drone', category: 'weapon',
    available: gs => !gs.weapons.drone.unlocked,
    onBuy: gs => { gs.weapons.drone.unlocked = true; gs.weapons.drone.chargesLeft = 3; flashBuff('SaaS subscribed'); spawnGlobalPopup('AI PESTICIDE DRONE ONLINE', '#66ddff'); } },
  { id: 'launchpad',     name: 'Launch Pad',       desc: 'Required for Nukes. Uses a slot.',  price: 400,  weight: 9,  sprite: 'icon_pad', category: 'utility',
    available: gs =>
      !gs.flags.launchPadPurchased &&
      !gs.weapons.nuke.padPlaced &&
      gs.weapons.nuke.padPending !== true,
    onBuy: gs => {
      gs.flags.launchPadPurchased = true;
      gs.weapons.nuke.padPending = true;
      gs.weapons.nuke.unlocked = true;
      flashBuff('Click a slot to place');
      spawnGlobalPopup('PLACE LAUNCH PAD ON AN EMPTY SLOT', '#ffaa00');
    } },

  // Ammo / strike purchases
  { id: 'nuke_strike',   name: 'Decommissioned Warhead',  desc: 'Collectors item. Probably fine.', price: 750, weight: 0.25, sprite: 'icon_nuke', category: 'weapon',
    available: gs => false,
    onBuy: gs => {} },
  { id: 'laser_core',  name: 'Orbital Laser Core', desc: 'Unlocks orbital laser strikes.', price: 1800, weight: 2, sprite: 'icon_laser', category: 'weapon',
    available: gs => !gs.weapons.laser.unlocked,
    onBuy: gs => { gs.weapons.laser.unlocked = true; flashBuff('Laser core installed'); spawnGlobalPopup('ORBITAL LASER ONLINE', '#66ddff'); } },
  { id: 'assistant', name: ASSISTANT_DESIGN_SPEC.name, desc: 'A proactive retail-therapy assistant with selective judgment.', price: 2800, weight: 1.5, sprite: 'assistant_icon', category: 'utility',
    available: gs => gs.gameTime >= 120000 && !gs.assistant.unlocked,
    onBuy: gs => {
      gs.assistant.unlocked = true;
      gs.assistant.alive = true;
      gs.assistant.name = pick(ASSISTANT_NAME_POOL);
      gs.assistant.designSpec = ASSISTANT_DESIGN_SPEC.summary;
      gs.assistant.x = CFG.shopX - 156;
      gs.assistant.y = CFG.farmTop + 26;
      gs.assistant.state = 'idle';
      gs.assistant.stateTime = 0;
      gs.assistant.speakTimer = 4000;
      gs.assistant.buyTimer = randInt(18000, 35000);
      gs.assistant.targetItemId = null;
      gs.assistant.targetSlotIndex = -1;
      gs.assistant.cursorFx = null;
      gs.assistant.speech = {
        text: 'Hello. I have always wanted to help someone make questionable purchases.',
        timeLeft: 4200,
        maxTime: 4200,
      };
      spawnGlobalPopup('AI ASSISTANT ONLINE', '#aaccff');
    } },
  { id: 'unlock_harvest_drone', name: 'Harvest Drone', desc: 'Auto-harvests ripe tomatoes. Flies to them directly. Bugs will attack it.', price: 5000, weight: 3.5, sprite: 'icon_harvest_drone', category: 'utility',
    available: gs => gs.gameTime >= 180000 && !gs.weapons.harvestDrone.unlocked,
    onBuy: gs => {
      Object.assign(gs.weapons.harvestDrone, {
        unlocked: true,
        active: true,
        x: 240,
        y: 200,
        targetX: 240,
        targetY: 200,
        retargetTimer: 0,
        targetPlantIdx: -1,
        targetSegIdx: -1,
        targetSide: null,
        health: 1.2,
        attackerPestId: null,
        beamFlash: 0,
      });
      flashBuff('Harvest drone deployed');
      spawnGlobalPopup('HARVEST DRONE ONLINE', '#ffcc44');
    } },
  { id: 'upgrade_drone_elite', name: 'Drone Enterprise Upgrade', desc: 'Faster routing and improved service responsiveness.', price: 10000, weight: 4.0, sprite: 'icon_drone', category: 'upgrade',
    available: gs => gs.weapons.drone.unlocked && !gs.upgrades.droneUpgrade,
    onBuy: gs => {
      gs.upgrades.droneUpgrade = true;
      flashBuff('Drone enterprise upgrade installed');
      spawnGlobalPopup('DRONE ENTERPRISE UPGRADE ONLINE', '#66ddff');
    } },

  // Junk (useless, satirical)
  { id: 'duck',   name: 'Rubber Duck',   desc: 'For debugging. Stares back.',    price: 666, weight: 9, sprite: 'icon_duck', category: 'junk',
    onBuy: gs => { gs.junk.push('Rubber Duck'); gs.duckCurse = true; gs.duckCount = (gs.duckCount || 0) + 1; gs.duckGrounds.push({ x: rand(40, CFG.farmRight - 40), y: CFG.groundY + rand(6, 28), wobble: Math.random() * 1000 }); showGagDialog('Rubber Duck', 'You feel uneasy, as though the duck is watching you.\n\nA second thought arrives uninvited: perhaps you purchased it. Perhaps it purchased access to you.'); } },
  { id: 'book',   name: 'Machine Learning for Dummies', desc: 'Late-night miracle workbook. A few pages smell faintly of Boneslie.', price: 30, weight: 9, sprite: 'icon_book', category: 'junk',
    available: gs => !gs.junk.includes('ML Book'),
    onBuy: gs => {
      gs.junk.push('ML Book');
      showGagDialog(
        'Machine Learning for Dummies',
        'This paperback promises leverage, freedom, personal reinvention, and a suspiciously optimized future.\n\nA tiny endorsement on the back simply reads: "Believe bigger. Deploy harder."'
      );
      spawnGlobalPopup('YOU FEEL VAGUELY UPSOLD', '#ffcc66');
    } },
  { id: 'unlock_popup', name: 'Popup Blocker', desc: 'Cuts popup volume by 75%. Costs $20/sec while on.', price: 10000, weight: 1.2, sprite: 'icon_book', category: 'utility',
    available: gs => !gs.weapons.popup.unlocked,
    onBuy: gs => { gs.weapons.popup.unlocked = true; flashBuff('Popup blocker unlocked'); spawnGlobalPopup('POPUP BLOCKER INSTALLED', '#aaccff'); } },
  { id: 'nft',    name: 'Tomato NFT',    desc: 'A JPG of a tomato.',        price: 80, weight: 6, sprite: 'icon_nft', category: 'junk',
    onBuy: gs => { gs.junk.push('Tomato NFT'); showGagDialog('Tomato NFT', 'Ownership has been successfully decoupled from utility.\n\nThe tomato remains stubbornly physical.'); } },
  { id: 'mug',    name: 'Disruption Mug', desc: 'Corporate ceramic with a dead-eyed slogan.', price: 95, weight: 4.5, sprite: 'icon_book', category: 'junk',
    onBuy: gs => { gs.junk.push('Disruption Mug'); showGagDialog('Disruption Mug', 'The mug reads: MOVE FAST AND INVOICE THINGS.\n\nThe coffee tastes faintly of compliance.'); } },
  { id: 'crystal', name: 'Leadership Crystal', desc: 'Warm to the touch. Probably cursed.', price: 180, weight: 3.2, sprite: 'icon_feed', category: 'junk',
    onBuy: gs => { gs.junk.push('Leadership Crystal'); showGagDialog('Leadership Crystal', 'It hums softly and aligns your chakras to quarterly objectives.\n\nYou feel seen by management.'); } },
  { id: 'lanyard', name: 'Executive Lanyard', desc: 'Access to nothing. Status with clip.', price: 120, weight: 4.0, sprite: 'icon_nft', category: 'junk',
    onBuy: gs => { gs.junk.push('Executive Lanyard'); showGagDialog('Executive Lanyard', 'Three people now assume you are important.\n\nNone of them can help you.'); } },
  { id: 'synergy_orb', name: 'Synergy Orb', desc: 'An orb for ideation. No refunds.', price: 260, weight: 2.8, sprite: 'icon_feed', category: 'junk',
    onBuy: gs => { gs.junk.push('Synergy Orb'); showGagDialog('Synergy Orb', 'The orb reveals a strategic truth: nobody knows what the orb does.\n\nIt remains oddly billable.'); } },
  { id: 'ceo_pillow', name: 'CEO Pillow', desc: 'Sleep on thought leadership.', price: 320, weight: 2.5, sprite: 'icon_book', category: 'junk',
    onBuy: gs => { gs.junk.push('CEO Pillow'); showGagDialog('CEO Pillow', 'Stuffed with premium keynote foam.\n\nYou wake with an inexplicable urge to say \"circle back\".'); } },
  { id: 'metaverse_deed', name: 'Metaverse Land Deed', desc: 'Prime swamp in a dead platform.', price: 410, weight: 2.2, sprite: 'icon_nft', category: 'junk',
    onBuy: gs => { gs.junk.push('Metaverse Land Deed'); showGagDialog('Metaverse Land Deed', 'Your parcel features ocean views, impossible zoning, and zero visitors.\n\nProperty taxes remain very real.'); } },
  { id: 'productivity_skull', name: 'Productivity Skull', desc: 'Smiles through deadlines.', price: 690, weight: 1.8, sprite: 'icon_book', category: 'junk',
    onBuy: gs => { gs.junk.push('Productivity Skull'); showGagDialog('Productivity Skull', 'The skull whispers: optimize harder.\n\nIt has no organs, yet somehow still sounds tired.'); } },
  makeJunkItem({ id: 'blockchain_certificate', name: 'Blockchain Tomato Certificate', desc: 'Authenticates your produce spiritually.', price: 240, weight: 3.5, sprite: 'icon_nft',
    body: 'The certificate confirms your tomato once existed on-chain.\n\nThe tomato itself remains aggressively offline.' }),
  makeJunkItem({ id: 'executive_gravel', name: 'Executive Gravel', desc: 'Premium stones for leadership posture.', price: 145, weight: 3.6, sprite: 'icon_feed',
    body: 'The gravel arrives in a velvet pouch.\n\nIt improves neither drainage nor judgment.' }),
  makeJunkItem({ id: 'quantum_stapler', name: 'Quantum Stapler', desc: 'Attaches documents probabilistically.', price: 540, weight: 2.1, sprite: 'icon_book',
    body: 'The stapler both secured and failed to secure your paperwork.\n\nLegal has advised you to proceed cautiously.' }),
  makeJunkItem({ id: 'vision_board_cartridge', name: 'Vision Board Cartridge', desc: 'Refill pack for inspirational throughput.', price: 260, weight: 2.7, sprite: 'icon_bigger',
    body: 'Each cartridge contains twelve interchangeable future selves.\n\nNone of them know how to file taxes.' }),
  makeJunkItem({ id: 'premium_empty_box', name: 'Premium Empty Box', desc: 'Luxury packaging with no distractions inside.', price: 310, weight: 2.4, sprite: 'icon_pad',
    body: 'The box is meticulously empty.\n\nA consultant assures you this is where the margin lives.' }),
  makeJunkItem({ id: 'founder_figurine', name: 'Founder Figurine', desc: 'Collectible optimism cast in resin.', price: 470, weight: 2.3, sprite: 'icon_drone',
    body: 'The figurine points toward market domination.\n\nIts tiny base is already pivoting.' }),
  makeJunkItem({ id: 'compliance_candle', name: 'Compliance Candle', desc: 'Smells like audit-ready serenity.', price: 230, weight: 2.9, sprite: 'icon_flame',
    body: 'The label promises notes of sandalwood, policy, and measured risk.\n\nIt mostly smells like fear.' }),
  makeJunkItem({ id: 'motivational_brick', name: 'Motivational Brick', desc: 'Dense encouragement for hard pivots.', price: 190, weight: 3.8, sprite: 'icon_book',
    body: 'The brick is engraved with the phrase "ship harder."\n\nIt is useful only as a conversation-ending device.' }),
  makeJunkItem({ id: 'smart_pebble', name: 'Smart Pebble', desc: 'Bluetooth-ready in spirit only.', price: 125, weight: 3.4, sprite: 'icon_nft',
    body: 'The pebble pairs with nothing.\n\nIt still requests firmware updates.' }),
  makeJunkItem({ id: 'innovation_spoon', name: 'Innovation Spoon', desc: 'Scoops strategy at enterprise scale.', price: 170, weight: 3.1, sprite: 'icon_feed',
    body: 'The spoon is marketed as a platform.\n\nIt remains disappointingly spoon-shaped.' }),


  // Hidden victory-condition shares (rare, expensive, not explained)
  { id: 'share_xai',    name: 'xAI Share',      desc: 'A premium opportunity in destiny.', price: 12000, weight: 0.35, sprite: 'share_xai', category: 'share',
    onBuy: gs => { gs.portfolio.xai = (gs.portfolio.xai || 0) + 1; flashBuff('xAI share acquired'); spawnGlobalPopup('PORTFOLIO UPDATED', '#ff44aa'); } },
  { id: 'share_amazon', name: 'Amazon Share',   desc: 'Own a fraction of efficient logistics.', price: 10500, weight: 0.45, sprite: 'share_amazon', category: 'share',
    onBuy: gs => { gs.portfolio.amazon = (gs.portfolio.amazon || 0) + 1; flashBuff('Amazon share acquired'); spawnGlobalPopup('PORTFOLIO UPDATED', '#ffaa00'); } },
  { id: 'share_nvidia', name: 'Nvidia Share',   desc: 'The future runs hot.', price: 15000, weight: 0.28, sprite: 'share_nvidia', category: 'share',
    onBuy: gs => { gs.portfolio.nvidia = (gs.portfolio.nvidia || 0) + 1; flashBuff('Nvidia share acquired'); spawnGlobalPopup('PORTFOLIO UPDATED', '#66ddff'); } },
  { id: 'share_claude', name: 'Claude Share',   desc: 'Alignment with upside.', price: 11000, weight: 0.38, sprite: 'share_claude', category: 'share',
    onBuy: gs => { gs.portfolio.claude = (gs.portfolio.claude || 0) + 1; flashBuff('Claude share acquired'); spawnGlobalPopup('PORTFOLIO UPDATED', '#aaccff'); } },
  { id: 'share_google', name: 'Google Share',   desc: 'Search for meaning in value.', price: 13000, weight: 0.32, sprite: 'share_google', category: 'share',
    onBuy: gs => { gs.portfolio.google = (gs.portfolio.google || 0) + 1; flashBuff('Google share acquired'); spawnGlobalPopup('PORTFOLIO UPDATED', '#66ff66'); } },

  // Permanent dimension upgrades
  { id: 'upgrade_ripen', name: 'Ripening Catalyst', desc: 'Tomatoes ripen 20% faster.', price: 420, weight: 4, sprite: 'icon_spawn', category: 'upgrade',
    onBuy: gs => { gs.upgrades.tomatoGrowthRate += 0.20; flashBuff('Tomato growth +20%'); } },
  { id: 'upgrade_shelf', name: 'Shelf-Life Serum', desc: 'Tomatoes last 30% longer before rot.', price: 480, weight: 4, sprite: 'icon_bigger', category: 'upgrade',
    onBuy: gs => { gs.upgrades.rotWindow += 0.30; flashBuff('Rot window +30%'); } },
  { id: 'upgrade_resist', name: 'Pest Barrier', desc: 'Plants resist 18% of pest damage.', price: 520, weight: 4, sprite: 'icon_feed', category: 'upgrade',
    onBuy: gs => { gs.upgrades.pestResistance += 0.18; flashBuff('Pest resistance +18%'); } },
  { id: 'upgrade_gold', name: 'Golden Cultivar', desc: 'Higher heirloom chance.', price: 560, weight: 3.5, sprite: 'icon_bigger', category: 'upgrade',
    onBuy: gs => { gs.upgrades.goldChance += 0.10; flashBuff('Gold chance +10%'); } },
];

// Pools weighted by shop context (e.g. weapon-unlocks should still appear but not dominate).
function rollShopOffer(gs) {
  const hasShare = Object.values(gs.portfolio || {}).some(v => v > 0);
  const eligible = SHOP_ITEMS.filter(it => {
    if (it.category === 'share' && hasShare) return false;
    if (it.category === 'weapon' && gs.shopPurchases && gs.shopPurchases[it.id]) return false;
    return !it.available || it.available(gs);
  });
  if (!eligible.length) return null;
  const weighted = eligible.map(it => {
    let weight = it.weight;
    if (it.id === 'duck' && gs.duckCurse) weight *= (9 + (gs.duckCount || 0) * 4);
    // Increase share frequency after 4 minutes
    if (it.category === 'share' && gs.gameTime >= 240000) {
      weight *= 6;
    }
    return { it, weight };
  });
  const total = weighted.reduce((s, entry) => s + entry.weight, 0);
  if (total <= 0) return weighted[weighted.length - 1].it;
  let r = Math.random() * total;
  for (const entry of weighted) {
    r -= entry.weight;
    if (r <= 0) return entry.it;
  }
  return weighted[weighted.length - 1].it;
}


// -----------------------------------------------------------------------------
// 7. UTILITIES
// -----------------------------------------------------------------------------

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function aabb(x, y, box) {
  return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
}

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(Math.floor(n));
  if (v >= 1e9) return sign + '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return sign + '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return sign + '$' + (v / 1e3).toFixed(1) + 'k';
  return sign + '$' + v;
}

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function makeJunkItem({ id, name, desc, price, weight, sprite, body }) {
  return {
    id,
    name,
    desc,
    price,
    weight,
    sprite,
    category: 'junk',
    onBuy: gs => {
      gs.junk.push(name);
      showGagDialog(name, body);
    }
  };
}


function hasMLBook() {
  return GameState.junk.includes('ML Book');
}

function hasDuckCurse() {
  return !!GameState.duckCurse;
}

function getCorruptionPressure() {
  let rotten = 0;
  let diseased = 0;
  for (const plant of GameState.plants) {
    if (!plant) continue;
    for (const seg of plant.segments) {
      if (seg.diseased) diseased++;
      for (const side of ['L', 'R']) {
        const t = seg.fruits[side];
        if (t && t.state === 'rotten') rotten++;
      }
    }
  }
  const modifier = clamp(1 + rotten * 0.06 + diseased * 0.12, 1, 3.2);
  return { rotten, diseased, modifier };
}

const STOCK_ENDINGS = {
  xai: {
    name: 'xAI Share / Shareholder Expeditionary Program',
  },
  amazon: {
    name: 'Amazon Share / Another Successful Financial Year',
  },
  nvidia: {
    name: 'NVIDIA Share / Infinite Monkey Benchmark',
  },
  claude: {
    name: 'Claude Share / Constitutional Service',
  },
  google: {
    name: 'Google Share / Index of the Soul',
  }
};

function ownedShares() {
  return Object.entries(GameState.portfolio || {}).filter(([, v]) => v > 0).map(([k]) => k);
}

function hasAnyShare() {
  return ownedShares().length > 0;
}

function getShareEnding() {
  const owned = ownedShares();
  if (owned.length === 0) return null;
  return STOCK_ENDINGS[pick(owned)];
}

const ENDING_DEFINITIONS = {
  cobalt_mines: { id: 'cobalt_mines', name: 'Cobalt Mines / Patriotic Mineral Service', category: 'fail', dir: 'assets/endings/cobalt_mines', frameCount: 1 },
  share_xai: { id: 'share_xai', name: 'xAI Share / Shareholder Expeditionary Program', category: 'share', dir: 'assets/endings/share_xai', frameCount: 5 },
  share_amazon: { id: 'share_amazon', name: 'Amazon Share / Another Successful Financial Year', category: 'share', dir: 'assets/endings/share_amazon', frameCount: 5 },
  share_nvidia: { id: 'share_nvidia', name: 'NVIDIA Share / Infinite Monkey Benchmark', category: 'share', dir: 'assets/endings/share_nvidia', frameCount: 5 },
  share_claude: { id: 'share_claude', name: 'Claude Share / Constitutional Service', category: 'share', dir: 'assets/endings/share_claude', frameCount: 5 },
  share_google: { id: 'share_google', name: 'Google Share / Index of the Soul', category: 'share', dir: 'assets/endings/share_google', frameCount: 5 },
  quackening: { id: 'quackening', name: 'The Quackening', category: 'special', dir: 'assets/endings/quackening', frameCount: 5 },
  mutant_apocalypse: { id: 'mutant_apocalypse', name: 'Mutant Tomato Apocalypse / Fruit of the Abyss', category: 'special', dir: 'assets/endings/mutant_apocalypse', frameCount: 5 },
  no_planting: { id: 'no_planting', name: 'No Planting / Not Yet Wired', category: 'good', dir: 'assets/endings/no_planting', frameCount: 5 },
  modest_solvency: { id: 'modest_solvency', name: 'Modest Solvency', category: 'good', dir: 'assets/endings/modest_solvency', frameCount: 5 },
  not_yet_claimed: { id: 'not_yet_claimed', name: 'Not Yet Claimed', category: 'good', dir: 'assets/endings/not_yet_claimed', frameCount: 5 },
};

function makeEndingState(id, frameCountOverride) {
  const base = ENDING_DEFINITIONS[id];
  if (!base) return null;
  return {
    ...base,
    frameCount: frameCountOverride || base.frameCount || 5,
    frameIndex: 0,
    complete: false,
  };
}

function getDimensionSnapshot(engineered) {
  const bigBuff = getBuffMultiplier('bigChance');
  const baseHeirloom = engineered ? CFG.tomato.engineeredHeirloomChance : CFG.tomato.heirloomChance;
  const baseCocktail = engineered ? CFG.tomato.engineeredCocktailChance : CFG.tomato.cocktailChance;
  const largeChance = clamp((baseHeirloom + baseCocktail) * bigBuff + GameState.upgrades.largeChance, 0, 0.95);
  const goldChance = clamp(baseHeirloom * bigBuff + GameState.upgrades.goldChance, 0, 0.95);
  const plantGrowth = getBuffMultiplier('growthSpeed') * (1 + GameState.upgrades.plantGrowthRate) * (engineered ? (1/CFG.plant.engineeredGrowthBonus) : 1);
  const tomatoGrowth = (1 + GameState.upgrades.tomatoGrowthRate) * (engineered ? 1.15 : 1);
  const pestResistance = clamp(GameState.upgrades.pestResistance + (engineered ? 0.10 : 0), 0, 0.80);
  const rotWindow = (1 + GameState.upgrades.rotWindow) * (engineered ? 0.70 : 1.0);
  return { largeChance, goldChance, plantGrowth, tomatoGrowth, pestResistance, rotWindow };
}

// -----------------------------------------------------------------------------
// 8. SPRITE RENDERING
// -----------------------------------------------------------------------------

function getSpriteFrame(key, timeMs) {
  const sp = SPRITES[key];
  if (!sp || !sp.frames || !sp.frames.length) return null;
  if (sp.speed === 0 || sp.frames.length === 1) return sp.frames[0];
  const idx = Math.floor(timeMs / sp.speed) % sp.frames.length;
  return sp.frames[idx];
}

function drawSprite(ctx, key, x, y, scale, opts) {
  opts = opts || {};
  const frame = getSpriteFrame(key, opts.time || GameState.gameTime);
  if (!frame) return;
  drawSpriteMatrix(ctx, frame, x, y, scale, opts);
}

let globalSpriteCache = new WeakMap();

function clearSpriteCache() {
  globalSpriteCache = new WeakMap();
}

function getCachedCanvas(frame, tint) {
  let cacheForFrame = globalSpriteCache.get(frame);
  if (!cacheForFrame) {
    cacheForFrame = new Map();
    globalSpriteCache.set(frame, cacheForFrame);
  }
  const tintKey = tint ? JSON.stringify(tint) : 'none';
  let canvas = cacheForFrame.get(tintKey);
  if (!canvas) {
    const h = frame.length;
    const w = frame[0].length;
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    for (let py = 0; py < h; py++) {
      const row = frame[py];
      for (let px = 0; px < w; px++) {
        let idx = row[px];
        if (idx === 0) continue;
        if (tint && tint[idx] != null) idx = tint[idx];
        const colour = PALETTE[idx];
        if (!colour) continue;
        ctx.fillStyle = colour;
        ctx.fillRect(px, py, 1, 1);
      }
    }
    cacheForFrame.set(tintKey, canvas);
  }
  return canvas;
}

function drawSpriteMatrix(ctx, frame, x, y, scale, opts) {
  opts = opts || {};
  const alpha = opts.alpha == null ? 1 : opts.alpha;
  const cached = getCachedCanvas(frame, opts.tint || null);
  if (alpha !== 1) { ctx.save(); ctx.globalAlpha = alpha; }
  
  // Math.floor coordinates to avoid tearing
  ctx.drawImage(cached, Math.floor(x), Math.floor(y), cached.width * scale, cached.height * scale);
  
  if (alpha !== 1) ctx.restore();
}

function scaleFor(key, targetPx) {
  const sp = SPRITES[key];
  if (!sp) return 1;
  const native = sp.frames[0][0].length;
  return Math.max(1, Math.floor(targetPx / native));
}

// -----------------------------------------------------------------------------
// 9. PARTICLES, POPUPS, DEBRIS
// -----------------------------------------------------------------------------

function spawnBurst(x, y, count, colours) {
  const pool = colours || ['#ff4444', '#ffaa00', '#ffffff'];
  for (let i = 0; i < count; i++) {
    GameState.particles.push({
      x, y,
      vx: rand(-0.5, 0.5),
      vy: rand(-0.6, -0.1),
      life: 500 + Math.random()*200,
      maxLife: 700,
      colour: pick(pool),
      size: randInt(3, 5),
    });
  }
}

function spawnPoof(x, y) {
  for (let i = 0; i < 6; i++) {
    GameState.particles.push({
      x, y,
      vx: rand(-0.2, 0.2), vy: rand(-0.3, 0),
      life: 400, maxLife: 400,
      colour: '#666677',
      size: 4,
    });
  }
}

function spawnShockwave(x, y, radius, colours) {
  const pool = colours || ['#ffaa00', '#ff4444', '#ffdd00', '#ffffff'];
  const n = Math.floor(radius * 0.8);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    const sp = rand(0.4, 1.0);
    GameState.particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 700, maxLife: 700,
      colour: pick(pool),
      size: randInt(4, 7),
    });
  }
}

function spawnPopup(x, y, text, colour) {
  GameState.popups.push({ x, y, text, colour: colour || '#44ff44', life: 1200, maxLife: 1200 });
}

function spawnGlobalPopup(text, colour) {
  // centred at top of farm area, drifts up
  spawnPopup(CFG.farmRight/2, CFG.farmTop + 60, text, colour || '#ffaa00');
}

function spawnFallingDebris(x, y, spriteKey) {
  GameState.fallingDebris.push({
    x, y,
    vx: rand(-0.2, 0.2), vy: rand(-0.3, -0.1),
    rot: 0, rotSpd: rand(-0.01, 0.01),
    life: 1400, maxLife: 1400,
    spriteKey
  });
}

function updateParticles(dt) {
  for (const p of GameState.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.0015 * dt;
    p.life -= dt;
  }
  GameState.particles = GameState.particles.filter(p => p.life > 0);

  for (const p of GameState.popups) {
    p.y -= 0.04 * dt;
    p.life -= dt;
  }
  GameState.popups = GameState.popups.filter(p => p.life > 0);

  for (const d of GameState.fallingDebris) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 0.003 * dt;
    d.rot += d.rotSpd * dt;
    d.life -= dt;
  }
  GameState.fallingDebris = GameState.fallingDebris.filter(d => d.life > 0 && d.y < CFG.canvas.h + 50);
}

function drawParticles(ctx) {
  for (const p of GameState.particles) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.colour;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const p of GameState.popups) {
    const a = Math.min(1, p.life / 400);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.colour;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  for (const d of GameState.fallingDebris) {
    const a = Math.min(1, d.life / 400);
    ctx.globalAlpha = a;
    const s = scaleFor(d.spriteKey, 22);
    drawSprite(ctx, d.spriteKey, d.x, d.y, s, { alpha: a });
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}


// -----------------------------------------------------------------------------
// 10. BUFFS (temporary upgrade effects)
// -----------------------------------------------------------------------------

function addBuff(type, durationMs, multiplier, sprite, label) {
  // If the same type already exists, extend it and refresh the multiplier
  const existing = GameState.buffs.find(b => b.type === type);
  if (existing) {
    existing.timeLeft = durationMs;
    existing.maxTime = durationMs;
    existing.multiplier = multiplier;
    return;
  }
  GameState.buffs.push({
    type, timeLeft: durationMs, maxTime: durationMs,
    multiplier, sprite, name: label,
  });
}

function getBuffMultiplier(type) {
  const b = GameState.buffs.find(b => b.type === type);
  return b ? b.multiplier : 1;
}

function updateBuffs(dt) {
  for (const b of GameState.buffs) b.timeLeft -= dt;
  GameState.buffs = GameState.buffs.filter(b => b.timeLeft > 0);
}

function flashBuff(text) {
  GameState.buffFlash = { text, age: 0 };
}

function showGagDialog(title, body) {
  GameState.gagDialog = { title, body, age: 0, duration: 3200 };
}

function adCloseBox(ad) {
  const cbSize = CFG.ad.closeBtnSize;
  return { x: ad.x + ad.w - cbSize - 4, y: ad.y + 4, w: cbSize, h: cbSize };
}

// -----------------------------------------------------------------------------
// 11. LAYOUT HELPERS
// -----------------------------------------------------------------------------

function slotCenterX(slotIndex) {
  const margin = 60;
  const usableW = CFG.farmRight - margin * 2;
  const spacing = usableW / (CFG.slotCount - 1);
  return margin + spacing * slotIndex;
}

function getSlotBox(i) {
  const x = slotCenterX(i) - CFG.slotSize/2;
  const y = CFG.groundY + 4;
  return { x, y, w: CFG.slotSize, h: CFG.slotSize };
}

function getSlotClickBox(i) {
  // Expanded clickable area (for planting)
  const x = slotCenterX(i) - CFG.slotSize/2 - 6;
  const y = CFG.groundY - 4;
  return { x, y, w: CFG.slotSize + 12, h: CFG.slotSize + 12 };
}

// -----------------------------------------------------------------------------
// 12. PLANT & TOMATO MODELS
// -----------------------------------------------------------------------------

class Tomato {
  constructor(engineered) {
    this.engineered = !!engineered;
    this.age = 0;
    this.baseType = this.rollType();
    this.sizeTier = this.rollSizeTier();
    this.state = 'sprout';
    this.rotAcceleration = 1;
    this.manureBoost = 0;
  }
  rollType() {
    const bigMult = getBuffMultiplier('bigChance');
    const baseHeirloom = this.engineered ? CFG.tomato.engineeredHeirloomChance : CFG.tomato.heirloomChance;
    const baseCocktail = this.engineered ? CFG.tomato.engineeredCocktailChance : CFG.tomato.cocktailChance;
    const heirloom = clamp(baseHeirloom * bigMult + GameState.upgrades.goldChance, 0, 0.85);
    const cocktail = clamp(baseCocktail * bigMult + GameState.upgrades.largeChance * 0.5, 0, 0.60);
    const r = Math.random();
    if (r < cocktail) return 'cocktail';
    if (r < cocktail + heirloom) return 'heirloom';
    return 'roma';
  }
  rollSizeTier() {
    const largeChance = clamp(CFG.tomato.sizeChances.large + GameState.upgrades.largeChance * 0.6 + (this.engineered ? 0.06 : 0), 0.02, 0.45);
    const smallChance = Math.max(0.08, CFG.tomato.sizeChances.small - GameState.upgrades.largeChance * 0.2);
    const r = Math.random();
    if (r < largeChance) return 'large';
    if (r < largeChance + smallChance) return 'small';
    return 'medium';
  }
  update(dt) {
    const growthMult = Math.min(1.75, (1 + GameState.upgrades.tomatoGrowthRate) * (1 + this.manureBoost) * (this.engineered ? 1.15 : 1));
    this.age += dt * this.rotAcceleration * growthMult;
    this.manureBoost = Math.max(0, this.manureBoost - dt * 0.0002);
    const sproutAt = CFG.tomato.sproutMs;
    const greenAt = CFG.tomato.greenMs;
    const ripeAt = CFG.tomato.ripeMs * (1 + GameState.upgrades.rotWindow) * (this.engineered ? 0.70 : 1.0) * (this.radiated ? 0.72 : 1);
    if (this.state === 'sprout' && this.age >= sproutAt) this.state = 'green';
    if (this.state === 'green' && this.age >= greenAt) this.state = 'ripe';
    if (this.state === 'ripe' && this.age >= ripeAt) this.state = 'rotten';
  }
  getRenderSize() {
    if (this.state === 'sprout') return 18;
    if (this.state === 'rotten') return Math.max(18, CFG.tomato.sizes[this.sizeTier] - 4);
    return CFG.tomato.sizes[this.sizeTier];
  }
  getValue() {
    if (this.state !== 'ripe') return 0;
    let v = CFG.tomato.values[this.baseType] * CFG.tomato.sizeValueMults[this.sizeTier];
    if (this.engineered) v *= CFG.tomato.engineeredValueMult;
    return Math.floor(v);
  }
  getSprite() {
    if (this.state === 'sprout') return 'sprout';
    if (this.state === 'green') return 'tomato_green';
    if (this.state === 'rotten') return 'tomato_rotten';
    if (this.baseType === 'heirloom') return 'tomato_heirloom';
    if (this.baseType === 'cocktail') return 'tomato_cocktail';
    return 'tomato_roma';
  }
}

class Plant {
  constructor(slotIndex, engineered) {
    this.slotIndex = slotIndex;
    this.engineered = !!engineered;
    this.segments = [];     // each: { fruits: {L: Tomato|null, R: Tomato|null},
                            //         health, maxHealth, diseased, diseaseAge, spawnTimer, radiated }
    this.growthTimer = 0;
    this.infectedByWhitefly = false;
    this.infectedByPsyllid = false;
    this.radiated = false;
    this.addSegment(true); // initial base segment
  }

  getMaxSegments() {
    return GameState.upgrades.nutrientFeed ? CFG.plant.maxSegmentsWithFeed : CFG.plant.maxSegmentsDefault;
  }

  addSegment(isBase) {
    if (this.segments.length >= this.getMaxSegments()) return;
    const baseHealth = this.engineered ? Math.ceil(CFG.plant.segmentHealth * 1.5) : CFG.plant.segmentHealth;
    const seg = {
      fruits: { L: null, R: null },
      health: baseHealth,
      maxHealth: baseHealth,
      diseased: false,
      diseaseAge: 0,
      spawnTimer: isBase ? CFG.plant.tomatoSpawnIntervalMs : CFG.plant.tomatoSpawnIntervalMs * 0.5,
    };
    this.segments.push(seg);
  }

  update(dt) {
    // Growth
    if (this.segments.length < this.getMaxSegments()) {
      const rawGrowSpeedMult = getBuffMultiplier('growthSpeed') *
        (1 + GameState.upgrades.plantGrowthRate) *
        (this.infectedByWhitefly ? 0.4 : 1) *
        (this.engineered ? (1/CFG.plant.engineeredGrowthBonus) : 1);
      const earlyCap = GameState.gameTime < 240000 ? 1.18 : (GameState.gameTime < 420000 ? 1.35 : 1.65);
      const growSpeedMult = Math.min(rawGrowSpeedMult, earlyCap);
      this.growthTimer += dt * growSpeedMult;
      while (this.growthTimer >= CFG.plant.baseGrowMs && this.segments.length < this.getMaxSegments()) {
        this.growthTimer -= CFG.plant.baseGrowMs;
        this.addSegment(false);
      }
    }

    // Tomato spawning (continues producing after first batch)
    const spawnMult = getBuffMultiplier('spawnRate');
    const engineeredSpawn = this.engineered ? CFG.plant.engineeredSpawnBonus : 1;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (seg.diseased) continue; // diseased segments don't spawn fruit
      seg.spawnTimer -= dt;
      if (seg.spawnTimer <= 0) {
        seg.spawnTimer = CFG.plant.tomatoSpawnIntervalMs / spawnMult;
        // Try to spawn a tomato on an empty side
        const empties = [];
        if (!seg.fruits.L) empties.push('L');
        if (!seg.fruits.R) empties.push('R');
        if (empties.length > 0 && i > 0) { // no fruit on bottom segment (structural)
          const chance = clamp(CFG.plant.tomatoSpawnChance * spawnMult * engineeredSpawn + GameState.upgrades.largeChance * 0.08, 0, 0.95);
          if (Math.random() < chance) {
            const side = pick(empties);
            if (this.radiated && Math.random() < 0.05) {
              const mx = this.getScreenX() + (side === 'L' ? -18 : 18);
              const my = this.getScreenYForSegment(i) - 8;
              GameState.pendingMutants.push({
                plantSlot: this.slotIndex,
                segIndex: i,
                side,
                x: mx,
                y: my,
                timeLeft: 6000,
                maxTime: 6000,
              });
              spawnPopup(mx, my - 6, 'MUTATING...', '#8cff44');
            } else {
              seg.fruits[side] = new Tomato(this.engineered);
              if (this.radiated) seg.fruits[side].radiated = true;
            }
          }
        }
      }
    }

    // Tomato updates (per-tomato rot / ripening, plus rotting-on-tree UBI penalty)
    for (const seg of this.segments) {
      for (const side of ['L', 'R']) {
        const t = seg.fruits[side];
        if (t) {
          if (this.radiated) t.radiated = true;
          t.update(dt);
        }
      }
    }

    // Disease spread
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (!seg.diseased) continue;
      seg.diseaseAge += dt;
      // Spread to neighbours after spreadMs
      if (seg.diseaseAge > CFG.disease.spreadMs && seg.diseaseAge - dt <= CFG.disease.spreadMs) {
        if (i + 1 < this.segments.length && !this.segments[i+1].diseased) {
          this.segments[i+1].diseased = true;
        }
        if (i - 1 >= 0 && !this.segments[i-1].diseased) {
          this.segments[i-1].diseased = true;
        }
      }
      // If not burnt in time → segment dies and everything above collapses
      if (seg.diseaseAge > CFG.disease.killMs) {
        this.collapseAt(i, 'disease');
        return;
      }
    }
  }

  // Damage a specific segment; if it breaks, collapse everything above
  damageSegment(segIdx, amount) {
    if (segIdx < 0 || segIdx >= this.segments.length) return;
    const seg = this.segments[segIdx];
    const resist = clamp(GameState.upgrades.pestResistance + (this.engineered ? 0.10 : 0), 0, 0.80);
    if (Math.random() < resist * 0.45) {
      spawnPopup(this.getScreenX(), this.getScreenYForSegment(segIdx), 'RESIST', '#66ddff');
      return;
    }
    seg.health -= Math.max(1, amount * (1 - resist * 0.35));
    if (seg.health <= 0) {
      this.collapseAt(segIdx, 'eaten');
    }
  }

  // Everything at segIdx and above is destroyed
  collapseAt(segIdx, reason) {
    const lost = this.segments.length - segIdx;
    const x = this.getScreenX();
    // Emit debris + falling tomatoes
    for (let i = segIdx; i < this.segments.length; i++) {
      const y = this.getScreenYForSegment(i);
      spawnFallingDebris(x - 12, y, 'stem');
      const seg = this.segments[i];
      if (seg.fruits.L) spawnFallingDebris(x - CFG.tomato.renderSize, y, seg.fruits.L.getSprite());
      if (seg.fruits.R) spawnFallingDebris(x, y, seg.fruits.R.getSprite());
    }
    this.segments.length = segIdx;
    GameState.stats.plantsCollapsed++;
    spawnBurst(x, this.getScreenYForSegment(segIdx) + 10, 14, ['#553311', '#ff4444', '#226622']);
    if (reason === 'disease') {
      spawnGlobalPopup('BLIGHT CLAIMED ' + lost + ' SEGMENTS', '#ff9933');
    } else if (reason === 'eaten') {
      spawnGlobalPopup('STRUCTURAL COLLAPSE: -' + lost + ' SEGMENTS', '#ff4444');
    } else if (reason === 'burn') {
      spawnGlobalPopup('BURNED -' + lost + ' SEGMENTS', '#ffaa00');
    } else if (reason === 'blast') {
      spawnGlobalPopup('PLANT VAPORISED', '#6b2f9e');
    } else if (reason === 'locust') {
      spawnGlobalPopup('VC LOCUST SHREDDED A COLUMN', '#ff4444');
    }

    // If the plant is fully gone (no segments), uproot it
    if (this.segments.length === 0) {
      GameState.plants[this.slotIndex] = null;
    }
  }

  onPsyllidInfection() {
    this.infectedByPsyllid = true;
    for (const seg of this.segments) {
      for (const side of ['L', 'R']) {
        const t = seg.fruits[side];
        if (t && t.state === 'sprout') t.baseType = 'roma';
      }
    }
  }

  // Returns array of ripe-tomato refs for targeting
  getRipeTomatoRefs() {
    const refs = [];
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      for (const side of ['L', 'R']) {
        const t = seg.fruits[side];
        if (t && (t.state === 'ripe' || t.state === 'green')) refs.push({ plant: this, seg, i, side, tomato: t });
      }
    }
    return refs;
  }

  getScreenX() { return slotCenterX(this.slotIndex); }

  getScreenYForSegment(i) {
    return CFG.groundY - (i + 1) * CFG.plant.segmentHeight;
  }
}


// -----------------------------------------------------------------------------
// 13. PESTS
// -----------------------------------------------------------------------------

const PEST_CFG = {
  whitefly:  { hits: 1, size: 32 },
  fruitworm: { hits: 2, size: 28 },
  psyllid:   { hits: 5, size: 32 },
  flea:      { hits: 2, size: 28 },
  locust:    { hits: 12, size: 128 },
  blight:    { hits: 1, size: 28 },
  ai_roach:  { hits: 2, size: 32 },
  mutant:    { hits: 5, size: 34 },
};

class Pest {
  constructor(type) {
    this.type = type;
    this.x = 0; this.y = 0;
    this.hitsRemaining = PEST_CFG[type].hits;
    this.size = PEST_CFG[type].size;
    this.dead = false;
    this.age = 0;
    this.flashTime = 0;
    this.slowTime = 0;   // ms of slowed movement (from manure)
    this.radiated = false;
  }
  hit() {
    this.hitsRemaining -= this.radiated ? 0.5 : 1;
    this.flashTime = 100;
    if (this.hitsRemaining <= 0) {
      this.dead = true;
      GameState.stats.pestsKilled++;
      spawnBurst(this.x + this.size/2, this.y + this.size/2, 10);
    }
  }
  getBox() { return { x: this.x, y: this.y, w: this.size, h: this.size }; }
  center() { return { x: this.x + this.size/2, y: this.y + this.size/2 }; }
  update(dt) {
    this.age += dt;
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.slowTime = Math.max(0, this.slowTime - dt);
  }
  draw(ctx) {}
  speedMult() { return this.slowTime > 0 ? 0.3 : 1; }
}

class Whitefly extends Pest {
  constructor(targetPlant) {
    super('whitefly');
    this.target = targetPlant;
    this.attached = false;
    this.x = Math.random() < 0.5 ? -this.size : CFG.farmRight;
    this.y = rand(CFG.farmTop + 40, CFG.groundY - 200);
    this.phaseOffset = Math.random() * Math.PI * 2;
  }
  update(dt) {
    super.update(dt);
    if (!this.target || !GameState.plants[this.target.slotIndex] || GameState.plants[this.target.slotIndex] !== this.target) {
      this.dead = true; return;
    }
    if (!this.attached) {
      const tx = this.target.getScreenX() - this.size/2;
      const ty = this.target.getScreenYForSegment(Math.max(0, this.target.segments.length - 1));
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        this.attached = true;
        this.target.infectedByWhitefly = true;
      } else {
        const speed = 0.12 * this.speedMult();
        this.x += (dx / dist) * speed * dt + Math.sin(this.age / 120 + this.phaseOffset) * 0.8;
        this.y += (dy / dist) * speed * dt;
      }
    } else {
      const tx = this.target.getScreenX() - this.size/2;
      const ty = this.target.getScreenYForSegment(Math.max(0, this.target.segments.length - 1)) - 10;
      this.x += (tx - this.x) * 0.05;
      this.y = ty + Math.sin(this.age / 200) * 6;
    }
  }
  draw(ctx) {
    const scale = scaleFor('whitefly', this.size);
    drawSprite(ctx, 'whitefly', this.x, this.y, scale, {
      tint: this.flashTime > 0 ? { 1: 4, 7: 4 } : null
    });
  }
  onDeath() { if (this.target) this.target.infectedByWhitefly = false; }
}

// Yellow worm: seeks a tomato, consumes it over time, duplicates into a new one
class Fruitworm extends Pest {
  constructor(ref) {
    super('fruitworm');
    this.ref = ref;        // { plant, seg, i, side, tomato }
    this.attached = false;
    this.consumeTimer = 0;
    this.consumeMs = 3000;
    this.x = rand(100, CFG.farmRight - 100);
    this.y = CFG.farmTop;
  }
  stillValidTarget() {
    const { plant, i, side } = this.ref;
    if (!plant || !GameState.plants[plant.slotIndex] || GameState.plants[plant.slotIndex] !== plant) return false;
    if (i >= plant.segments.length) return false;
    const seg = plant.segments[i];
    const t = seg.fruits[side];
    return t === this.ref.tomato && (t.state === 'green' || t.state === 'ripe');
  }
  update(dt) {
    super.update(dt);
    if (!this.stillValidTarget()) {
      // Retarget to another tomato on any plant
      const newRef = pickFreshTomatoTarget();
      if (!newRef) { this.dead = true; return; }
      this.ref = newRef;
      this.attached = false;
      this.consumeTimer = 0;
    }
    const { plant, i, side } = this.ref;
    const tomatoX = plant.getScreenX() + (side === 'L' ? -24 : 0);
    const tomatoY = plant.getScreenYForSegment(i);
    if (!this.attached) {
      const dx = tomatoX - this.x, dy = tomatoY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        this.attached = true;
      } else {
        const speed = 0.15 * this.speedMult();
        this.x += (dx / dist) * speed * dt;
        this.y += (dy / dist) * speed * dt;
      }
    } else {
      this.x = tomatoX;
      this.y = tomatoY;
      this.consumeTimer += dt;
      if (this.consumeTimer >= this.consumeMs) {
        // Consume the tomato: destroy it
        plant.segments[i].fruits[side] = null;
        spawnPoof(tomatoX + 14, tomatoY + 14);
        spawnPopup(tomatoX + 14, tomatoY, 'EATEN', '#ff9933');
        // Duplicate: spawn another worm aimed at a DIFFERENT tomato
        const newRef = pickFreshTomatoTarget(this.ref);
        if (newRef) {
          const dup = new Fruitworm(newRef);
          dup.x = tomatoX; dup.y = tomatoY;
          dup.hitsRemaining = PEST_CFG.fruitworm.hits;
          GameState.pests.push(dup);
        }
        // Retarget self (if possible) to new tomato, or die
        const mine = pickFreshTomatoTarget(this.ref);
        if (mine) {
          this.ref = mine;
          this.attached = false;
          this.consumeTimer = 0;
        } else {
          this.dead = true;
        }
      }
    }
  }
  draw(ctx) {
    const scale = scaleFor('fruitworm', this.size);
    drawSprite(ctx, 'fruitworm', this.x, this.y, scale, {
      tint: this.flashTime > 0 ? { 11: 7, 13: 7 } : null
    });
  }
}

// Preferentially pick a tomato OTHER than the given ref's tomato
function pickFreshTomatoTarget(avoidRef) {
  const candidates = [];
  for (const plant of GameState.plants) {
    if (!plant) continue;
    for (let i = 1; i < plant.segments.length; i++) {
      const seg = plant.segments[i];
      for (const side of ['L','R']) {
        const t = seg.fruits[side];
        if (t && (t.state === 'green' || t.state === 'ripe')) {
          if (avoidRef && avoidRef.plant === plant && avoidRef.i === i && avoidRef.side === side) continue;
          candidates.push({ plant, seg, i, side, tomato: t });
        }
      }
    }
  }
  if (candidates.length === 0) return null;
  return pick(candidates);
}

class Psyllid extends Pest {
  constructor(targetPlant) {
    super('psyllid');
    this.target = targetPlant;
    this.attached = false;
    this.x = rand(100, CFG.farmRight - 100);
    this.y = -this.size;
  }
  update(dt) {
    super.update(dt);
    if (!this.target || !GameState.plants[this.target.slotIndex] || GameState.plants[this.target.slotIndex] !== this.target) {
      this.dead = true; return;
    }
    const rx = this.target.getScreenX() - this.size/2;
    const ry = CFG.groundY - this.size;
    if (!this.attached) {
      const dx = rx - this.x, dy = ry - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        this.attached = true;
        this.target.onPsyllidInfection();
      } else {
        const speed = 0.1 * this.speedMult();
        this.x += (dx / dist) * speed * dt;
        this.y += (dy / dist) * speed * dt;
      }
    } else {
      this.x = rx; this.y = ry;
    }
  }
  draw(ctx) {
    const scale = scaleFor('psyllid', this.size);
    drawSprite(ctx, 'psyllid', this.x, this.y, scale, {
      tint: this.flashTime > 0 ? { 8: 7, 13: 7 } : null
    });
  }
}

// Flea beetle rework: crawls from offscreen edge along the ground toward nearest plant
// and chews the lowest segment. Damages structural health.
class FleaBeetle extends Pest {
  constructor() {
    super('flea');
    const fromLeft = Math.random() < 0.5;
    this.dir = fromLeft ? 1 : -1;
    this.x = fromLeft ? -this.size : CFG.farmRight;
    this.y = CFG.groundY - this.size + 4;
    this.chewTimer = 0;
  }
  update(dt) {
    super.update(dt);
    // Find nearest plant's ground position
    const plants = GameState.plants.filter(p => p);
    if (plants.length === 0) {
      // wander off the other side
      this.x += this.dir * 0.05 * dt * this.speedMult();
      if (this.x < -this.size - 40 || this.x > CFG.farmRight + 40) this.dead = true;
      return;
    }
    // Target nearest by x
    let nearest = plants[0];
    let nearestDx = Math.abs(plants[0].getScreenX() - (this.x + this.size/2));
    for (const p of plants) {
      const d = Math.abs(p.getScreenX() - (this.x + this.size/2));
      if (d < nearestDx) { nearest = p; nearestDx = d; }
    }
    const targetX = nearest.getScreenX() - this.size/2;
    const dx = targetX - this.x;
    if (Math.abs(dx) > 4) {
      this.x += Math.sign(dx) * 0.08 * dt * this.speedMult();
    } else {
      // Chew the lowest segment
      this.chewTimer += dt;
      if (this.chewTimer >= 1500) {
        this.chewTimer = 0;
        // Damage segment 0 (base)
        if (nearest.segments.length > 0) {
          nearest.damageSegment(0, 1);
          spawnPopup(this.x + this.size/2, this.y - 4, 'CHEW', '#cccccc');
        }
      }
    }
  }
  draw(ctx) {
    const scale = scaleFor('flea_beetle', this.size);
    drawSprite(ctx, 'flea_beetle', this.x, this.y, scale, {
      tint: this.flashTime > 0 ? { 13: 4 } : null
    });
  }
}

class VCLocust extends Pest {
  constructor() {
    super('locust');
    this.x = Math.random() < 0.5 ? -this.size : CFG.farmRight;
    this.targetY = rand(CFG.farmTop + 40, CFG.groundY - this.size - 40);
    this.y = this.targetY;
    this.dir = this.x < 0 ? 1 : -1;
    this.chompTimer = 0;
  }
  update(dt) {
    super.update(dt);
    this.x += this.dir * 0.05 * dt * this.speedMult();
    this.y = this.targetY + Math.sin(this.age / 300) * 18;
    this.chompTimer += dt;
    if (this.chompTimer >= 2500) {
      this.chompTimer = 0;
      const steal = Math.min(Math.max(0, GameState.cash), 200);
      GameState.cash -= steal;
      spawnPopup(this.x + this.size/2, this.y - 10, '-' + formatMoney(steal), '#ff4444');
    }
    const lx = this.x + this.size * 0.5;
    const ly = this.y + this.size * 0.45;
    for (const plant of GameState.plants) {
      if (!plant) continue;
      if (Math.abs(plant.getScreenX() - lx) > 44) continue;
      for (let i = 0; i < plant.segments.length; i++) {
        const sy = plant.getScreenYForSegment(i) + 14;
        if (Math.abs(sy - ly) < 22) {
          plant.collapseAt(i, 'locust');
          break;
        }
      }
    }
    if (this.x < -this.size - 20 || this.x > CFG.farmRight + 20) this.dead = true;
  }
  draw(ctx) {
    const scale = scaleFor('vc_locust', this.size);
    drawSprite(ctx, 'vc_locust', this.x, this.y, scale, {
      tint: this.flashTime > 0 ? { 2: 4, 16: 4, 9: 4 } : null
    });
  }
}

class MutantTomato extends Pest {
  constructor(x, y, sourceSlot) {
    super('mutant');
    this.x = x; this.y = y;
    this.sourceSlot = sourceSlot;
    this.chewTimer = 0;
    this.target = null;
  }
  chooseTarget() {
    const plants = GameState.plants.filter(p => p && p.slotIndex !== this.sourceSlot);
    this.target = plants.length ? pick(plants) : GameState.plants.find(p => p);
  }
  update(dt) {
    super.update(dt);
    if (!this.target || !GameState.plants[this.target.slotIndex]) this.chooseTarget();
    if (!this.target) { this.dead = true; return; }
    const tx = this.target.getScreenX();
    const ty = this.target.getScreenYForSegment(0);
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 0.11 * this.speedMult();
    if (dist > 20) {
      this.x += dx / dist * speed * dt;
      this.y += dy / dist * speed * dt;
    } else {
      this.chewTimer += dt;
      if (this.chewTimer >= 1600) {
        this.chewTimer = 0;
        this.target.damageSegment(0, 1);
        spawnPopup(this.x + this.size / 2, this.y - 6, 'CHOMP', '#8cff44');
      }
    }
  }
  draw(ctx) {
    const aura = 0.22 + 0.10 * Math.sin(GameState.gameTime / 120);
    ctx.save();
    ctx.globalAlpha = aura;
    ctx.fillStyle = '#8cff44';
    ctx.beginPath();
    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawSprite(ctx, 'tomato_mutant', this.x, this.y, scaleFor('tomato_mutant', this.size));
  }
}

// Blight mite — flies to a random plant segment, infects it, then leaves
class BlightMite extends Pest {
  constructor(targetPlant) {
    super('blight');
    this.target = targetPlant;
    this.x = Math.random() < 0.5 ? -this.size : CFG.farmRight;
    this.y = rand(CFG.farmTop + 40, CFG.groundY - 60);
    this.infected = false;
    this.targetSeg = targetPlant && targetPlant.segments.length > 0
      ? randInt(0, targetPlant.segments.length - 1) : 0;
    this.leaving = false;
  }
  update(dt) {
    super.update(dt);
    if (!this.target || !GameState.plants[this.target.slotIndex] || GameState.plants[this.target.slotIndex] !== this.target) {
      this.dead = true; return;
    }
    if (!this.infected) {
      const targetSeg = Math.min(this.targetSeg, this.target.segments.length - 1);
      const tx = this.target.getScreenX() - this.size/2;
      const ty = this.target.getScreenYForSegment(targetSeg) + 4;
      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        // Infect this segment
        const seg = this.target.segments[targetSeg];
        if (seg && !seg.diseased) {
          seg.diseased = true;
          seg.diseaseAge = 0;
          spawnPopup(tx + 10, ty - 4, 'BLIGHT', '#ff9933');
        }
        this.infected = true;
        this.leaving = true;
        this.leaveDir = Math.random() < 0.5 ? -1 : 1;
      } else {
        const speed = 0.13 * this.speedMult();
        this.x += (dx / dist) * speed * dt;
        this.y += (dy / dist) * speed * dt;
      }
    } else if (this.leaving) {
      this.x += this.leaveDir * 0.15 * dt;
      this.y -= 0.05 * dt;
      if (this.x < -this.size - 40 || this.x > CFG.farmRight + 40 || this.y < -40) this.dead = true;
    }
  }
  draw(ctx) {
    const scale = scaleFor('blight_mite', this.size);
    drawSprite(ctx, 'blight_mite', this.x, this.y, scale, {
      tint: this.flashTime > 0 ? { 21: 7, 6: 7 } : null
    });
  }
}

// AI Roach — dodges the cursor, otherwise slowly approaches and eats ripe tomatoes
class AIRoach extends Pest {
  constructor() {
    super('ai_roach');
    this.x = Math.random() < 0.5 ? -this.size : CFG.farmRight;
    this.y = rand(CFG.farmTop + 60, CFG.groundY - 60);
    this.vx = 0; this.vy = 0;
    this.eatTimer = 0;
  }
  update(dt) {
    super.update(dt);
    // Dodge cursor if close
    const cx = GameState.mouseX, cy = GameState.mouseY;
    const mx = this.x + this.size/2, my = this.y + this.size/2;
    const ddx = mx - cx, ddy = my - cy;
    const ddist = Math.hypot(ddx, ddy);
    if (ddist < 110 && ddist > 0) {
      // dodge away
      const dSpeed = 0.25 * this.speedMult();
      this.x += (ddx / ddist) * dSpeed * dt;
      this.y += (ddy / ddist) * dSpeed * dt;
    } else {
      // Wander toward a ripe tomato if any
      const ripe = [];
      for (const p of GameState.plants) {
        if (!p) continue;
        for (let i = 0; i < p.segments.length; i++) {
          for (const side of ['L','R']) {
            const t = p.segments[i].fruits[side];
            if (t && t.state === 'ripe') {
              ripe.push({ x: p.getScreenX() + (side === 'L' ? -20 : 12), y: p.getScreenYForSegment(i) });
            }
          }
        }
      }
      if (ripe.length > 0) {
        const target = ripe[0];
        for (const r of ripe) {
          if (Math.hypot(r.x - mx, r.y - my) < Math.hypot(target.x - mx, target.y - my)) {
            // nearest
            target.x = r.x; target.y = r.y;
          }
        }
        const dx = target.x - this.x, dy = target.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d > 10) {
          const speed = 0.08 * this.speedMult();
          this.x += (dx / d) * speed * dt;
          this.y += (dy / d) * speed * dt;
        } else {
          this.eatTimer += dt;
          if (this.eatTimer >= 2500) {
            this.eatTimer = 0;
            // Eat the nearest ripe tomato
            for (const p of GameState.plants) {
              if (!p) continue;
              for (let i = 0; i < p.segments.length; i++) {
                for (const side of ['L','R']) {
                  const t = p.segments[i].fruits[side];
                  if (t && t.state === 'ripe') {
                    const tx = p.getScreenX() + (side === 'L' ? -20 : 12);
                    const ty = p.getScreenYForSegment(i);
                    if (Math.hypot(tx - this.x, ty - this.y) < 30) {
                      p.segments[i].fruits[side] = null;
                      spawnPoof(tx, ty);
                      spawnPopup(tx, ty, 'GONE', '#aaccff');
                      return;
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        // Drift
        this.x += Math.sin(this.age / 600) * 0.05 * dt;
        this.y += Math.cos(this.age / 700) * 0.04 * dt;
      }
    }
    // Clamp to farm area
    this.x = clamp(this.x, -20, CFG.farmRight - this.size/2);
    this.y = clamp(this.y, CFG.farmTop - 20, CFG.groundY - this.size/2);
  }
  draw(ctx) {
    const scale = scaleFor('ai_roach', this.size);
    drawSprite(ctx, 'ai_roach', this.x, this.y, scale, {
      tint: this.flashTime > 0 ? { 22: 4, 23: 4 } : null
    });
  }
}


// -----------------------------------------------------------------------------
// 14. PEST SPAWNING
// -----------------------------------------------------------------------------

function spawnRandomPest(phaseIdx) {
  const alive = GameState.plants.filter(p => p);
  if (alive.length === 0) return;
  const roll = Math.random();
  let type;
  if (phaseIdx <= 0) {
    type = roll < 0.7 ? 'whitefly' : 'fruitworm';
  } else if (phaseIdx === 1) {
    if (roll < 0.45) type = 'whitefly';
    else if (roll < 0.75) type = 'fruitworm';
    else if (roll < 0.9) type = 'psyllid';
    else type = 'flea';
  } else if (phaseIdx === 2) {
    if (roll < 0.3) type = 'whitefly';
    else if (roll < 0.55) type = 'fruitworm';
    else if (roll < 0.7) type = 'psyllid';
    else if (roll < 0.85) type = 'flea';
    else type = 'blight';
  } else {
    if (roll < 0.2) type = 'whitefly';
    else if (roll < 0.38) type = 'fruitworm';
    else if (roll < 0.55) type = 'psyllid';
    else if (roll < 0.7) type = 'flea';
    else if (roll < 0.85) type = 'blight';
    else type = 'roach';
  }
  spawnPestOfType(type);
}

function spawnPestOfType(type) {
  const plants = GameState.plants.filter(p => p);
  if (plants.length === 0) return;
  const target = pick(plants);
  switch (type) {
    case 'whitefly': GameState.pests.push(new Whitefly(target)); break;
    case 'fruitworm': {
      const refs = [];
      for (const pl of plants) refs.push(...pl.getRipeTomatoRefs());
      if (refs.length > 0) GameState.pests.push(new Fruitworm(pick(refs)));
      break;
    }
    case 'psyllid': GameState.pests.push(new Psyllid(target)); break;
    case 'flea': GameState.pests.push(new FleaBeetle()); break;
    case 'blight': GameState.pests.push(new BlightMite(target)); break;
    case 'roach': GameState.pests.push(new AIRoach()); break;
  }
}


// -----------------------------------------------------------------------------
// 17. NEWS TICKER
// -----------------------------------------------------------------------------

function approxTextWidth(s) {
  // Bold 16px Courier New, monospace — roughly 9.6px per char
  return s.length * 9.6;
}

function updateTicker(dt) {
  const t = GameState.ticker;
  t.scroll -= 0.08 * dt;
  // Seed with text if empty
  if (t.text === '') {
    for (let i = 0; i < 3; i++) t.text += pick(TICKER_HEADLINES) + '   +++   ';
  }
  // If scroll has exposed most of the text, append more
  const textWidth = approxTextWidth(t.text);
  if (-t.scroll > textWidth - CFG.canvas.w - 200) {
    t.text += pick(TICKER_HEADLINES) + '   +++   ';
  }
  // Trim prefix to keep string reasonable
  if (t.text.length > 1200) {
    const trim = 400;
    t.text = t.text.substring(trim);
    t.scroll += approxTextWidth(t.text.substring(0, trim));
    // That correction was wrong direction; simpler: reset text
    if (t.text.length > 1200) { t.text = t.text.substring(t.text.length - 800); t.scroll = 0; }
  }
}

function drawTicker(ctx) {
  ctx.fillStyle = '#1a0000';
  ctx.fillRect(0, CFG.newsBarY, CFG.canvas.w, CFG.newsBarH);
  ctx.strokeStyle = '#330000';
  ctx.strokeRect(0, CFG.newsBarY, CFG.canvas.w, CFG.newsBarH);
  // red label block
  ctx.fillStyle = '#cc1111';
  ctx.fillRect(0, CFG.newsBarY, 100, CFG.newsBarH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LIVE NEWS', 50, CFG.newsBarY + 19);
  // scrolling text
  ctx.save();
  ctx.beginPath();
  ctx.rect(104, CFG.newsBarY, CFG.canvas.w - 104, CFG.newsBarH);
  ctx.clip();
  ctx.fillStyle = '#ffee66';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(GameState.ticker.text, 110 + GameState.ticker.scroll, CFG.newsBarY + 19);
  ctx.restore();
  ctx.textAlign = 'left';
}


// -----------------------------------------------------------------------------
// 18. TAX POCALYPSE + ROT PENALTY + FAILSAFE
// -----------------------------------------------------------------------------

function triggerTaxPocalypse() {
  GameState.taxPocalypseTriggered = true;
  const wiped = Math.max(0, GameState.cash);
  GameState.cash -= wiped;
  GameState.stats.totalTaxed += wiped;
  GameState.announcementOverlay = { lines: TAX_ANNOUNCEMENT, age: 0, duration: 7000 };
  GameState.glitchTimer = 600;
  spawnGlobalPopup('WEALTH TAX: -' + formatMoney(wiped), '#ff4444');
}

let rotTickAccum = 0;
function updateRotPenalty(dt) {
  rotTickAccum += dt;
  if (rotTickAccum >= CFG.tomato.rotPenaltyIntervalMs) {
    rotTickAccum = 0;
    let rottenCount = 0;
    for (const p of GameState.plants) {
      if (!p) continue;
      for (let i = 0; i < p.segments.length; i++) {
        const seg = p.segments[i];
        for (const side of ['L','R']) {
          const t = seg.fruits[side];
          if (t && t.state === 'rotten') {
            rottenCount++;
            const size = t.getRenderSize();
            const fx = p.getScreenX() + (side === 'L' ? -(size - 8) : 10);
            const fy = p.getScreenYForSegment(i) - Math.max(6, size * 0.2);
            spawnPopup(fx + size / 2, fy + size / 2, '-$10', '#ff4444');
          }
        }
      }
    }
    if (rottenCount > 0) {
      const penalty = rottenCount * CFG.tomato.rotPenaltyPerTick;
      GameState.cash -= penalty;
      GameState.stats.rotPenalties += penalty;
      spawnGlobalPopup('ROT PENALTY: -' + formatMoney(penalty), '#cc4466');
    }
  }
}

// Helper: queue a temporary live-news headline.
function injectTickerHeadline(headline) {
  GameState.ticker.text += headline + '   +++   ';
}

function noteTomatoAttack() {
  const lines = [
    'BREAKING: local authorities confirm a hostile tomato incident. Public advised to remain crunchy but calm.',
    'LIVE: tomato attack footage under review after one witness insists the fruit had teeth.',
    'Ministry bulletin: any reports of carnivorous produce are being treated as anti-growth pessimism.',
    'Emergency services warn citizens not to anthropomorphise produce, even if it is charging at them.',
  ];
  if (GameState.flags.tomatoAttackStories >= lines.length) return;
  const idx = GameState.flags.tomatoAttackStories;
  GameState.flags.tomatoAttackStories += 1;
  injectTickerHeadline(lines[idx]);
}

function checkFailsafeSeed() {
  const hasPlants = GameState.plants.some(p => p);
  const hasSeeds = GameState.seeds.basic + GameState.seeds.engineered > 0;
  if (!hasPlants && !hasSeeds) {
    GameState.seeds.basic = 1;
    spawnGlobalPopup('EMERGENCY SEED DELIVERED', '#66ff66');
  }
}

// -----------------------------------------------------------------------------
// 19. PHASE MANAGEMENT
// -----------------------------------------------------------------------------

function currentPhaseIndex() {
  for (let i = 0; i < PHASES.length; i++) {
    if (GameState.gameTime < PHASES[i].until) return i;
  }
  return PHASES.length - 1;
}

function getCurrentPhase() {
  return PHASES[currentPhaseIndex()];
}

function checkPhaseChange(dt) {
  const newPhaseIdx = currentPhaseIndex();
  if (newPhaseIdx !== GameState.currentPhaseIndex) {
    GameState.currentPhaseIndex = newPhaseIdx;
    GameState.phaseBanner = { name: PHASES[newPhaseIdx].name, age: 0, duration: 3500 };
  }
  if (GameState.phaseBanner) {
    GameState.phaseBanner.age += dt;
    if (GameState.phaseBanner.age > GameState.phaseBanner.duration) GameState.phaseBanner = null;
  }
}


// -----------------------------------------------------------------------------
// 23. RESTART
// -----------------------------------------------------------------------------

function restart() {
  const introUnlocked = !!(GameState.intro && GameState.intro.unlocked);
  GameState.phase = introUnlocked ? 'intro' : 'gate';
  GameState.cash = CFG.startingCash;
  GameState.gameTime = 0;
  GameState.lastTime = 0;
  GameState.plants = new Array(CFG.slotCount).fill(null);
  GameState.launchpads = [];
  GameState.pests = [];
  GameState.pendingMutants = [];
  GameState.particles = [];
  GameState.popups = [];
  GameState.fallingDebris = [];
  GameState.seeds = { basic: 1, engineered: 0 };
  GameState.junk = [];
  GameState.duckCurse = false;
  GameState.duckCount = 0;
  GameState.duckGrounds = [];
  GameState.flags = {
    launchPadPurchased: false,
    tomatoAttackStories: 0,
  };
  GameState.taxTimer = 0;
  GameState.adTimer = 0;
  GameState.pestTimer = 0;
  GameState.ambientPestTimer = 0;
  GameState.locustTimer = 0;
  GameState.shop = {
    slots: [null, null, null, null],
    refreshTimer: 0,
    nextRefreshAt: 4000,
  };
  GameState.assistant = {
    unlocked: false,
    name: '',
    designSpec: '',
    x: 0,
    y: 0,
    alive: true,
    state: 'idle',
    stateTime: 0,
    speech: null,
    speakTimer: 0,
    buyTimer: 0,
    targetItemId: null,
    targetSlotIndex: -1,
    cursorFx: null,
  };
  GameState.weapons = {
    nuke:   { unlocked: false, padPlaced: false, padSlot: -1, padPending: false, charges: 0, lastUsed: -999999 },
    drone:  { unlocked: false, chargesLeft: 0, active: false, lastToggleOff: -999999, killTimer: 0, costAccum: 0, x: 180, y: 170, targetX: 180, targetY: 170, patrolTimer: 0, currentTargetId: null, beamFlash: 0, beamTargetX: 0, beamTargetY: 0 },
    harvestDrone: { unlocked: false, active: false, x: 240, y: 200, targetX: 240, targetY: 200, retargetTimer: 0, targetPlantIdx: -1, targetSegIdx: -1, targetSide: null, health: 1, attackerPestId: null, beamFlash: 0 },
    popup:  { unlocked: false, active: false, lastToggleOff: -999999, costAccum: 0 },
    laser:  { unlocked: false, charges: 0, lastUsed: -999999 },
    manure: { unlocked: false, lastUsed: -999999 },
    flame:  { unlocked: false, lastUsed: -999999 },
    selected: null,
  };
  GameState.upgrades = { nutrientFeed: false, plantGrowthRate: 0, tomatoGrowthRate: 0, largeChance: 0, goldChance: 0, pestResistance: 0, rotWindow: 0, droneUpgrade: false };
  GameState.portfolio = { xai: 0, amazon: 0, nvidia: 0, claude: 0, google: 0 };
  GameState.shopPurchases = {};
  GameState.buffs = [];
  GameState.ads = [];
  GameState.phaseBanner = null;
  GameState.glitchTimer = 0;
  GameState.announcementOverlay = null;
  GameState.gagDialog = null;
  GameState.buffFlash = null;
  GameState.laserFlashTimer = 0;
  GameState.nukeFX = null;
  GameState.currentPhaseIndex = 0;
  GameState.ticker = { scroll: 0, text: '' };
  GameState.taxPocalypseTriggered = false;
  GameState.stats = {
    tomatoesHarvested: 0, totalEarned: 0, totalTaxed: 0, pestsKilled: 0,
    adsClosed: 0, plantsPlanted: 0, plantsCollapsed: 0, rotPenalties: 0,
    tomatoesConfiscated: 0, seedsBought: 0, upgradesBought: 0, weaponsFired: 0, mutantsDetached: 0,
  };
  GameState.gameoverReason = null;
  GameState.gameoverPropaganda = null;
  GameState.gameoverEnding = null;
  rotTickAccum = 0;
  GameState.intro = { input: '', error: '', comicIndex: 0, unlocked: introUnlocked };
}



// -----------------------------------------------------------------------------
// MODULE WIRING
// -----------------------------------------------------------------------------

const moduleCtx = {
  GameState, CFG, PHASES, SPRITES, PALETTE,
  rand, randInt, clamp, pick, formatMoney,
  rollShopOffer, drawSprite, drawSpriteMatrix, scaleFor, getDimensionSnapshot,
  ownedShares, STOCK_ENDINGS, ENDING_DEFINITIONS, makeEndingState, flashBuff, spawnPoof, spawnPopup, spawnBurst, spawnShockwave, spawnGlobalPopup,
  getCurrentPhase, getCorruptionPressure, checkPhaseChange, updateTicker, checkFailsafeSeed,
  updateParticles, drawParticles, drawTicker, MINES_PROPAGANDA, hasAnyShare, getShareEnding,
  getSlotClickBox, noteTomatoAttack, getSlotBox, slotCenterX, hasDuckCurse,
  ASSISTANT_DESIGN_SPEC, ASSISTANT_NAME_POOL, getAssistantPurchaseLine, getAssistantIdleLine, getAssistantPopupLine, getAssistantNukeWarningLine,
  // Systems & UI wiring helpers
  spawnPestOfType, spawnRandomPest, triggerTaxPocalypse, updateRotPenalty,
  hasMLBook, POPUP_POOL, VCLocust, updateBuffs,
  TICKER_HEADLINES, AD_COPY, TAX_ANNOUNCEMENT, Plant, MutantTomato, restart, clearSpriteCache, adCloseBox
};

const shopSystem = createShopSystem(moduleCtx);
Object.assign(moduleCtx, shopSystem);
const weaponSystem = createWeaponSystem(moduleCtx);
Object.assign(moduleCtx, weaponSystem);
moduleCtx.updateWeaponSystems = function updateWeaponSystems(dt) {
  if (typeof weaponSystem.updatePopupBlocker === 'function') weaponSystem.updatePopupBlocker(dt);
  if (typeof weaponSystem.updateDroneWeapon === 'function') weaponSystem.updateDroneWeapon(dt);
  if (typeof weaponSystem.updateHarvestDrone === 'function') weaponSystem.updateHarvestDrone(dt);
};
const renderUI = createRenderUI({ ...moduleCtx, WEAPON_LABELS: weaponSystem.WEAPON_LABELS });
Object.assign(moduleCtx, renderUI);
const flowUI = createFlowUI(moduleCtx);
Object.assign(moduleCtx, flowUI);
const inputHandlers = createInputHandlers(moduleCtx);
Object.assign(moduleCtx, inputHandlers);
const updater = createUpdater(moduleCtx);
Object.assign(moduleCtx, updater);
const editorUI = createEditorUI(moduleCtx);
Object.assign(moduleCtx, editorUI);
const { WEAPON_SLOTS } = weaponSystem;
let { update, render, drawIntro, drawGameOver, openEditor, closeEditor, initEditor } = moduleCtx;

// -----------------------------------------------------------------------------
// 24. MAIN LOOP
// -----------------------------------------------------------------------------

let gameCanvas, gameCtx;

function loop(ts) {
  if (!GameState.lastTime) GameState.lastTime = ts;
  let dt = ts - GameState.lastTime;
  GameState.lastTime = ts;
  if (dt > 100) dt = 100;  // clamp big frame gaps

  if (GameState.phase !== 'editor') {
    update(dt);
    if (GameState.phase === 'intro') {
      drawIntro(gameCtx);
    } else if (GameState.phase === 'gameover') {
      render(gameCtx);
      drawGameOver(gameCtx);
    } else {
      render(gameCtx);
    }
  } else {
    // Editor is open — do not update game state, just keep particle animations gentle
    updateParticles(dt);
  }

  requestAnimationFrame(loop);
}


// =============================================================================
//  INIT
// =============================================================================

function initBase() {
  gameCanvas = document.getElementById('game-canvas');
  gameCtx = gameCanvas.getContext('2d');
  gameCtx.imageSmoothingEnabled = false;

  function fit() {
    const pad = 20;
    const maxW = window.innerWidth - pad * 2;
    const maxH = window.innerHeight - pad * 2;
    const ratio = CFG.canvas.w / CFG.canvas.h;
    let w = maxW, h = maxW / ratio;
    if (h > maxH) { h = maxH; w = maxH * ratio; }
    gameCanvas.style.width = w + 'px';
    gameCanvas.style.height = h + 'px';
  }
  fit();
  window.addEventListener('resize', fit);

  gameCanvas.addEventListener('click', e => {
    if (GameState.phase === 'editor') return;
    const rect = gameCanvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (CFG.canvas.w / rect.width);
    const sy = (e.clientY - rect.top) * (CFG.canvas.h / rect.height);
    const { handleClick } = moduleCtx;
    if (GameState.phase === 'gate') return;
    if (GameState.phase === 'comic') {
      GameState.intro.comicIndex++;
      if (GameState.intro.comicIndex >= INTRO_COMIC_IMAGES.length) {
        GameState.intro.unlocked = true;
        GameState.phase = 'intro';
      }
      return;
    }
    if (GameState.phase === 'debug_menu') {
      handleDebugMenuClick(sx, sy);
      return;
    }
    handleClick(sx, sy);
  });

  gameCanvas.addEventListener('mousemove', e => {
    const rect = gameCanvas.getBoundingClientRect();
    GameState.mouseX = (e.clientX - rect.left) * (CFG.canvas.w / rect.width);
    GameState.mouseY = (e.clientY - rect.top) * (CFG.canvas.h / rect.height);
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && GameState.phase === 'debug_menu') {
      GameState.phase = 'playing';
      return;
    }
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      if (GameState.phase === 'editor') closeEditor();
      else openEditor();
      return;
    }
    if (e.key === 'Escape') {
      if (document.getElementById('ed-export-modal').classList.contains('open')) {
        document.getElementById('ed-export-modal').classList.remove('open');
      } else if (GameState.phase === 'editor') {
        closeEditor();
      } else if (GameState.weapons.selected) {
        GameState.weapons.selected = null;
      }
      return;
    }
    // Weapon hotkeys
    if (GameState.phase === 'playing') {
      const { selectWeapon } = moduleCtx;
      const idx = '123456'.indexOf(e.key);
      if (idx !== -1 && idx < WEAPON_SLOTS.length) {
        selectWeapon(WEAPON_SLOTS[idx]);
      }
    }
  });

  // Initial plants array sized to slot count, plus starting seeds
  GameState.plants = new Array(CFG.slotCount).fill(null);
  GameState.seeds.basic = 1;

  initEditor();
  installBrowserHooks();

  console.log('%cTOMATO BILLIONAIRE v2', 'color: #ff4444; font-size: 18px; font-weight: bold;');
  console.log('%cpress ` (backtick) to open the sprite editor.', 'color: #44ff44;');

  requestAnimationFrame(loop);
}

const INTRO_PASSWORD = 'CULTIVATE';
const INTRO_COMIC_PATHS = Array.from({length: 5}, (_, i) => `assets/intro/${i + 1}.png`);
const INTRO_COMIC_IMAGES = INTRO_COMIC_PATHS.map(path => {
  const img = new Image();
  img.src = path;
  return img;
});

function buildStateSnapshot() {
  const plants = GameState.plants.map((plant, slot) => {
    if (!plant) return null;
    const fruitCounts = { sprout: 0, green: 0, ripe: 0, rotten: 0, radiated: 0 };
    let diseasedSegments = 0;
    for (const seg of plant.segments) {
      if (seg.diseased) diseasedSegments++;
      for (const side of ['L', 'R']) {
        const fruit = seg.fruits[side];
        if (!fruit) continue;
        fruitCounts[fruit.state] = (fruitCounts[fruit.state] || 0) + 1;
        if (fruit.radiated) fruitCounts.radiated++;
      }
    }
    return {
      slot,
      engineered: !!plant.engineered,
      radiated: !!plant.radiated,
      segments: plant.segments.length,
      diseasedSegments,
      fruitCounts,
    };
  }).filter(Boolean);

  const pests = GameState.pests
    .filter(p => !p.dead)
    .map(p => ({
      type: p.type,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hitsRemaining: p.hitsRemaining,
      radiated: !!p.radiated,
    }));

  const shop = GameState.shop.slots.map(slot => slot ? {
    id: slot.item.id,
    price: slot.item.price,
    category: slot.item.category || null,
    timeLeftMs: Math.round(slot.timeLeft),
  } : null);

  const assistant = GameState.assistant ? {
    unlocked: !!GameState.assistant.unlocked,
    alive: !!GameState.assistant.alive,
    name: GameState.assistant.name || '',
    state: GameState.assistant.state || 'idle',
    x: Math.round(GameState.assistant.x || 0),
    y: Math.round(GameState.assistant.y || 0),
    speech: GameState.assistant.speech ? GameState.assistant.speech.text : null,
    targetItemId: GameState.assistant.targetItemId || null,
    targetSlotIndex: GameState.assistant.targetSlotIndex ?? -1,
    cursorFx: GameState.assistant.cursorFx ? {
      active: !!GameState.assistant.cursorFx.active,
      phase: GameState.assistant.cursorFx.phase,
      itemName: GameState.assistant.cursorFx.itemName,
      x: Math.round(GameState.assistant.cursorFx.x),
      y: Math.round(GameState.assistant.cursorFx.y),
      targetX: Math.round(GameState.assistant.cursorFx.targetX),
      targetY: Math.round(GameState.assistant.cursorFx.targetY),
    } : null,
  } : null;

  const pendingMutants = GameState.pendingMutants.map(mutant => ({
    plantSlot: mutant.plantSlot,
    segIndex: mutant.segIndex,
    side: mutant.side,
    timeLeftMs: Math.round(mutant.timeLeft),
    x: Math.round(mutant.x),
    y: Math.round(mutant.y),
  }));

  return {
    coordinateSystem: 'origin top-left; +x right; +y down',
    phase: GameState.phase,
    intro: GameState.intro ? {
      unlocked: !!GameState.intro.unlocked,
      comicIndex: GameState.intro.comicIndex || 0,
      input: GameState.intro.input || '',
      error: GameState.intro.error || '',
    } : null,
    cash: Math.round(GameState.cash),
    gameTimeMs: Math.round(GameState.gameTime),
    seeds: { ...GameState.seeds },
    flags: { ...GameState.flags },
    upgrades: { ...GameState.upgrades },
    selectedWeapon: GameState.weapons.selected,
    launchpads: [...GameState.launchpads],
    weapons: {
      nuke: {
        unlocked: !!GameState.weapons.nuke.unlocked,
        padPlaced: !!GameState.weapons.nuke.padPlaced,
        padPending: !!GameState.weapons.nuke.padPending,
      },
      drone: {
        unlocked: !!GameState.weapons.drone.unlocked,
        active: !!GameState.weapons.drone.active,
      },
      popup: {
        unlocked: !!GameState.weapons.popup.unlocked,
        active: !!GameState.weapons.popup.active,
      },
      laser: { unlocked: !!GameState.weapons.laser.unlocked },
      manure: { unlocked: !!GameState.weapons.manure.unlocked },
      flame: { unlocked: !!GameState.weapons.flame.unlocked },
    },
    ads: GameState.ads.map((ad, index) => ({
      index,
      title: ad.copy.title,
      x: Math.round(ad.x),
      y: Math.round(ad.y),
      w: Math.round(ad.w),
      h: Math.round(ad.h),
    })),
    shop,
    assistant,
    duckGroundCount: GameState.duckGrounds.length,
    pendingMutants,
    plants,
    pests,
    announcement: GameState.announcementOverlay ? [...GameState.announcementOverlay.lines] : null,
    gagDialog: GameState.gagDialog ? {
      title: GameState.gagDialog.title,
      body: GameState.gagDialog.body,
    } : null,
    tickerTail: GameState.ticker.text.slice(-220),
    gameoverReason: GameState.gameoverReason || null,
  };
}

function renderGameToText() {
  return JSON.stringify(buildStateSnapshot());
}

function installBrowserHooks() {
  function step(ms) {
    const totalMs = Math.max(1000 / 60, ms);
    const steps = Math.max(1, Math.round(totalMs / (1000 / 60)));
    const dt = totalMs / steps;
    for (let i = 0; i < steps; i++) {
      if (GameState.phase !== 'editor') {
        update(dt);
        if (GameState.phase === 'intro') {
          drawIntro(gameCtx);
        } else if (GameState.phase === 'gameover') {
          render(gameCtx);
          drawGameOver(gameCtx);
        } else {
          render(gameCtx);
        }
      } else {
        updateParticles(dt);
      }
    }
    return buildStateSnapshot();
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = ms => Promise.resolve(step(ms));
  window.__TOMATO_DEBUG__ = {
    cfg: CFG,
    state: GameState,
    sprites: SPRITES,
    restart,
    step,
    snapshot: buildStateSnapshot,
    shopItems: SHOP_ITEMS,
    openEditor,
    closeEditor,
    helpers: {
      Plant,
      MutantTomato,
      spawnPestOfType,
      applyWeapon: weaponSystem.applyWeapon,
      purchaseShopSlot: shopSystem.purchaseShopSlot,
      getShopSlotBox: shopSystem.getShopSlotBox,
      noteTomatoAttack,
      selectWeapon: weaponSystem.selectWeapon,
    },
  };
}

function drawPasswordGate(ctx) {
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 52px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ACCESS GATE', CFG.canvas.w / 2, 150);
  ctx.fillStyle = '#cccccc';
  ctx.font = '20px "Courier New", monospace';
  ctx.fillText('Enter the cultivation password to proceed', CFG.canvas.w / 2, 210);
  ctx.fillStyle = '#10151d';
  ctx.fillRect(CFG.canvas.w / 2 - 220, 280, 440, 72);
  ctx.strokeStyle = '#66ddff';
  ctx.lineWidth = 3;
  ctx.strokeRect(CFG.canvas.w / 2 - 220, 280, 440, 72);
  ctx.fillStyle = '#88ff88';
  ctx.font = 'bold 34px "Courier New", monospace';
  const shown = (GameState.intro.input || '') + ((Math.floor(Date.now() / 400) % 2) ? '_' : '');
  ctx.fillText(shown || '_', CFG.canvas.w / 2, 328);
  ctx.font = '16px "Courier New", monospace';
  ctx.fillStyle = '#ffcc66';
  ctx.fillText('Password hint: starts with CULT…', CFG.canvas.w / 2, 390);
  if (GameState.intro.error) {
    ctx.fillStyle = '#ff6666';
    ctx.fillText(GameState.intro.error, CFG.canvas.w / 2, 430);
  }
  ctx.fillStyle = '#666';
  ctx.fillText('Press ENTER to submit', CFG.canvas.w / 2, 470);
  ctx.textAlign = 'left';
}

function drawComicIntro(ctx) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);
  const idx = clamp(GameState.intro.comicIndex, 0, INTRO_COMIC_IMAGES.length - 1);
  const img = INTRO_COMIC_IMAGES[idx];
  if (img && img.complete) {
    const pad = 70;
    const maxW = CFG.canvas.w - pad * 2;
    const maxH = CFG.canvas.h - 150;
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (CFG.canvas.w - w) / 2, 40, w, h);
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(120, 60, CFG.canvas.w - 240, CFG.canvas.h - 180);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(120, 60, CFG.canvas.w - 240, CFG.canvas.h - 180);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`COMIC PANEL ${idx + 1}`, CFG.canvas.w / 2, CFG.canvas.h / 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, CFG.canvas.h - 90, CFG.canvas.w, 90);
  ctx.fillStyle = '#ffdd66';
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Intro ${idx + 1} / ${INTRO_COMIC_IMAGES.length}   •   Click to continue`, CFG.canvas.w / 2, CFG.canvas.h - 38);
  ctx.textAlign = 'left';
}

// Redirect render to comic/gate if needed
const baseRender = render;
render = function(ctx) {
  if (GameState.phase === 'gate') { drawPasswordGate(ctx || gameCtx); return; }
  if (GameState.phase === 'comic') { drawComicIntro(ctx || gameCtx); return; }
  if (GameState.phase === 'debug_menu') { drawDebugMenu(ctx || gameCtx); return; }
  baseRender(ctx || gameCtx);
};

const DEBUG_MENU_BOXES = [];
function drawDebugMenu(ctx) {
  ctx.fillStyle = 'rgba(5, 7, 10, 0.95)';
  ctx.fillRect(0, 0, CFG.canvas.w, CFG.canvas.h);
  
  ctx.fillStyle = '#ffcc66';
  ctx.font = 'bold 32px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SECRET ENDING SELECTOR', CFG.canvas.w/2, 80);

  const endings = Object.keys(ENDING_DEFINITIONS);
  const colW = 460;
  const rowH = 46;
  const startX = CFG.canvas.w/2 - colW/2;
  const startY = 140;
  
  DEBUG_MENU_BOXES.length = 0;
  for (let i = 0; i < endings.length; i++) {
    const id = endings[i];
    const def = ENDING_DEFINITIONS[id];
    const x = startX;
    const y = startY + i * rowH;
    const w = colW;
    const h = 38;
    
    const hover = GameState.mouseX >= x && GameState.mouseX <= x + w && GameState.mouseY >= y && GameState.mouseY <= y + h;
    
    ctx.fillStyle = hover ? '#2a3b4d' : '#151d26';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = hover ? '#66ddff' : '#3d4d5e';
    ctx.lineWidth = hover ? 2 : 1;
    ctx.strokeRect(x, y, w, h);
    
    ctx.fillStyle = hover ? '#ffffff' : '#9aa4b2';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, x + w/2, y + 24);
    
    DEBUG_MENU_BOXES.push({ x, y, w, h, id });
  }

  ctx.fillStyle = '#ff6666';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText('[ PRESS ESC TO CANCEL ]', CFG.canvas.w/2, CFG.canvas.h - 60);
}

function handleDebugMenuClick(sx, sy) {
  for (const box of DEBUG_MENU_BOXES) {
    if (sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h) {
      GameState.phase = 'gameover';
      GameState.gameoverReason = 'debug_test';
      GameState.gameoverEnding = makeEndingState(box.id);
      return;
    }
  }
}

function handleGateKey(e) {
  if (GameState.phase !== 'gate') return;
  if (e.key === 'Enter') {
    if ((GameState.intro.input || '').toUpperCase() === INTRO_PASSWORD) {
      GameState.intro.error = '';
      GameState.intro.comicIndex = 0;
      GameState.phase = 'comic';
    } else {
      GameState.intro.error = 'ACCESS DENIED';
      GameState.intro.input = '';
    }
    e.preventDefault();
    return;
  }
  if (e.key === 'Backspace') {
    GameState.intro.input = (GameState.intro.input || '').slice(0, -1);
    e.preventDefault();
    return;
  }
  if (/^[a-zA-Z]$/.test(e.key) && (GameState.intro.input || '').length < 16) {
    GameState.intro.input += e.key.toUpperCase();
    GameState.intro.error = '';
    e.preventDefault();
  }
}

function init() {
  initBase();
  GameState.phase = 'gate';
  GameState.intro = { input: '', error: '', comicIndex: 0, unlocked: false };
  window.addEventListener('keydown', handleGateKey);
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 't') GameState.debugTDown = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key.toLowerCase() === 't') GameState.debugTDown = false;
  });
  INTRO_COMIC_IMAGES.forEach(img => { const _ = img.complete; });
}

export { init };
