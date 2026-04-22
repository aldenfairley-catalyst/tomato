export function createEditorUI(ctx) {
  const { GameState, SPRITES, PALETTE, formatMoney, clearSpriteCache } = ctx;

// =============================================================================
//  SPRITE EDITOR
// =============================================================================

const Editor = {
  activeKey: null,
  activeFrameIdx: 0,
  activeColourIdx: 2,
  tool: 'draw',
  canvas: null,
  ctx: null,
  previewCanvas: null,
  previewCtx: null,
  previewLastTick: 0,
  previewFrameIdx: 0,
  previewAnimSpeed: 500,
  mouseDown: false,
};

function openEditor() {
  GameState.phase = 'editor';
  document.getElementById('editor-overlay').classList.add('open');
  renderSpriteList();
  if (!Editor.activeKey) {
    const keys = Object.keys(SPRITES);
    if (keys.length) selectSprite(keys[0]);
  } else {
    selectSprite(Editor.activeKey);
  }
  renderPalette();
  updateGameStateInfo();
}

function closeEditor() {
  GameState.phase = (GameState.gameTime === 0 && !GameState.stats.plantsPlanted) ? 'intro' : 'playing';
  document.getElementById('editor-overlay').classList.remove('open');
  GameState.lastTime = 0;
}

function renderSpriteList() {
  const list = document.getElementById('ed-sprite-list');
  list.innerHTML = '';
  Object.keys(SPRITES).forEach(key => {
    const sp = SPRITES[key];
    const h = sp.frames[0].length, w = sp.frames[0][0].length;
    const entry = document.createElement('div');
    entry.className = 'sprite-entry' + (key === Editor.activeKey ? ' active' : '');
    entry.innerHTML = '<span>' + key + '</span><span class="dims">' + w + 'x' + h + (sp.frames.length > 1 ? ' \u00d7' + sp.frames.length : '') + '</span>';
    entry.onclick = () => selectSprite(key);
    list.appendChild(entry);
  });
}

function selectSprite(key) {
  Editor.activeKey = key;
  Editor.activeFrameIdx = 0;
  document.getElementById('ed-current-name').textContent = key;
  renderSpriteList();
  resizeEditorCanvas();
  renderEditor();
  renderFrames();
  document.getElementById('ed-anim-speed').value = SPRITES[key].speed || 500;
  Editor.previewAnimSpeed = SPRITES[key].speed || 500;
}

function getActiveFrame() {
  if (!Editor.activeKey) return null;
  const sp = SPRITES[Editor.activeKey];
  if (!sp) return null;
  return sp.frames[Editor.activeFrameIdx];
}

function resizeEditorCanvas() {
  const frame = getActiveFrame();
  if (!frame) return;
  const h = frame.length, w = frame[0].length;
  const maxCanvas = 480;
  const scale = Math.floor(maxCanvas / Math.max(w, h));
  const cw = w * scale;
  const ch = h * scale;
  Editor.canvas.width = cw;
  Editor.canvas.height = ch;
  const box = document.getElementById('ed-canvas-box');
  box.style.width = cw + 'px';
  box.style.height = ch + 'px';
}

function editorCell(event) {
  const frame = getActiveFrame();
  if (!frame) return null;
  const rect = Editor.canvas.getBoundingClientRect();
  const w = frame[0].length, h = frame.length;
  const cx = Math.floor((event.clientX - rect.left) / rect.width * w);
  const cy = Math.floor((event.clientY - rect.top) / rect.height * h);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
  return { x: cx, y: cy };
}

function editorPaint(event) {
  const c = editorCell(event);
  if (!c) return;
  const frame = getActiveFrame();
  if (!frame) return;
  if (Editor.tool === 'draw') {
    frame[c.y][c.x] = Editor.activeColourIdx;
  } else if (Editor.tool === 'erase') {
    frame[c.y][c.x] = 0;
  } else if (Editor.tool === 'fill') {
    const target = frame[c.y][c.x];
    const replacement = Editor.activeColourIdx;
    if (target === replacement) return;
    const stack = [[c.x, c.y]];
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= frame[0].length || y >= frame.length) continue;
      if (frame[y][x] !== target) continue;
      frame[y][x] = replacement;
      stack.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
    }
  } else if (Editor.tool === 'pick') {
    Editor.activeColourIdx = frame[c.y][c.x];
    renderPalette();
  }
  if (clearSpriteCache) clearSpriteCache();
  renderEditor();
}

function renderEditor() {
  const frame = getActiveFrame();
  if (!frame) return;
  const ctx = Editor.ctx;
  const w = frame[0].length, h = frame.length;
  const cw = Editor.canvas.width, ch = Editor.canvas.height;
  const cellW = cw / w, cellH = ch / h;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cw, ch);
  // checker background for transparent cells
  ctx.fillStyle = '#222';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((x + y) & 1) ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = frame[y][x];
      if (v === 0) continue;
      ctx.fillStyle = PALETTE[v] || '#f0f';
      ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
  }
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellW, 0);
    ctx.lineTo(x * cellW, ch);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellH);
    ctx.lineTo(cw, y * cellH);
    ctx.stroke();
  }
}

function renderPalette() {
  const box = document.getElementById('ed-palette');
  box.innerHTML = '';
  for (let i = 0; i < PALETTE.length; i++) {
    const sw = document.createElement('div');
    sw.className = 'palette-swatch' + (i === Editor.activeColourIdx ? ' active' : '');
    if (i === 0) {
      sw.classList.add('transparent');
      sw.title = 'transparent';
    } else {
      sw.style.background = PALETTE[i];
      sw.title = i + ': ' + PALETTE[i];
    }
    sw.onclick = () => { Editor.activeColourIdx = i; renderPalette(); document.getElementById('ed-color-input').value = PALETTE[i] || '#000000'; };
    box.appendChild(sw);
  }
}

function renderFrames() {
  const box = document.getElementById('ed-frames');
  box.innerHTML = '';
  if (!Editor.activeKey) return;
  const sp = SPRITES[Editor.activeKey];
  sp.frames.forEach((frame, idx) => {
    const entry = document.createElement('div');
    entry.className = 'frame-thumb' + (idx === Editor.activeFrameIdx ? ' active' : '');
    const thumb = document.createElement('canvas');
    const h = frame.length, w = frame[0].length;
    const size = 48;
    const scale = Math.floor(size / Math.max(w, h));
    thumb.width = w * scale;
    thumb.height = h * scale;
    const tctx = thumb.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = frame[y][x];
        if (v === 0) continue;
        tctx.fillStyle = PALETTE[v] || '#f0f';
        tctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    entry.appendChild(thumb);
    const label = document.createElement('div');
    label.textContent = idx;
    entry.appendChild(label);
    entry.onclick = () => {
      Editor.activeFrameIdx = idx;
      renderEditor();
      renderFrames();
    };
    box.appendChild(entry);
  });
}

function addFrame() {
  if (!Editor.activeKey) return;
  const sp = SPRITES[Editor.activeKey];
  const base = sp.frames[0];
  const h = base.length, w = base[0].length;
  const empty = Array.from({ length: h }, () => new Array(w).fill(0));
  sp.frames.push(empty);
  Editor.activeFrameIdx = sp.frames.length - 1;
  if (clearSpriteCache) clearSpriteCache();
  renderEditor();
  renderFrames();
  renderSpriteList();
}

function dupFrame() {
  if (!Editor.activeKey) return;
  const sp = SPRITES[Editor.activeKey];
  const src = sp.frames[Editor.activeFrameIdx];
  sp.frames.push(src.map(row => row.slice()));
  Editor.activeFrameIdx = sp.frames.length - 1;
  if (clearSpriteCache) clearSpriteCache();
  renderEditor();
  renderFrames();
  renderSpriteList();
}

function delFrame() {
  if (!Editor.activeKey) return;
  const sp = SPRITES[Editor.activeKey];
  if (sp.frames.length <= 1) { alert('Must have at least one frame.'); return; }
  sp.frames.splice(Editor.activeFrameIdx, 1);
  Editor.activeFrameIdx = Math.min(Editor.activeFrameIdx, sp.frames.length - 1);
  if (clearSpriteCache) clearSpriteCache();
  renderEditor();
  renderFrames();
  renderSpriteList();
}

function clearFrame() {
  const frame = getActiveFrame();
  if (!frame) return;
  for (let y = 0; y < frame.length; y++) {
    for (let x = 0; x < frame[0].length; x++) {
      frame[y][x] = 0;
    }
  }
  if (clearSpriteCache) clearSpriteCache();
  renderEditor();
  renderFrames();
}

function createNewSprite() {
  const name = prompt('new sprite key (e.g. my_sprite):');
  if (!name) return;
  if (SPRITES[name]) { alert('already exists'); return; }
  const sizeStr = prompt('size (w,h) e.g. 16,16 or 32,32:', '16,16');
  if (!sizeStr) return;
  const parts = sizeStr.split(',').map(s => parseInt(s.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) { alert('bad size'); return; }
  const w = parts[0], h = parts[1];
  SPRITES[name] = {
    frames: [Array.from({ length: h }, () => new Array(w).fill(0))],
    speed: 500
  };
  if (clearSpriteCache) clearSpriteCache();
  renderSpriteList();
  selectSprite(name);
}

function exportSprites() {
  const parts = [];
  parts.push('// PALETTE');
  parts.push('const PALETTE = ' + JSON.stringify(PALETTE, null, 2) + ';');
  parts.push('');
  parts.push('// SPRITES');
  parts.push('const SPRITES = {');
  const keys = Object.keys(SPRITES);
  keys.forEach((k, i) => {
    const sp = SPRITES[k];
    parts.push('  ' + JSON.stringify(k) + ': {');
    parts.push('    frames: [');
    sp.frames.forEach((f, fi) => {
      parts.push('      [');
      f.forEach((row, ri) => {
        parts.push('        [' + row.join(',') + ']' + (ri < f.length - 1 ? ',' : ''));
      });
      parts.push('      ]' + (fi < sp.frames.length - 1 ? ',' : ''));
    });
    parts.push('    ],');
    parts.push('    speed: ' + (sp.speed || 500));
    parts.push('  }' + (i < keys.length - 1 ? ',' : ''));
  });
  parts.push('};');
  const text = parts.join('\n');
  document.getElementById('ed-export-text').value = text;
  document.getElementById('ed-export-modal').classList.add('open');
}

function updateGameStateInfo() {
  const el = document.getElementById('ed-gamestate-info');
  if (!el) return;
  el.textContent = 'phase: ' + GameState.phase + '  |  plants: ' + GameState.plants.filter(p => p).length +
                   '  |  cash: $' + formatMoney(GameState.cash);
}

function editorAnimatePreview(ts) {
  if (GameState.phase !== 'editor') { requestAnimationFrame(editorAnimatePreview); return; }
  if (!Editor.activeKey) { requestAnimationFrame(editorAnimatePreview); return; }
  const sp = SPRITES[Editor.activeKey];
  if (!sp) { requestAnimationFrame(editorAnimatePreview); return; }
  const ctx = Editor.previewCtx;
  if (!ctx) { requestAnimationFrame(editorAnimatePreview); return; }
  const speed = Editor.previewAnimSpeed || 500;
  if (ts - Editor.previewLastTick > speed) {
    Editor.previewLastTick = ts;
    Editor.previewFrameIdx = (Editor.previewFrameIdx + 1) % sp.frames.length;
  }
  const frame = sp.frames[Editor.previewFrameIdx];
  const w = frame[0].length, h = frame.length;
  const cw = Editor.previewCanvas.width, ch = Editor.previewCanvas.height;
  const scale = Math.floor(Math.min(cw / w, ch / h));
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, cw, ch);
  const ox = Math.floor((cw - w * scale) / 2);
  const oy = Math.floor((ch - h * scale) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = frame[y][x];
      if (v === 0) continue;
      ctx.fillStyle = PALETTE[v] || '#f0f';
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
  requestAnimationFrame(editorAnimatePreview);
}

function initEditor() {
  Editor.canvas = document.getElementById('ed-canvas');
  Editor.ctx = Editor.canvas.getContext('2d');
  Editor.previewCanvas = document.getElementById('ed-preview');
  Editor.previewCtx = Editor.previewCanvas.getContext('2d');

  Editor.canvas.addEventListener('mousedown', e => { Editor.mouseDown = true; editorPaint(e); });
  Editor.canvas.addEventListener('mousemove', e => { if (Editor.mouseDown) editorPaint(e); });
  window.addEventListener('mouseup', () => { Editor.mouseDown = false; });

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Editor.tool = btn.dataset.tool;
    };
  });

  document.getElementById('ed-add-frame').onclick = addFrame;
  document.getElementById('ed-dup-frame').onclick = dupFrame;
  document.getElementById('ed-del-frame').onclick = delFrame;
  document.getElementById('ed-clear-frame').onclick = clearFrame;
  document.getElementById('ed-new-btn').onclick = createNewSprite;
  document.getElementById('ed-save-game').onclick = () => {
    renderFrames();
    alert('Applied. Your edits are already live in the running game.');
  };
  document.getElementById('ed-export-btn').onclick = exportSprites;
  document.getElementById('ed-copy-export').onclick = async () => {
    const ta = document.getElementById('ed-export-text');
    try {
      await navigator.clipboard.writeText(ta.value);
      alert('Copied to clipboard.');
    } catch (e) {
      ta.select();
      document.execCommand('copy');
    }
  };

  document.getElementById('ed-anim-speed').onchange = e => {
    const v = parseInt(e.target.value) || 0;
    Editor.previewAnimSpeed = v;
    if (Editor.activeKey) SPRITES[Editor.activeKey].speed = v;
  };

  document.getElementById('ed-color-set').onclick = () => {
    const hex = document.getElementById('ed-color-input').value.toUpperCase();
    const idx = Editor.activeColourIdx;
    if (idx === 0) { alert('Cannot recolour transparent.'); return; }
    PALETTE[idx] = hex;
    renderPalette();
    renderEditor();
    renderFrames();
    renderSpriteList();
  };

  requestAnimationFrame(editorAnimatePreview);
}



  return { Editor, openEditor, closeEditor, renderSpriteList, selectSprite, getActiveFrame, resizeEditorCanvas, editorCell, editorPaint, renderEditor, renderPalette, renderFrames, addFrame, dupFrame, delFrame, clearFrame, createNewSprite, exportSprites, updateGameStateInfo, editorAnimatePreview, initEditor };
}
