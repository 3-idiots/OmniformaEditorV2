window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('render_url');
  if (saved) document.getElementById('render-url').value = saved;
  document.getElementById('render-url').addEventListener('blur', function() {
    localStorage.setItem('render_url', this.value.trim());
  });
});

async function doCloudCompile() {
  const url = document.getElementById('render-url').value.trim().replace(/\/$/, '');
  if (!url) { alert('Enter your Render server URL first'); return; }
  localStorage.setItem('render_url', url);

  // ── UI: loading state ────────────────────────────────────
  const compileBtn = document.querySelector('button[onclick="doCloudCompile()"]');
  const uploadBtn  = document.getElementById('uploadBtn');
  if (compileBtn) { compileBtn.disabled = true; compileBtn.textContent = '⏳ Compiling...'; }
  uploadBtn.style.display = 'none';
  window.realHex = null;
  hidePanelError();
  setStatus('Compiling via GitHub Actions... (~60-90 seconds)', 'ok');

  let code;
  try {
    if (currentMode === 'text') {
      code = document.getElementById('mcu-editor').value;
      if (!code.trim()) { setStatus('Nothing to compile', 'error'); if(compileBtn){compileBtn.disabled=false;compileBtn.innerHTML='&#9729; Compile &amp; Upload';} return; }
    } else {
      const blocks = workspaceToBlocks();
      if (!blocks.length) { setStatus('No blocks to compile', 'error'); if(compileBtn){compileBtn.disabled=false;compileBtn.innerHTML='&#9729; Compile &amp; Upload';} return; }
      code = blocksToCpp(blocks);
    }
  } catch(e) {
    setStatus('Code error: ' + e.message, 'error');
    if(compileBtn){compileBtn.disabled=false;compileBtn.innerHTML='&#9729; Compile &amp; Upload';}
    return;
  }

  const fqbnMap = {
    uno:'arduino:avr:uno', mega:'arduino:avr:mega', nano:'arduino:avr:nano',
    esp32:'esp32:esp32:esp32', rp2040:'rp2040:rp2040:rpipico', leonado:'arduino:avr:leonardo'
  };
  const fqbn = fqbnMap[currentBoardKey] || 'arduino:avr:uno';

  try {
    const res  = await fetch(url + '/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, fqbn })
    });
    const data = await res.json();

    if (!data.success) {
      setStatus('Compile failed — see panel', 'error');
      showPanelError(data.error, 'Compile Error');
      showToast('Cloud Compile Failed', 'error', 'Check the error panel for details');
      document.getElementById('out-cpp').innerHTML = highlightCPP(code);
      showTab('cpp');
      if(compileBtn){compileBtn.disabled=false;compileBtn.innerHTML='&#9729; Compile &amp; Upload';}
      return;
    }

    // ── Success ──────────────────────────────────────────────
    window.realHex = data.hex;

    // Store hex for download and show in HEX tab
    document.getElementById('out-hex').innerHTML =
      '<pre style="margin:0;background:#0d1117;border-radius:7px;padding:11px;border:1px solid #1d9e75;font-size:11px;color:#3fb950;white-space:pre-wrap;word-break:break-all;">' +
      data.hex.trim() + '</pre>';

    // Upload button (topbar)
    const blob   = new Blob([data.hex], { type: 'text/plain' });
    const hexUrl = URL.createObjectURL(blob);
    uploadBtn.setAttribute('hex-href', hexUrl);
    uploadBtn.setAttribute('board', currentBoardKey || 'uno');
    uploadBtn.style.display = 'inline-block';

    // ── Also show Upload button inside Serial Monitor ─────────
    window._lastHexBlob = blob;
    window._lastHexUrl  = hexUrl;
    window._lastBoard   = currentBoardKey || 'uno';
    const rsmUpl = document.getElementById('rsm-upload-btn');
    if (rsmUpl) rsmUpl.style.display = 'inline-block';

    // Green success panel
    const bar     = document.getElementById('panel-error-bar');
    const msgEl   = document.getElementById('panel-error-msg');
    const titleEl = bar && bar.querySelector('.err-title span');
    if (bar && msgEl) {
      msgEl.textContent = 'Sketch compiled successfully via GitHub Actions!\nReal HEX is ready — click Upload to flash your Arduino, or download .hex from the topbar.';
      bar.style.display = 'block';
      bar.style.borderTopColor = '#1d9e75';
      bar.style.background = '#0a1a0a';
      if (titleEl) { titleEl.textContent = '✓ Compile Successful'; titleEl.style.color = '#3fb950'; }
    }

    setStatus('✓ Compiled! Click Upload to flash Arduino.');
    showToast('Cloud Compile OK', 'ok', 'Ready to upload to Arduino');
    document.getElementById('out-cpp').innerHTML = highlightCPP(code);
    showTab('cpp');
    // Rebuild simulator with the actual C++ code — stop sim if running first
    if (simRunning) {
      simRunning = false;
      clearInterval(simTimer);
      const btn = document.getElementById("btn-sim-run");
      if (btn) { btn.textContent = "▶ Run"; btn.classList.remove("running"); }
    }
    simStmtQueue = [];
    initSimPins();
    buildSimProgram(code);
    applyInputPullupDefaults(code);
    renderPinTable();
    renderAnalogTable();
    renderBoardSVG(currentBoardKey);

  } catch(e) {
    setStatus('Server error: ' + e.message, 'error');
    showPanelError('Could not reach Render server: ' + e.message);
  } finally {
    // Always restore compile button
    if(compileBtn){compileBtn.disabled=false;compileBtn.innerHTML='&#9729; Compile &amp; Upload';}
  }
}


// ═══════════════════════════════════════════════════════════
//  COMPONENT SIMULATOR
//  Visual simulation for LCD, OLED, Servo, NeoPixel,
//  DHT, TM1637, Stepper, Buzzer, Ultrasonic
// ═══════════════════════════════════════════════════════════

// Singleton state (components where only one instance makes sense)
const compState = {
  oled:      { pixels: null, w: 128, h: 64, cursor: [0,0], textSize: 1, on: false },
  tm:        { value: 0, brightness: 7 },
  rgbled:    { r: 0, g: 0, b: 0 },
  wire:      { log: [], addr: 0, buffer: [] },
};

// Multi-instance state maps — keyed by object name
const compInst = {
  servos:   {},   // name → { angle: 90 }
  lcds:     {},   // name → { rows:[], cols:16, rows_n:2, cursor:[0,0] }
  dhts:     {},   // name → { temp:25, humidity:60 }
  neos:     {},   // name → { pixels:[], count:8, brightness:50 }
  steppers: {},   // name → { steps:0, angle:0 }
  buzzers:  {},   // pin  → { active:false, freq:0 }
  ultras:   {},   // name → { distance:0 }
  buttons:  {},   // pin  → { pressed:false, label:'' }
};

// Helper — get or create an instance
function getInst(map, key, defaults) {
  if (!map[key]) map[key] = { ...defaults };
  return map[key];
}

let compDetected = {}; // which component types are in use + their name lists

// ── Detect components from C++ code ─────────────────────────
function detectComponents(cpp) {
  compDetected = {};

  // ── Servo ──
  {
    const names = new Set();
    for (const m of cpp.matchAll(/Servo\s+(\w+)\s*;/g)) names.add(m[1]);
    for (const m of cpp.matchAll(/(\w+)\.attach\s*\(/g)) names.add(m[1]);
    if (names.size > 0) {
      compDetected.servo = true;
      compDetected.servoNames = [...names];
      for (const n of names) getInst(compInst.servos, n, { angle: 90 });
    }
  }

  // ── LCD ──
  {
    const names = new Set();
    for (const m of cpp.matchAll(/LiquidCrystal\s+(\w+)\s*\(/g)) names.add(m[1]);
    if (names.size === 0 && /lcd\.begin\(/.test(cpp)) names.add('lcd');
    if (names.size > 0) {
      compDetected.lcd = true;
      compDetected.lcdNames = [...names];
      for (const n of names) {
        const inst = getInst(compInst.lcds, n, { rows:[], cols:16, rows_n:2, cursor:[0,0] });
        // Parse dimensions from name.begin(cols, rows)
        const dimM = cpp.match(new RegExp(n + '\\.begin\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)'));
        if (dimM) { inst.cols = parseInt(dimM[1]); inst.rows_n = parseInt(dimM[2]); }
        inst.rows = Array(inst.rows_n).fill(' '.repeat(inst.cols));
      }
    }
  }

  // ── DHT ──
  {
    const names = new Set();
    for (const m of cpp.matchAll(/DHT\s+(\w+)\s*\(/g)) names.add(m[1]);
    if (names.size === 0 && /\.readTemperature\(/.test(cpp)) names.add('dht');
    if (names.size > 0) {
      compDetected.dht = true;
      compDetected.dhtNames = [...names];
      for (const n of names) getInst(compInst.dhts, n, { temp: 25.0, humidity: 60.0 });
    }
  }

  // ── NeoPixel ──
  {
    const names = new Set();
    for (const m of cpp.matchAll(/Adafruit_NeoPixel\s+(\w+)\s*\(/g)) names.add(m[1]);
    if (names.size === 0 && /NeoPixel/.test(cpp)) names.add('strip');
    if (names.size > 0) {
      compDetected.neo = true;
      compDetected.neoNames = [...names];
      for (const n of names) {
        const countM = cpp.match(new RegExp('Adafruit_NeoPixel\\s+' + n + '\\s*\\(\\s*(\\d+)'));
        const count = countM ? parseInt(countM[1]) : 8;
        const inst = getInst(compInst.neos, n, { pixels:[], count, brightness:50 });
        inst.count = count;
        inst.pixels = Array(count).fill(null).map(() => ({r:0,g:0,b:0}));
      }
    }
  }

  // ── Stepper ──
  {
    const names = new Set();
    for (const m of cpp.matchAll(/Stepper\s+(\w+)\s*\(/g)) names.add(m[1]);
    if (names.size === 0 && /\.setSpeed\(/.test(cpp)) names.add('stepper');
    if (names.size > 0) {
      compDetected.stepper = true;
      compDetected.stepperNames = [...names];
      for (const n of names) getInst(compInst.steppers, n, { steps:0, angle:0 });
    }
  }

  // ── Buzzer / Tone ──
  {
    const pins = new Set();
    for (const m of cpp.matchAll(/tone\s*\(\s*(\w+)/g)) pins.add(m[1]);
    if (/Buzzer/.test(cpp)) pins.add('buzzer');
    if (pins.size > 0) {
      compDetected.buzzer = true;
      compDetected.buzzerPins = [...pins];
      for (const p of pins) getInst(compInst.buzzers, p, { active:false, freq:0 });
    }
  }

  // ── Ultrasonic ──
  {
    const names = new Set();
    for (const m of cpp.matchAll(/NewPing\s+(\w+)\s*\(/g)) names.add(m[1]);
    if (names.size === 0 && (/pulseIn\(/.test(cpp) || /HC-SR04/.test(cpp))) names.add('sonar');
    if (names.size > 0) {
      compDetected.ultra = true;
      compDetected.ultraNames = [...names];
      for (const n of names) getInst(compInst.ultras, n, { distance:0 });
    }
  }

  // ── Singletons ──
  if (/Adafruit_SSD1306/.test(cpp) || /display\.begin\(/.test(cpp)) compDetected.oled = true;
  if (/TM1637/.test(cpp) || /tm\.show/.test(cpp))                    compDetected.tm   = true;
  if (/RGBLed|rgb\.set_color|analogWrite.*r_pin/.test(cpp))          compDetected.rgbled = true;
  if (/Wire\.begin|Wire\.write|Wire\.read|Wire\.requestFrom/.test(cpp)) compDetected.wire = true;

  // ── Buttons — any pin declared INPUT_PULLUP or INPUT gets a clickable button widget ──
  {
    // Build a local pinMap to resolve named constants (e.g. BUTTON_PIN → 2)
    const localPinMap = {};
    for (const m of cpp.matchAll(/#define\s+(\w+)\s+(\d+)/g)) localPinMap[m[1]] = parseInt(m[2]);
    for (const m of cpp.matchAll(/\bconst\s+(?:int|byte|uint8_t)\s+(\w+)\s*=\s*(\d+);/g)) localPinMap[m[1]] = parseInt(m[2]);

    const pins = new Set();
    // Track pin number → label (constant name if available)
    const pinLabels = {};
    for (const m of cpp.matchAll(/pinMode\s*\(\s*(\w+)\s*,\s*INPUT(?:_PULLUP)?\s*\)/g)) {
      const raw = m[1];
      const pinNum = isNaN(parseInt(raw)) ? localPinMap[raw] : parseInt(raw);
      if (pinNum !== undefined && !isNaN(pinNum)) {
        pins.add(String(pinNum));
        // Use the constant name as label if it's not just a number
        pinLabels[String(pinNum)] = isNaN(parseInt(raw)) ? raw : `Pin ${pinNum}`;
      }
    }
    if (pins.size > 0) {
      compDetected.button = true;
      compDetected.buttonPins = [...pins];
      for (const p of pins) {
        getInst(compInst.buttons, p, { pressed: false, label: pinLabels[p] || `Pin ${p}` });
        const n = parseInt(p);
        if (simPins[n]) { simPins[n].mode = 'INPUT'; simPins[n].value = 'HIGH'; }
      }
    }
  }

  // Get NeoPixel legacy count (for backward compat)
  const neoM = cpp.match(/NeoPixel\s+\w+\s*\(\s*(\d+)/);
  if (neoM && compDetected.neo) {
    const firstName = compDetected.neoNames && compDetected.neoNames[0];
    if (firstName && compInst.neos[firstName]) compInst.neos[firstName].count = parseInt(neoM[1]);
  }
}

// ── Render all detected component widgets ───────────────────
function renderCompWidgets() {
  const body = document.getElementById('comp-sim-body');
  if (!body) return;

  const hasAny = Object.keys(compDetected).length > 0;
  const emptyMsg = document.getElementById('comp-empty-msg');
  const tabBtn = document.getElementById('sim-tab-btn-comp');

  if (emptyMsg) emptyMsg.style.display = hasAny ? 'none' : 'block';
  if (tabBtn) tabBtn.style.opacity = hasAny ? '1' : '0.45';

  body.innerHTML = '';
  if (!hasAny) return;

  if (compDetected.lcd)     (compDetected.lcdNames||['lcd']).forEach(n => body.appendChild(makeLCDWidget(n)));
  if (compDetected.oled)    body.appendChild(makeOLEDWidget());
  if (compDetected.servo)   (compDetected.servoNames||['myServo']).forEach(n => body.appendChild(makeServoWidget(n)));
  if (compDetected.neo)     (compDetected.neoNames||['strip']).forEach(n => body.appendChild(makeNeoWidget(n)));
  if (compDetected.dht)     (compDetected.dhtNames||['dht']).forEach(n => body.appendChild(makeDHTWidget(n)));
  if (compDetected.tm)      body.appendChild(makeTMWidget());
  if (compDetected.stepper) (compDetected.stepperNames||['stepper']).forEach(n => body.appendChild(makeStepperWidget(n)));
  if (compDetected.buzzer)  (compDetected.buzzerPins||['buzzer']).forEach(p => body.appendChild(makeBuzzerWidget(p)));
  if (compDetected.ultra)   (compDetected.ultraNames||['sonar']).forEach(n => body.appendChild(makeUltraWidget(n)));
  if (compDetected.wire)    body.appendChild(makeWireWidget());
  if (compDetected.rgbled)  body.appendChild(makeRGBWidget());
  if (compDetected.button)  body.appendChild(makeButtonWidget());

  if (hasAny) showSimTab('comp');
}

// ── Widget factories ─────────────────────────────────────────
function makeWidget(id, title, inner) {
  const d = document.createElement('div');
  d.className = 'comp-widget';
  d.id = 'comp-' + id;
  d.innerHTML = `<div class="comp-title">${title}</div>${inner}`;
  return d;
}

function makeLCDWidget(name) {
  name = name || 'lcd';
  const inst = getInst(compInst.lcds, name, { rows:[], cols:16, rows_n:2, cursor:[0,0] });
  inst.rows = Array(inst.rows_n).fill(' '.repeat(inst.cols));
  const rows = Array(inst.rows_n).fill(0).map((_,i) =>
    `<div class="sim-lcd-row" id="sim-lcd-row-${name}-${i}">${' '.repeat(inst.cols)}</div>`
  ).join('');
  return makeWidget(`lcd-${name}`, `📺 LCD ${inst.cols}×${inst.rows_n} (${name})`,
    `<div class="sim-lcd">${rows}</div>`);
}

function makeOLEDWidget() {
  return makeWidget('oled', '🟦 OLED 128×64',
    `<canvas id="sim-oled-canvas" width="128" height="64" style="border:1px solid #378add;border-radius:2px;image-rendering:pixelated;width:100%;"></canvas>`);
}

function makeServoWidget(name) {
  name = name || 'myServo';
  const inst = getInst(compInst.servos, name, { angle: 90 });
  return makeWidget(`servo-${name}`, `⚙ Servo (${name})`,
    `<div class="sim-servo-wrap">
      <svg width="60" height="60">
        <circle cx="30" cy="30" r="24" fill="#21262d" stroke="#534AB7" stroke-width="2"/>
        <circle cx="30" cy="30" r="4" fill="#7f77dd"/>
        <line id="sim-servo-arm-${name}" x1="30" y1="30" x2="30" y2="8" stroke="#d2a8ff" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <div>
        <div class="sim-servo-deg" id="sim-servo-deg-${name}">${inst.angle}°</div>
        <input type="range" min="0" max="180" value="${inst.angle}" id="sim-servo-sl-${name}"
          style="width:80px;" oninput="simServoSet('${name}', this.value)"/>
      </div>
    </div>`);
}

function makeNeoWidget(name) {
  name = name || 'strip';
  const inst = getInst(compInst.neos, name, { pixels:[], count:8, brightness:50 });
  const pxs = Array(inst.count).fill(0).map((_,i) =>
    `<div class="sim-neo-px" id="sim-neo-px-${name}-${i}" title="LED ${i}"></div>`
  ).join('');
  return makeWidget(`neo-${name}`, `💡 NeoPixel ${inst.count} LEDs (${name})`,
    `<div class="sim-neo-strip">${pxs}</div>`);
}

function makeDHTWidget(name) {
  name = name || 'dht';
  const inst = getInst(compInst.dhts, name, { temp:25.0, humidity:60.0 });
  return makeWidget(`dht-${name}`, `🌡 DHT (${name})`,
    `<div style="display:flex;gap:16px;">
      <div>
        <div class="sim-dht-val" id="sim-dht-temp-${name}">${inst.temp.toFixed(1)}°C</div>
        <div class="sim-dht-label">Temperature</div>
        <input type="range" min="-40" max="80" value="${inst.temp}" step="0.5" id="sim-dht-temp-sl-${name}"
          style="width:70px;" oninput="simDHTSet('${name}','temp',this.value)"/>
      </div>
      <div>
        <div class="sim-dht-val" id="sim-dht-hum-${name}">${inst.humidity.toFixed(1)}%</div>
        <div class="sim-dht-label">Humidity</div>
        <input type="range" min="0" max="100" value="${inst.humidity}" step="1" id="sim-dht-hum-sl-${name}"
          style="width:70px;" oninput="simDHTSet('${name}','hum',this.value)"/>
      </div>
    </div>`);
}

function makeTMWidget() {
  return makeWidget('tm', '🔢 TM1637 Display',
    `<div class="sim-tm" id="sim-tm-disp">0000</div>`);
}

function makeStepperWidget(name) {
  name = name || 'stepper';
  return makeWidget(`stepper-${name}`, `🔄 Stepper (${name})`,
    `<div style="display:flex;align-items:center;gap:10px;">
      <svg width="60" height="60">
        <circle cx="30" cy="30" r="24" fill="#21262d" stroke="#1d9e75" stroke-width="2"/>
        <circle cx="30" cy="30" r="4" fill="#3fb950"/>
        <line id="sim-stepper-arm-${name}" x1="30" y1="30" x2="30" y2="8" stroke="#3fb950" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <div style="font-size:10px;color:#8b949e;">
        <div>Steps: <span id="sim-stepper-steps-${name}" style="color:#3fb950;">0</span></div>
        <div>Angle: <span id="sim-stepper-angle-${name}" style="color:#3fb950;">0°</span></div>
      </div>
    </div>`);
}

function makeBuzzerWidget(pin) {
  pin = pin || 'buzzer';
  return makeWidget(`buzzer-${pin}`, `🔊 Buzzer (pin ${pin})`,
    `<div style="display:flex;align-items:center;gap:10px;">
      <div class="sim-buzzer" id="sim-buzzer-icon-${pin}">🔇</div>
      <div style="font-size:10px;color:#8b949e;">
        <div>Freq: <span id="sim-buzzer-freq-${pin}" style="color:#f0883e;">0</span> Hz</div>
        <div id="sim-buzzer-state-${pin}" style="color:#555;">Silent</div>
      </div>
    </div>`);
}

function makeUltraWidget(name) {
  name = name || 'sonar';
  const inst = getInst(compInst.ultras, name, { distance:0 });
  return makeWidget(`ultra-${name}`, `📡 Ultrasonic (${name})`,
    `<div>
      <div class="sim-ultra-val" id="sim-ultra-dist-${name}">${inst.distance.toFixed(1)} cm</div>
      <input type="range" min="2" max="400" value="${inst.distance||20}" id="sim-ultra-sl-${name}"
        style="width:100%;margin-top:4px;" oninput="simUltraSet('${name}',this.value)"/>
      <div style="font-size:9px;color:#555;margin-top:2px;">Drag to simulate distance</div>
    </div>`);
}

function makeWireWidget() {
  return makeWidget('wire', '🔗 I2C / Wire',
    `<div style="font-size:10px;color:#8b949e;">
      <div style="display:flex;gap:8px;margin-bottom:4px;">
        <div>SDA: <span style="color:#79c0ff;">Pin A4</span></div>
        <div>SCL: <span style="color:#79c0ff;">Pin A5</span></div>
      </div>
      <div id="sim-wire-log" style="background:#010409;border:1px solid #21262d;border-radius:4px;padding:4px;height:60px;overflow-y:auto;font-family:monospace;font-size:9px;color:#3fb950;"></div>
    </div>`);
}

function makeRGBWidget() {
  return makeWidget('rgbled', '🌈 RGB LED',
    `<div style="display:flex;align-items:center;gap:10px;">
      <div id="sim-rgb-circle" style="width:36px;height:36px;border-radius:50%;background:#000;border:2px solid #21262d;transition:background .15s;"></div>
      <div style="font-size:9px;color:#8b949e;">
        <div>R:<span id="sim-rgb-r">0</span> G:<span id="sim-rgb-g">0</span> B:<span id="sim-rgb-b">0</span></div>
      </div>
    </div>`);
}

function makeButtonWidget() {
  const pins = compDetected.buttonPins || [];
  const btns = pins.map(p => {
    const inst = getInst(compInst.buttons, p, { pressed: false, label: `Pin ${p}` });
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
      <button id="sim-btn-${p}"
        class="sim-push-btn${inst.pressed ? ' pressed' : ''}"
        onmousedown="simButtonPress('${p}',true)"
        onmouseup="simButtonPress('${p}',false)"
        onmouseleave="simButtonPress('${p}',false)"
        ontouchstart="simButtonPress('${p}',true)"
        ontouchend="simButtonPress('${p}',false)"
      >${inst.pressed ? '●' : '○'}</button>
      <span style="font-size:9px;color:var(--text-muted);">${inst.label}</span>
    </div>`;
  }).join('');
  return makeWidget('buttons', '🔘 Buttons',
    `<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;">${btns}</div>`);
}

// ── Update component widgets from simState ───────────────────
function updateCompWidgets() {
  // LCD — all instances
  if (compDetected.lcd) {
    for (const name of (compDetected.lcdNames||['lcd'])) {
      const inst = compInst.lcds[name];
      if (!inst) continue;
      for (let r = 0; r < inst.rows_n; r++) {
        const el = document.getElementById(`sim-lcd-row-${name}-${r}`);
        if (el) el.textContent = (inst.rows[r]||'').padEnd(inst.cols).slice(0, inst.cols);
      }
    }
  }

  // OLED — singleton
  if (compDetected.oled) {
    const canvas = document.getElementById('sim-oled-canvas');
    if (canvas && compState.oled.pixels) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,128,64);
      ctx.fillStyle = compState.oled.on ? '#79c0ff' : '#1a2a3a';
      for (let y=0;y<64;y++) for (let x=0;x<128;x++)
        if (compState.oled.pixels[y]&&compState.oled.pixels[y][x]) ctx.fillRect(x,y,1,1);
    }
  }

  // Servo — all instances
  if (compDetected.servo) {
    for (const name of (compDetected.servoNames||['myServo'])) {
      const inst = compInst.servos[name];
      if (!inst) continue;
      const arm = document.getElementById(`sim-servo-arm-${name}`);
      const deg = document.getElementById(`sim-servo-deg-${name}`);
      const sl  = document.getElementById(`sim-servo-sl-${name}`);
      if (arm) {
        const rad = (inst.angle-90)*Math.PI/180;
        arm.setAttribute('x2', (30+22*Math.sin(rad)).toFixed(1));
        arm.setAttribute('y2', (30-22*Math.cos(rad)).toFixed(1));
      }
      if (deg) deg.textContent = inst.angle+'°';
      if (sl)  sl.value = inst.angle;
    }
  }

  // NeoPixel — all instances
  if (compDetected.neo) {
    for (const name of (compDetected.neoNames||['strip'])) {
      const inst = compInst.neos[name];
      if (!inst) continue;
      (inst.pixels||[]).forEach((px,i) => {
        const el = document.getElementById(`sim-neo-px-${name}-${i}`);
        if (el && px) {
          const bright = inst.brightness/255;
          el.style.background = `rgb(${Math.round(px.r*bright)},${Math.round(px.g*bright)},${Math.round(px.b*bright)})`;
          el.style.boxShadow  = (px.r||px.g||px.b) ? `0 0 4px rgb(${px.r},${px.g},${px.b})` : 'none';
        }
      });
    }
  }

  // DHT — all instances
  if (compDetected.dht) {
    for (const name of (compDetected.dhtNames||['dht'])) {
      const inst = compInst.dhts[name];
      if (!inst) continue;
      const t = document.getElementById(`sim-dht-temp-${name}`);
      const h = document.getElementById(`sim-dht-hum-${name}`);
      if (t) t.textContent = parseFloat(inst.temp).toFixed(1)+'°C';
      if (h) h.textContent = parseFloat(inst.humidity).toFixed(1)+'%';
    }
  }

  // TM1637 — singleton
  if (compDetected.tm) {
    const d = document.getElementById('sim-tm-disp');
    if (d) d.textContent = String(compState.tm.value).padStart(4,'0').slice(-4);
  }

  // Stepper — all instances
  if (compDetected.stepper) {
    for (const name of (compDetected.stepperNames||['stepper'])) {
      const inst = compInst.steppers[name];
      if (!inst) continue;
      const arm  = document.getElementById(`sim-stepper-arm-${name}`);
      const stEl = document.getElementById(`sim-stepper-steps-${name}`);
      const anEl = document.getElementById(`sim-stepper-angle-${name}`);
      if (arm) {
        const rad = inst.angle*Math.PI/180;
        arm.setAttribute('x2',(30+22*Math.sin(rad)).toFixed(1));
        arm.setAttribute('y2',(30-22*Math.cos(rad)).toFixed(1));
      }
      if (stEl) stEl.textContent = inst.steps;
      if (anEl) anEl.textContent = (inst.angle%360).toFixed(0)+'°';
    }
  }

  // Buzzer — all instances
  if (compDetected.buzzer) {
    for (const pin of (compDetected.buzzerPins||['buzzer'])) {
      const inst = compInst.buzzers[pin];
      if (!inst) continue;
      const icon  = document.getElementById(`sim-buzzer-icon-${pin}`);
      const freq  = document.getElementById(`sim-buzzer-freq-${pin}`);
      const state = document.getElementById(`sim-buzzer-state-${pin}`);
      if (icon)  { icon.textContent = inst.active?'🔊':'🔇'; icon.className='sim-buzzer'+(inst.active?' active':''); }
      if (freq)  freq.textContent  = inst.freq;
      if (state) state.textContent = inst.active?'Playing':'Silent';
    }
  }

  // Ultrasonic — all instances
  if (compDetected.ultra) {
    for (const name of (compDetected.ultraNames||['sonar'])) {
      const inst = compInst.ultras[name];
      if (!inst) continue;
      const d = document.getElementById(`sim-ultra-dist-${name}`);
      if (d) d.textContent = parseFloat(inst.distance).toFixed(1)+' cm';
    }
  }
  // RGB LED
  if (compDetected.rgbled) {
    const c  = document.getElementById('sim-rgb-circle');
    const r  = document.getElementById('sim-rgb-r');
    const g  = document.getElementById('sim-rgb-g');
    const b  = document.getElementById('sim-rgb-b');
    if (c) c.style.background = `rgb(${compState.rgbled.r},${compState.rgbled.g},${compState.rgbled.b})`;
    if (r) r.textContent = compState.rgbled.r;
    if (g) g.textContent = compState.rgbled.g;
    if (b) b.textContent = compState.rgbled.b;
  }
  // Buttons — sync visual state with simPins
  if (compDetected.button) {
    for (const pin of (compDetected.buttonPins||[])) {
      const pinNum = parseInt(pin);
      const pressed = simPins[pinNum] ? simPins[pinNum].value === 'LOW' : false;
      const el = document.getElementById(`sim-btn-${pin}`);
      if (el) {
        el.classList.toggle('pressed', pressed);
        el.textContent = pressed ? '●' : '○';
      }
    }
  }
}
const _origParseSimStmts = parseSimStmts;
parseSimStmts = function(lines, pinMap) {
  const stmts = _origParseSimStmts(lines, pinMap);
  // Only post-process lines at the TOP level (depth 0) of this call.
  // Lines inside if/for/while bodies are handled by recursive calls —
  // iterating them here would double-append ops outside their conditional context.
  let depth = 0;
  for (const line of lines) {
    const t = line.trim();
    // Track brace depth — skip anything inside a block
    for (const ch of t) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth > 0) continue;  // inside a nested block — handled by recursive call
    // Also skip lines that open a block (the { itself bumps depth above 0 next iter)
    // Lines like "if (...) {" or "for (...) {" are structural — already parsed
    if (t.endsWith('{') || t === '{' || t === '}') continue;

    // obj.print / obj.setCursor / obj.clear — LCD, capture object name
    const lcdPrint  = t.match(/^(\w+)\.print\("([^"]*)"\);$/);
    const lcdPrintV = t.match(/^(\w+)\.print\((\w+)\);$/);
    const lcdCursor = t.match(/^(\w+)\.setCursor\((\d+),\s*(\d+)\);$/);
    const lcdClearM = t.match(/^(\w+)\.clear\(\);$/);
    if (lcdPrint  && !t.includes('display')) stmts.push({ op:'lcd_print',  lcdName:lcdPrint[1],  text: lcdPrint[2] });
    if (lcdPrintV && !t.includes('display')) stmts.push({ op:'lcd_printv', lcdName:lcdPrintV[1], varName: lcdPrintV[2] });
    if (lcdCursor && !t.includes('display')) stmts.push({ op:'lcd_cursor', lcdName:lcdCursor[1], col: parseInt(lcdCursor[2]), row: parseInt(lcdCursor[3]) });
    if (lcdClearM && !t.includes('display')) stmts.push({ op:'lcd_clear',  lcdName:lcdClearM[1] });

    // display.* — OLED
    const oledPrint  = t.match(/^display\.print(?:ln)?\("([^"]*)"\);$/);
    const oledPrintV = t.match(/^display\.print(?:ln)?\((\w+)\);$/);
    const oledCursor = t.match(/^display\.setCursor\((\d+),\s*(\d+)\);$/);
    const oledClear  = t.match(/^display\.clearDisplay\(\);$/);
    const oledDisp   = t.match(/^display\.display\(\);$/);
    const oledSize   = t.match(/^display\.setTextSize\((\d+)\);$/);
    if (oledPrint)  stmts.push({ op:'oled_print',  text: oledPrint[1] });
    if (oledPrintV) stmts.push({ op:'oled_printv', varName: oledPrintV[1] });
    if (oledCursor) stmts.push({ op:'oled_cursor', x: parseInt(oledCursor[1]), y: parseInt(oledCursor[2]) });
    if (oledClear)  stmts.push({ op:'oled_clear' });
    if (oledDisp)   stmts.push({ op:'oled_display' });
    if (oledSize)   stmts.push({ op:'oled_size', size: parseInt(oledSize[1]) });

    // obj.write — servo
    const servoW = t.match(/^(\w+)\.write\((.+)\);$/);
    if (servoW && !t.includes('Serial') && !t.includes('display')) {
      stmts.push({ op:'servo_write', name: servoW[1], expr: servoW[2] });
    }

    // NeoPixel — capture strip name
    const neoSet  = t.match(/^(\w+)\.setPixelColor\((\d+),\s*\w+\.Color\((\d+),\s*(\d+),\s*(\d+)\)\);$/);
    const neoFill = t.match(/^(\w+)\.fill\(\w+\.Color\((\d+),\s*(\d+),\s*(\d+)\)\);$/);
    const neoBr   = t.match(/^(\w+)\.setBrightness\((\d+)\);$/);
    const neoShow = t.match(/^(\w+)\.show\(\);$/);
    if (neoSet)  stmts.push({ op:'neo_set',    neoName:neoSet[1],  idx:parseInt(neoSet[2]),  r:parseInt(neoSet[3]),  g:parseInt(neoSet[4]),  b:parseInt(neoSet[5]) });
    if (neoFill) stmts.push({ op:'neo_fill',   neoName:neoFill[1], r:parseInt(neoFill[2]),   g:parseInt(neoFill[3]), b:parseInt(neoFill[4]) });
    if (neoBr && !/tm|lcd/i.test(neoBr[1])) stmts.push({ op:'neo_bright', neoName:neoBr[1], val:parseInt(neoBr[2]) });
    if (neoShow && !/lcd/i.test(neoShow[1])) stmts.push({ op:'neo_show' });

    // DHT — capture sensor name (bare calls only; assigned forms handled by main parser)
    const dhtTm = t.match(/(?:(?:float|int|auto)\s+(\w+)\s*=\s*)?(\w+)\.readTemperature\(\);/);
    const dhtHm = t.match(/(?:(?:float|int|auto)\s+(\w+)\s*=\s*)?(\w+)\.readHumidity\(\);/);
    if (dhtTm && !dhtTm[1]) stmts.push({ op:'dht_read_temp', dhtName:dhtTm[2], varName:null });
    if (dhtHm && !dhtHm[1]) stmts.push({ op:'dht_read_hum',  dhtName:dhtHm[2], varName:null });

    // TM1637
    const tmShow = t.match(/^\w+\.showNumberDec\((.+)\);$/);
    const tmBr   = t.match(/^tm\w*\.setBrightness\((\d+)\);$/);
    if (tmShow) stmts.push({ op:'tm_show',   expr: tmShow[1] });
    if (tmBr)   stmts.push({ op:'tm_bright', val: parseInt(tmBr[1]) });

    // Stepper — capture object name
    const stepStepM  = t.match(/^(\w+)\.step\((.+)\);$/);
    const stepSpeedM = t.match(/^(\w+)\.setSpeed\((.+)\);$/);
    if (stepStepM)  stmts.push({ op:'step_step',  stepperName:stepStepM[1],  expr: stepStepM[2] });
    if (stepSpeedM) stmts.push({ op:'step_speed', stepperName:stepSpeedM[1], expr: stepSpeedM[2] });

    // Buzzer / tone — capture pin
    const toneM   = t.match(/^tone\((\w+),\s*(.+)\);$/);
    const noToneM = t.match(/^noTone\((\w+)\);$/);
    if (toneM)   stmts.push({ op:'buzzer_on',  buzzerPin:toneM[1],   expr: toneM[2] });
    if (noToneM) stmts.push({ op:'buzzer_off', buzzerPin:noToneM[1] });

    // Ultrasonic — pulseIn
    const pulseM = t.match(/^(?:long|float|auto)\s+(\w+)\s*=\s*pulseIn\(/);
    if (pulseM)  stmts.push({ op:'ultra_read', varName: pulseM[1] });
  }
  return stmts;
};

// ── Execute component statements ────────────────────────────
const _origExecSimStmt = execSimStmt;
execSimStmt = function(stmt) {
  switch(stmt.op) {

    // LCD
    // LCD — use first detected LCD or stmt.lcdName
    case 'lcd_print': {
      const lcdName = stmt.lcdName || (compDetected.lcdNames && compDetected.lcdNames[0]) || 'lcd';
      const inst = getInst(compInst.lcds, lcdName, {rows:[],cols:16,rows_n:2,cursor:[0,0]});
      const [col, row] = inst.cursor;
      let r = inst.rows[row] || ' '.repeat(inst.cols);
      r = r.split('');
      for (let i = 0; i < stmt.text.length && col+i < inst.cols; i++) r[col+i] = stmt.text[i];
      inst.rows[row] = r.join('');
      inst.cursor[0] = Math.min(col + stmt.text.length, inst.cols);
      return;
    }
    case 'lcd_printv': {
      const val = String(simVars[stmt.varName] !== undefined ? simVars[stmt.varName] : stmt.varName);
      execSimStmt({ op:'lcd_print', text: val, lcdName: stmt.lcdName });
      return;
    }
    case 'lcd_cursor': {
      const lcdName = stmt.lcdName || (compDetected.lcdNames && compDetected.lcdNames[0]) || 'lcd';
      const inst = getInst(compInst.lcds, lcdName, {rows:[],cols:16,rows_n:2,cursor:[0,0]});
      inst.cursor = [stmt.col, stmt.row];
      return;
    }
    case 'lcd_clear': {
      const lcdName = stmt.lcdName || (compDetected.lcdNames && compDetected.lcdNames[0]) || 'lcd';
      const inst = getInst(compInst.lcds, lcdName, {rows:[],cols:16,rows_n:2,cursor:[0,0]});
      inst.rows = Array(inst.rows_n).fill(' '.repeat(inst.cols));
      inst.cursor = [0, 0];
      return;
    }

    // OLED — singleton
    case 'oled_clear':
      if (!compState.oled.pixels) compState.oled.pixels = Array(64).fill(null).map(()=>Array(128).fill(0));
      compState.oled.pixels = Array(64).fill(null).map(()=>Array(128).fill(0));
      return;
    case 'oled_cursor':
      compState.oled.cursor = [stmt.x, stmt.y];
      return;
    case 'oled_size':
      compState.oled.textSize = stmt.size;
      return;
    case 'oled_print': {
      if (!compState.oled.pixels) compState.oled.pixels = Array(64).fill(null).map(()=>Array(128).fill(0));
      drawOLEDText(stmt.text, compState.oled.cursor[0], compState.oled.cursor[1], compState.oled.textSize);
      compState.oled.cursor[0] += stmt.text.length * 6 * compState.oled.textSize;
      return;
    }
    case 'oled_printv': {
      const val = String(simVars[stmt.varName] !== undefined ? simVars[stmt.varName] : '?');
      execSimStmt({ op:'oled_print', text: val });
      return;
    }
    case 'oled_display':
      compState.oled.on = true;
      updateCompWidgets();
      return;

    // Servo — use stmt.name to target correct instance
    case 'servo_write': {
      const angle = Math.max(0, Math.min(180, parseInt(simEval(stmt.expr)) || 0));
      const sName = stmt.name || (compDetected.servoNames && compDetected.servoNames[0]) || 'myServo';
      getInst(compInst.servos, sName, {angle:90}).angle = angle;
      return;
    }

    // NeoPixel — use stmt.neoName or first strip
    case 'neo_set': {
      const nName = stmt.neoName || (compDetected.neoNames && compDetected.neoNames[0]) || 'strip';
      const inst = getInst(compInst.neos, nName, {pixels:[],count:8,brightness:50});
      if (inst.pixels[stmt.idx]) inst.pixels[stmt.idx] = { r:stmt.r, g:stmt.g, b:stmt.b };
      return;
    }
    case 'neo_fill': {
      const nName = stmt.neoName || (compDetected.neoNames && compDetected.neoNames[0]) || 'strip';
      const inst = getInst(compInst.neos, nName, {pixels:[],count:8,brightness:50});
      inst.pixels = inst.pixels.map(() => ({ r:stmt.r, g:stmt.g, b:stmt.b }));
      return;
    }
    case 'neo_bright': {
      const nName = stmt.neoName || (compDetected.neoNames && compDetected.neoNames[0]) || 'strip';
      getInst(compInst.neos, nName, {pixels:[],count:8,brightness:50}).brightness = stmt.val;
      return;
    }
    case 'neo_show':
      updateCompWidgets();
      return;

    // DHT — use stmt.dhtName or first sensor; read from slider
    case 'dht_read_temp': {
      const dName = stmt.dhtName || (compDetected.dhtNames && compDetected.dhtNames[0]) || 'dht';
      const inst  = getInst(compInst.dhts, dName, {temp:25.0, humidity:60.0});
      const el    = document.getElementById(`sim-dht-temp-sl-${dName}`);
      const val   = el ? parseFloat(el.value) : inst.temp;
      inst.temp   = val;
      if (stmt.varName) simVars[stmt.varName] = val;
      updateCompWidgets();
      return;
    }
    case 'dht_read_hum': {
      const dName = stmt.dhtName || (compDetected.dhtNames && compDetected.dhtNames[0]) || 'dht';
      const inst  = getInst(compInst.dhts, dName, {temp:25.0, humidity:60.0});
      const el    = document.getElementById(`sim-dht-hum-sl-${dName}`);
      const val   = el ? parseFloat(el.value) : inst.humidity;
      inst.humidity = val;
      if (stmt.varName) simVars[stmt.varName] = val;
      updateCompWidgets();
      return;
    }

    // TM1637 — singleton
    case 'tm_show': {
      const val = parseInt(simEval(stmt.expr)) || 0;
      compState.tm.value = val;
      return;
    }
    case 'tm_bright':
      compState.tm.brightness = stmt.val;
      return;

    // Stepper — use stmt.stepperName or first
    case 'step_step': {
      const sName = stmt.stepperName || (compDetected.stepperNames && compDetected.stepperNames[0]) || 'stepper';
      const inst  = getInst(compInst.steppers, sName, {steps:0, angle:0});
      const steps = parseInt(simEval(stmt.expr)) || 0;
      inst.steps += steps;
      inst.angle  = (inst.steps / 2038) * 360;
      return;
    }
    case 'step_speed':
      return;

    // Buzzer — use stmt.buzzerPin or first pin
    case 'buzzer_on': {
      const pin  = stmt.buzzerPin || (compDetected.buzzerPins && compDetected.buzzerPins[0]) || 'buzzer';
      const inst = getInst(compInst.buzzers, pin, {active:false, freq:0});
      const freq = parseInt(simEval(stmt.expr)) || 440;
      inst.active = true;
      inst.freq   = freq;
      simPlayTone(freq);
      return;
    }
    case 'buzzer_off': {
      const pin  = stmt.buzzerPin || (compDetected.buzzerPins && compDetected.buzzerPins[0]) || 'buzzer';
      const inst = getInst(compInst.buzzers, pin, {active:false, freq:0});
      inst.active = false;
      inst.freq   = 0;
      simStopTone();
      return;
    }

    // Wire — singleton
    case 'wire_begin':
      compState.wire.addr   = stmt.addr;
      compState.wire.buffer = [];
      simWireLog(`→ beginTransmission(${stmt.addr})`);
      return;
    case 'wire_write':
      compState.wire.buffer.push(simEval(stmt.val));
      simWireLog(`  write(${simEval(stmt.val)})`);
      return;
    case 'wire_end':
      simWireLog(`← endTransmission [${compState.wire.buffer.join(',')}]`);
      compState.wire.buffer = [];
      return;
    case 'wire_req':
      simWireLog(`← requestFrom(${stmt.addr}, ${stmt.bytes})`);
      return;

    // Ultrasonic — use stmt.ultraName or first
    case 'ultra_read': {
      const uName = stmt.ultraName || (compDetected.ultraNames && compDetected.ultraNames[0]) || 'sonar';
      const inst  = getInst(compInst.ultras, uName, {distance:0});
      simVars[stmt.varName] = inst.distance / 0.0343 * 2;
      return;
    }

    default:
      _origExecSimStmt(stmt);
  }
};

// ── Simple OLED pixel font renderer ─────────────────────────
const OLED_FONT = {
  ' ':[0,0,0,0,0],
  '0':[0x3E,0x51,0x49,0x45,0x3E],'1':[0,0x42,0x7F,0x40,0],'2':[0x42,0x61,0x51,0x49,0x46],
  '3':[0x21,0x41,0x45,0x4B,0x31],'4':[0x18,0x14,0x12,0x7F,0x10],'5':[0x27,0x45,0x45,0x45,0x39],
  '6':[0x3C,0x4A,0x49,0x49,0x30],'7':[0x01,0x71,0x09,0x05,0x03],'8':[0x36,0x49,0x49,0x49,0x36],
  '9':[0x06,0x49,0x49,0x29,0x1E],
  'A':[0x7E,0x11,0x11,0x11,0x7E],'B':[0x7F,0x49,0x49,0x49,0x36],'C':[0x3E,0x41,0x41,0x41,0x22],
  'D':[0x7F,0x41,0x41,0x22,0x1C],'E':[0x7F,0x49,0x49,0x49,0x41],'F':[0x7F,0x09,0x09,0x09,0x01],
  'G':[0x3E,0x41,0x49,0x49,0x7A],'H':[0x7F,0x08,0x08,0x08,0x7F],'I':[0,0x41,0x7F,0x41,0],
  'J':[0x20,0x40,0x41,0x3F,0x01],'K':[0x7F,0x08,0x14,0x22,0x41],'L':[0x7F,0x40,0x40,0x40,0x40],
  'M':[0x7F,0x02,0x0C,0x02,0x7F],'N':[0x7F,0x04,0x08,0x10,0x7F],'O':[0x3E,0x41,0x41,0x41,0x3E],
  'P':[0x7F,0x09,0x09,0x09,0x06],'Q':[0x3E,0x41,0x51,0x21,0x5E],'R':[0x7F,0x09,0x19,0x29,0x46],
  'S':[0x46,0x49,0x49,0x49,0x31],'T':[0x01,0x01,0x7F,0x01,0x01],'U':[0x3F,0x40,0x40,0x40,0x3F],
  'V':[0x1F,0x20,0x40,0x20,0x1F],'W':[0x3F,0x40,0x38,0x40,0x3F],'X':[0x63,0x14,0x08,0x14,0x63],
  'Y':[0x07,0x08,0x70,0x08,0x07],'Z':[0x61,0x51,0x49,0x45,0x43],
  'a':[0x20,0x54,0x54,0x54,0x78],'b':[0x7F,0x48,0x44,0x44,0x38],'c':[0x38,0x44,0x44,0x44,0x20],
  'd':[0x38,0x44,0x44,0x48,0x7F],'e':[0x38,0x54,0x54,0x54,0x18],'f':[0x08,0x7E,0x09,0x01,0x02],
  'g':[0x0C,0x52,0x52,0x52,0x3E],'h':[0x7F,0x08,0x04,0x04,0x78],'i':[0,0x44,0x7D,0x40,0],
  'j':[0x20,0x40,0x44,0x3D,0],'k':[0x7F,0x10,0x28,0x44,0],'l':[0,0x41,0x7F,0x40,0],
  'm':[0x7C,0x04,0x18,0x04,0x78],'n':[0x7C,0x08,0x04,0x04,0x78],'o':[0x38,0x44,0x44,0x44,0x38],
  'p':[0x7C,0x14,0x14,0x14,0x08],'q':[0x08,0x14,0x14,0x18,0x7C],'r':[0x7C,0x08,0x04,0x04,0x08],
  's':[0x48,0x54,0x54,0x54,0x20],'t':[0x04,0x3F,0x44,0x40,0x20],'u':[0x3C,0x40,0x40,0x20,0x7C],
  'v':[0x1C,0x20,0x40,0x20,0x1C],'w':[0x3C,0x40,0x30,0x40,0x3C],'x':[0x44,0x28,0x10,0x28,0x44],
  'y':[0x0C,0x50,0x50,0x50,0x3C],'z':[0x44,0x64,0x54,0x4C,0x44],
  '!':[0,0,0x7D,0,0],':':[0,0x36,0x36,0],'-':[0x08,0x08,0x08,0x08,0x08],'.':[0,0x60,0x60,0],
  '/':[0x20,0x10,0x08,0x04,0x02],'+':[0x08,0x08,0x3E,0x08,0x08],'%':[0x23,0x13,0x08,0x64,0x62],
};

function drawOLEDText(text, x, y, size) {
  if (!compState.oled.pixels) compState.oled.pixels = Array(64).fill(null).map(()=>Array(128).fill(0));
  size = size || 1;
  for (let ci = 0; ci < text.length; ci++) {
    const ch   = text[ci];
    const bits = OLED_FONT[ch] || OLED_FONT[' '];
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 8; row++) {
        if (bits[col] & (1 << row)) {
          for (let sx = 0; sx < size; sx++) {
            for (let sy = 0; sy < size; sy++) {
              const px = x + ci * 6 * size + col * size + sx;
              const py = y + row * size + sy;
              if (px >= 0 && px < 128 && py >= 0 && py < 64) {
                compState.oled.pixels[py][px] = 1;
              }
            }
          }
        }
      }
    }
  }
}

// ── Web Audio API for buzzer ─────────────────────────────────
let audioCtx = null;
let audioOsc = null;
function simPlayTone(freq) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioOsc) { audioOsc.stop(); audioOsc = null; }
    audioOsc = audioCtx.createOscillator();
    audioOsc.connect(audioCtx.destination);
    audioOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    audioOsc.start();
  } catch(e) {}
}
function simWireLog(msg) {
  compState.wire.log.push(msg);
  if (compState.wire.log.length > 20) compState.wire.log.shift();
  const el = document.getElementById('sim-wire-log');
  if (el) { el.innerHTML = compState.wire.log.map(l => `<div>${l}</div>`).join(''); el.scrollTop = el.scrollHeight; }
}

function simStopTone() {
  try { if (audioOsc) { audioOsc.stop(); audioOsc = null; } } catch(e) {}
}

// ── Button press/release ──────────────────────────────────
function simButtonPress(pin, pressed) {
  const inst = getInst(compInst.buttons, pin, { pressed: false, label: `Pin ${pin}` });
  inst.pressed = pressed;
  // INPUT_PULLUP: unpressed = HIGH, pressed = LOW
  const pinNum = parseInt(pin);
  if (simPins[pinNum]) simPins[pinNum].value = pressed ? 'LOW' : 'HIGH';
  // Update button appearance immediately
  const el = document.getElementById(`sim-btn-${pin}`);
  if (el) {
    el.classList.toggle('pressed', pressed);
    el.textContent = pressed ? '●' : '○';
  }
  // Trigger an immediate sim step so the MCU reads the new pin state right away
  if (simRunning) {
    simStep();
  }
  updateSimUI();
}

// ── UI controls for component simulators ─────────────────────
function simServoSet(name, val) {
  getInst(compInst.servos, name, { angle: 90 }).angle = parseInt(val);
  updateCompWidgets();
}
function simDHTSet(name, type, val) {
  const inst = getInst(compInst.dhts, name, { temp:25.0, humidity:60.0 });
  if (type === 'temp') {
    inst.temp = parseFloat(val);
    const el = document.getElementById(`sim-dht-temp-${name}`);
    if (el) el.textContent = inst.temp.toFixed(1) + '°C';
  } else {
    inst.humidity = parseFloat(val);
    const el = document.getElementById(`sim-dht-hum-${name}`);
    if (el) el.textContent = inst.humidity.toFixed(1) + '%';
  }
  updateCompWidgets();
}
function simUltraSet(name, val) {
  const inst = getInst(compInst.ultras, name, { distance: 0 });
  inst.distance = parseFloat(val);
  const el = document.getElementById(`sim-ultra-dist-${name}`);
  if (el) el.textContent = inst.distance.toFixed(1) + ' cm';
}

// ── Hook into buildSimProgram ─────────────────────────────────
const _origBuildSimProgram = buildSimProgram;
buildSimProgram = function(cpp) {
  // Reset singleton state
  compState.oled.pixels = Array(64).fill(null).map(()=>Array(128).fill(0));
  compState.oled.cursor = [0,0];
  compState.oled.on     = false;
  compState.tm.value    = 0;
  compState.wire        = { log:[], addr:0, buffer:[] };
  compState.rgbled      = { r:0, g:0, b:0 };

  // Reset all multi-instance maps — detectComponents will re-populate
  compInst.servos   = {};
  compInst.lcds     = {};
  compInst.dhts     = {};
  compInst.neos     = {};
  compInst.steppers = {};
  compInst.buzzers  = {};
  compInst.ultras   = {};
  compInst.buttons  = {};

  detectComponents(cpp);
  _origBuildSimProgram(cpp);
  renderCompWidgets();
};

// ── Hook updateSimUI to also update comp widgets ─────────────
const _origUpdateSimUI = updateSimUI;
updateSimUI = function() {
  _origUpdateSimUI();
  updateCompWidgets();
};


// ── Simulator sub-tab switching ────────────────────────────
function showSimTab(name) {
  document.getElementById('sim-tab-sim').style.display  = name === 'sim'  ? 'block' : 'none';
  document.getElementById('sim-tab-comp').style.display = name === 'comp' ? 'block' : 'none';
  document.getElementById('sim-tab-btn-sim').classList.toggle('active',  name === 'sim');
  document.getElementById('sim-tab-btn-comp').classList.toggle('active', name === 'comp');
}

// ── Component Panel Toggle (noop — kept for compat) ────────
function toggleCompPanel() {}

// Update running state label in comp panel header
const _origSimToggle = simToggle;
simToggle = function() {
  _origSimToggle();
  const el = document.getElementById('comp-panel-running');
  if (el) el.textContent = simRunning ? '● running' : '● stopped';
  if (el) el.style.color = simRunning ? '#4ec9b0' : '#444';
};

