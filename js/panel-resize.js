function toggleViewPanel() {
  viewCollapsed = !viewCollapsed;
  const panel = document.getElementById('panel');
  const btn = document.getElementById('view-toggle-btn');
  const modeBtn = document.getElementById('btn-toggle-output');
  const resizeHandle = document.getElementById('resize-panel');
  if (viewCollapsed) {
    viewSavedWidth = panel.offsetWidth;
    panel.classList.add('collapsed');
    if (btn) { btn.innerHTML = '&#10095;'; btn.title = 'Show View panel'; }
    if (modeBtn) modeBtn.innerHTML = '&#9654; Show Output';
    if (resizeHandle) resizeHandle.style.display = 'none';
  } else {
    panel.classList.remove('collapsed');
    panel.style.width = viewSavedWidth + 'px';
    if (btn) { btn.innerHTML = '&#10094;'; btn.title = 'Hide View panel'; }
    if (modeBtn) modeBtn.innerHTML = '&#9664; Hide Output';
    if (resizeHandle) resizeHandle.style.display = '';
  }
  setTimeout(() => { if(typeof Blockly !== 'undefined') Blockly.svgResize(workspace); }, 250);
}

// ── Simulator panel toggle ────────────────────────────────
let simCollapsed = false;
let simSavedWidth = 340;
function toggleSimPanel() {
  simCollapsed = !simCollapsed;
  const sp = document.getElementById('sim-panel');
  const btn = document.getElementById('sim-toggle-btn');
  const modeBtn = document.getElementById('btn-toggle-sim');
  const resizeHandle = document.getElementById('resize-sim');
  if (simCollapsed) {
    simSavedWidth = sp.offsetWidth;
    sp.classList.add('collapsed');
    if (btn) { btn.innerHTML = '&#10094;'; btn.title = 'Show Simulator'; }
    if (modeBtn) modeBtn.innerHTML = '&#9664; Show Sim';
    if (resizeHandle) resizeHandle.style.display = 'none';
  } else {
    sp.classList.remove('collapsed');
    sp.style.width = simSavedWidth + 'px';
    if (btn) { btn.innerHTML = '&#10095;'; btn.title = 'Hide Simulator'; }
    if (modeBtn) modeBtn.innerHTML = '&#9654; Hide Sim';
    if (resizeHandle) resizeHandle.style.display = '';
  }
  setTimeout(() => { if(typeof Blockly !== 'undefined') Blockly.svgResize(workspace); }, 250);
}

// ── Resize handles ────────────────────────────────────────
function initResizeHandle(handleId, targetId, side) {
  // side: 'left' = resize panel to the right of handle (shrink left-pane),
  //       'right' = resize panel itself
  const handle = document.getElementById(handleId);
  if (!handle) return;
  let startX, startY, startW, startH, isVert = false;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    const main = document.getElementById('main');
    const rect = main.getBoundingClientRect();
    isVert = window.innerWidth <= 900;
    if (isVert) {
      startY = e.clientY;
      startH = target.offsetHeight;
    } else {
      startX = e.clientX;
      startW = target.offsetWidth;
    }
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isVert ? 'row-resize' : 'col-resize';

    function onMove(ev) {
      const target2 = document.getElementById(targetId);
      if (isVert) {
        const dy = ev.clientY - startY;
        const newH = Math.max(80, Math.min(window.innerHeight * 0.7, startH + dy));
        target2.style.height = newH + 'px';
      } else {
        const dx = startX - ev.clientX; // dragging left = grow target
        const newW = Math.max(180, Math.min(window.innerWidth * 0.55, startW + dx));
        target2.style.width = newW + 'px';
      }
      if(typeof Blockly !== 'undefined') Blockly.svgResize(workspace);
    }
    function onUp() {
      handle.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Touch support
  handle.addEventListener('touchstart', e => {
    const t = e.touches[0];
    isVert = window.innerWidth <= 900;
    const target = document.getElementById(targetId);
    if (isVert) { startY = t.clientY; startH = target.offsetHeight; }
    else { startX = t.clientX; startW = target.offsetWidth; }
    handle.classList.add('dragging');

    function onTMove(ev) {
      const t2 = ev.touches[0];
      const target2 = document.getElementById(targetId);
      if (isVert) {
        const newH = Math.max(80, Math.min(window.innerHeight * 0.7, startH + t2.clientY - startY));
        target2.style.height = newH + 'px';
      } else {
        const newW = Math.max(180, Math.min(window.innerWidth * 0.55, startW + startX - t2.clientX));
        target2.style.width = newW + 'px';
      }
      if(typeof Blockly !== 'undefined') Blockly.svgResize(workspace);
    }
    function onTEnd() {
      handle.classList.remove('dragging');
      handle.removeEventListener('touchmove', onTMove);
      handle.removeEventListener('touchend', onTEnd);
    }
    handle.addEventListener('touchmove', onTMove, {passive:true});
    handle.addEventListener('touchend', onTEnd);
  }, {passive:true});
}

// Init both handles: dragging resize-panel resizes #panel; dragging resize-sim resizes #sim-panel
initResizeHandle('resize-panel', 'panel', 'left');
initResizeHandle('resize-sim', 'sim-panel', 'left');

// ── Window resize: re-trigger Blockly resize ──────────────
window.addEventListener('resize', () => {
  if(typeof Blockly !== 'undefined') setTimeout(() => Blockly.svgResize(workspace), 50);
});

// ═══════════════════════════════════════════════════════════
//  INIT BLOCKLY
// ═══════════════════════════════════════════════════════════
