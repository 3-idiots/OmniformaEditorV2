(function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  let rsmPort       = null;
  let rsmReader     = null;
  let rsmWriter     = null;
  let rsmReading    = false;
  let rsmRxCount    = 0;
  let rsmTxCount    = 0;
  let rsmLineBuffer = '';

  // ── DOM refs ────────────────────────────────────────────────
  const rsmEl       = () => document.getElementById('real-serial-monitor');
  const rsmOut      = () => document.getElementById('rsm-output');
  const rsmDot      = () => document.getElementById('rsm-dot');
  const rsmInput    = () => document.getElementById('rsm-input');
  const rsmSendBtn  = () => document.getElementById('rsm-send-btn');
  const rsmConnBtn  = () => document.getElementById('rsm-connect-btn');
  const rsmStatus   = () => document.getElementById('rsm-status-text');
  const rsmRxEl     = () => document.getElementById('rsm-rx-count');
  const rsmTxEl     = () => document.getElementById('rsm-tx-count');
  const rsmBaudDisp = () => document.getElementById('rsm-baud-disp');

  // ── Get the right edge of Blockly's toolbox in viewport px ──
  function getBlocklyToolboxRight() {
    const blocklyDiv = document.getElementById('blockly-div');
    if (!blocklyDiv) return 182;
    const bdRect = blocklyDiv.getBoundingClientRect();

    // Blockly renders a main SVG with class "blocklySvg" inside #blockly-div.
    // Inside that SVG there is a <g> element with a transform="translate(X,Y)" 
    // where X = toolboxWidth + flyoutWidth (the total left offset of the canvas).
    // This is the ground truth — read it directly.
    try {
      const svg = blocklyDiv.querySelector('svg.blocklySvg');
      if (svg) {
        // The workspace group has translate(toolboxWidth, 0)
        const workspaceG = svg.querySelector('g.blocklyWorkspace');
        if (workspaceG) {
          const transform = workspaceG.getAttribute('transform') || '';
          const m = transform.match(/translate\(([\d.]+)/);
          if (m) {
            const tx = parseFloat(m[1]);
            if (tx > 5) return bdRect.left + tx;
          }
        }
        // Alternative: look at blocklyBlockCanvas or blocklyBubbleCanvas group
        const canvas = svg.querySelector('g.blocklyBlockCanvas, g.blocklyBubbleCanvas');
        if (canvas) {
          const transform = canvas.getAttribute('transform') || '';
          const m = transform.match(/translate\(([\d.]+)/);
          if (m) {
            const tx = parseFloat(m[1]);
            if (tx > 5) return bdRect.left + tx;
          }
        }
      }
    } catch(e) {}

    // Fallback: read toolboxWidth from Blockly workspace metrics
    try {
      if (typeof workspace !== 'undefined' && workspace.getMetrics) {
        const m = workspace.getMetrics();
        // Different Blockly versions use different property names
        const tw = m.toolboxWidth || m.TOOLBOX_WIDTH || 0;
        if (tw > 0) return bdRect.left + tw;
      }
    } catch(e) {}

    // Last resort: 182px offset (typical Blockly category list width)
    return bdRect.left + 182;
  }

  // ── Position RSM based on panel collapse states ──────────────
  function rsmUpdatePosition() {
    const el = rsmEl();
    if (!el) return;

    const panel    = document.getElementById('panel');
    const simPanel = document.getElementById('sim-panel');

    const panelCollapsed = !panel    || panel.classList.contains('collapsed');
    const simCollapsed   = !simPanel || simPanel.classList.contains('collapsed');
    const bothCollapsed  = panelCollapsed && simCollapsed;

    el.classList.toggle('rsm-editor-mode', bothCollapsed);

    if (bothCollapsed) {
      // Both panels hidden — RSM lives in editor/blockly area
      const textPane   = document.getElementById('text-editor-pane');
      const inTextMode = textPane && textPane.style.display !== 'none';
      el.classList.toggle('rsm-blocks-mode', !inTextMode);
      el.classList.toggle('rsm-text-mode',    inTextMode);
      // left is handled purely by CSS classes (see #real-serial-monitor.rsm-blocks-mode)
      el.style.left  = '';
      el.style.right = '';
    } else {
      // At least one right panel visible — anchor to its left edge
      el.classList.remove('rsm-blocks-mode', 'rsm-text-mode');
      let leftEdge = null;
      if (!panelCollapsed && panel) {
        const r = panel.getBoundingClientRect();
        if (r.width > 40) leftEdge = r.left;
      }
      if (!simCollapsed && simPanel) {
        const r = simPanel.getBoundingClientRect();
        if (r.width > 40 && (leftEdge === null || r.left < leftEdge)) leftEdge = r.left;
      }
      el.style.left  = (leftEdge !== null ? leftEdge : 0) + 'px';
      el.style.right = '0px';
    }
  }

  // ── Toggle visibility ────────────────────────────────────────
  window.rsmToggle = function() {
    const el = rsmEl();
    const btn = document.getElementById('btn-toggle-real-serial');
    const hidden = el.classList.toggle('rsm-hidden');
    if (btn) btn.classList.toggle('active', !hidden);
    if (!hidden) {
      rsmUpdatePosition();
      rsmLog('sys', 'Serial Monitor opened.');
    }
  };

  // Re-position on window resize
  window.addEventListener('resize', () => {
    if (rsmEl() && !rsmEl().classList.contains('rsm-hidden')) rsmUpdatePosition();
  });
  // Re-position continuously (handles panel drag-resize + collapse transitions)
  setInterval(() => {
    if (rsmEl() && !rsmEl().classList.contains('rsm-hidden')) rsmUpdatePosition();
  }, 100);

  // Also re-position whenever Blockly injects new DOM into #blockly-div
  // (catches toolbox rendering after workspace init)
  setTimeout(() => {
    const blocklyDiv = document.getElementById('blockly-div');
    if (blocklyDiv) {
      const mo = new MutationObserver(() => {
        if (rsmEl() && !rsmEl().classList.contains('rsm-hidden')) {
          rsmUpdatePosition();
        }
      });
      mo.observe(blocklyDiv, { childList: true, subtree: true, attributes: true });
    }
  }, 500);

  // ── Log a line ───────────────────────────────────────────────
  function rsmLog(type, text) {
    const out = rsmOut();
    if (!out) return;
    const line = document.createElement('div');
    line.className = 'rsm-line-' + type;
    const ts = document.getElementById('rsm-autoscroll') ? '' : '';
    const now = new Date();
    const timeStr = now.toTimeString().slice(0,8);
    line.innerHTML = '<span class="rsm-ts">' + timeStr + '</span>' + escapeHtml(text);
    out.appendChild(line);
    if (document.getElementById('rsm-autoscroll') && document.getElementById('rsm-autoscroll').checked) {
      out.scrollTop = out.scrollHeight;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;');
  }

  // ── Connect / Disconnect ─────────────────────────────────────
  let rsmWritableController = null;  // AbortController for writable pipe
  let rsmReadableController = null;  // AbortController for readable pipe
  let rsmWritableClosed     = null;  // Promise — writable pipe done
  let rsmReadableClosed     = null;  // Promise — readable pipe done

  window.rsmConnect = async function() {
    if (rsmPort) {
      await rsmDisconnect();
      return;
    }

    if (!('serial' in navigator)) {
      rsmLog('err', '✗ Web Serial API not supported. Use Chrome/Edge 89+ over HTTPS or localhost.');
      rsmStatus().textContent = 'Web Serial not supported';
      return;
    }

    try {
      rsmStatus().textContent = 'Picking port…';
      rsmPort = await navigator.serial.requestPort();
      const baud = parseInt(document.getElementById('rsm-baud-select').value) || 9600;
      await rsmPort.open({ baudRate: baud });

      // Update UI
      rsmDot().classList.add('connected');
      rsmConnBtn().textContent = '⏏ Disconnect';
      rsmConnBtn().className = 'rsm-btn rsm-btn-disconnect';
      rsmInput().disabled = false;
      rsmSendBtn().disabled = false;
      rsmBaudDisp().textContent = '● ' + baud + ' baud';
      rsmBaudDisp().style.color = '#4ec9b0';
      rsmStatus().textContent = 'Connected @ ' + baud + ' baud';
      rsmLog('sys', '✔ Connected @ ' + baud + ' baud');

      // ── Writer — store the pipe so we can abort it on disconnect ──
      rsmWritableController = new AbortController();
      const textEncoder = new TextEncoderStream();
      rsmWritableClosed = textEncoder.readable.pipeTo(
        rsmPort.writable,
        { signal: rsmWritableController.signal }
      ).catch(() => {});
      rsmWriter = textEncoder.writable.getWriter();

      // ── Reader — store the pipe so we can abort it on disconnect ──
      rsmReadableController = new AbortController();
      const textDecoder = new TextDecoderStream();
      rsmReadableClosed = rsmPort.readable.pipeTo(
        textDecoder.writable,
        { signal: rsmReadableController.signal }
      ).catch(() => {});
      rsmReader = textDecoder.readable.getReader();

      rsmReading = true;
      rsmReadLoop();

    } catch (err) {
      if (err.name === 'NotFoundError' || err.message.includes('No port selected')) {
        rsmStatus().textContent = 'No port selected';
      } else {
        rsmLog('err', '✗ ' + err.message);
        rsmStatus().textContent = 'Error: ' + err.message;
      }
      rsmPort = null;
    }
  };

  async function rsmReadLoop() {
    rsmLineBuffer = '';
    try {
      while (rsmReading) {
        const { value, done } = await rsmReader.read();
        if (done) break;
        if (value) {
          rsmRxCount += value.length;
          if (rsmRxEl()) rsmRxEl().textContent = rsmRxCount;
          for (const ch of value) {
            if (ch === '\n') {
              rsmLog('rx', rsmLineBuffer);
              rsmLineBuffer = '';
            } else if (ch !== '\r') {
              rsmLineBuffer += ch;
            }
          }
        }
      }
    } catch (err) {
      if (rsmReading) rsmLog('err', '✗ Read error: ' + err.message);
    } finally {
      try { rsmReader.releaseLock(); } catch(_) {}
      rsmReader = null;
    }
    if (rsmReading) await rsmDisconnect(true);
  }

  async function rsmDisconnect(fromError) {
    rsmReading = false;

    // 1. Cancel the reader — stops the read loop
    if (rsmReader) {
      try { await rsmReader.cancel(); } catch(_) {}
      try { rsmReader.releaseLock(); }  catch(_) {}
      rsmReader = null;
    }

    // 2. Abort the readable pipe — unblocks port.readable
    if (rsmReadableController) {
      rsmReadableController.abort();
      rsmReadableController = null;
    }
    if (rsmReadableClosed) {
      try { await rsmReadableClosed; } catch(_) {}
      rsmReadableClosed = null;
    }

    // 3. Close the writer — flushes + closes TextEncoderStream
    if (rsmWriter) {
      try { await rsmWriter.close(); } catch(_) {}
      try { rsmWriter.releaseLock(); } catch(_) {}
      rsmWriter = null;
    }

    // 4. Abort the writable pipe — unblocks port.writable
    if (rsmWritableController) {
      rsmWritableController.abort();
      rsmWritableController = null;
    }
    if (rsmWritableClosed) {
      try { await rsmWritableClosed; } catch(_) {}
      rsmWritableClosed = null;
    }

    // 5. Now the port streams are fully released — safe to close
    if (rsmPort) {
      try { await rsmPort.close(); } catch(e) {
        // Already closed (e.g. device unplugged) — ignore
      }
      rsmPort = null;
    }

    // 6. Update UI
    rsmDot().classList.remove('connected');
    rsmConnBtn().textContent = '🔗 Connect';
    rsmConnBtn().className = 'rsm-btn rsm-btn-connect';
    rsmInput().disabled = true;
    rsmSendBtn().disabled = true;
    rsmBaudDisp().textContent = '● disconnected';
    rsmBaudDisp().style.color = '#444';
    rsmStatus().textContent = fromError ? 'Disconnected (device removed?)' : 'Disconnected';
    rsmLog('sys', fromError ? '⚠ Device disconnected.' : '✔ Port closed.');

    // Keep upload button visible so user can still flash after disconnect
    const rsmUpl = document.getElementById('rsm-upload-btn');
    if (rsmUpl && window._lastHexUrl) rsmUpl.style.display = 'inline-block';
  }

  // ── Upload sketch to Arduino via arduino-web-uploader ────────
  window.rsmUploadSketch = function() {
    if (!window._lastHexUrl) {
      rsmLog('err', '✗ No compiled sketch — run Compile & Upload first.');
      showToast('No sketch compiled yet', 'warn', 'Click "Compile & Upload" first to build the sketch.');
      return;
    }
    // Use the existing uploadBtn mechanism — click it programmatically
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
      uploadBtn.setAttribute('hex-href', window._lastHexUrl);
      uploadBtn.setAttribute('board', window._lastBoard || 'uno');
      uploadBtn.style.display = 'inline-block';
      rsmLog('sys', '⬆ Launching uploader — pick your serial port…');
      uploadBtn.click();
    } else {
      rsmLog('err', '✗ Uploader not available.');
    }
  };

  // ── Send data ────────────────────────────────────────────────
  window.rsmSend = async function() {
    const input = rsmInput();
    if (!rsmWriter || !input) return;
    let text = input.value;
    if (!text) return;

    const lineEnd = document.getElementById('rsm-line-end').value;
    let suffix = '';
    if (lineEnd === 'nl')   suffix = '\n';
    if (lineEnd === 'cr')   suffix = '\r';
    if (lineEnd === 'both') suffix = '\r\n';

    try {
      await rsmWriter.write(text + suffix);
      rsmTxCount += (text + suffix).length;
      if (rsmTxEl()) rsmTxEl().textContent = rsmTxCount;
      rsmLog('tx', '→ ' + text);
      input.value = '';
    } catch(err) {
      rsmLog('err', '✗ Send error: ' + err.message);
    }
  };

  // ── Clear output ─────────────────────────────────────────────
  window.rsmClear = function() {
    const out = rsmOut();
    if (out) out.innerHTML = '';
    rsmRxCount = 0; rsmTxCount = 0;
    if (rsmRxEl()) rsmRxEl().textContent = '0';
    if (rsmTxEl()) rsmTxEl().textContent = '0';
  };

  // ── Resize handle (drag) ─────────────────────────────────────
  function initRsmResize() {
    const handle = document.getElementById('rsm-resize-handle');
    const panel  = rsmEl();
    if (!handle || !panel) return;
    let startY, startH;
    handle.addEventListener('mousedown', e => {
      startY = e.clientY;
      startH = panel.offsetHeight;
      handle.classList.add('dragging');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', e => {
      if (!handle.classList.contains('dragging')) return;
      const delta = startY - e.clientY; // drag up = bigger
      let newH = Math.max(80, Math.min(window.innerHeight * 0.8, startH + delta));
      panel.style.height = newH + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (handle.classList.contains('dragging')) {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initRsmResize);
  // Also init after slight delay in case DOM is already ready
  setTimeout(initRsmResize, 300);

  // Auto-reconnect on device attach (optional, requires permission)
  if ('serial' in navigator) {
    navigator.serial.addEventListener('connect', e => {
      rsmLog('sys', '⚡ Serial device attached');
    });
    navigator.serial.addEventListener('disconnect', e => {
      if (rsmPort) rsmDisconnect(true);
    });
  }

})();
