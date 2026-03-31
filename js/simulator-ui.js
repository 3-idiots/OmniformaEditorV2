function updateSimUI() {
  // update pin table values
  for (let i = 0; i < currentBoard.digital; i++) {
    const p = simPins[i];
    if (!p) continue;
    const row = document.getElementById(`pin-row-${i}`);
    if (!row) continue;
    const badge = row.querySelector(".pin-mode-badge");
    const bar = row.querySelector(".pin-bar");
    const tog = row.querySelector(".pin-toggle");
    const val = row.querySelector(".pin-val");

    if (p.mode === "OUTPUT") {
      badge.textContent = "OUTPUT"; badge.className = "pin-mode-badge pin-mode-out";
      const isHigh = p.value === "HIGH";
      tog.textContent = isHigh ? "HIGH" : "LOW";
      tog.className = "pin-toggle " + (isHigh ? "high" : "low");
      bar.style.width = isHigh ? "100%" : "0%";
      bar.className = "pin-bar " + (isHigh ? "high" : "low");
      val.textContent = isHigh ? "5V" : "0V";
    } else if (p.mode === "PWM") {
      badge.textContent = "PWM"; badge.className = "pin-mode-badge pin-mode-pwm";
      const pct = Math.round((p.pwm / 255) * 100);
      tog.textContent = p.pwm; tog.className = "pin-toggle high";
      bar.style.width = pct + "%"; bar.className = "pin-bar pwm";
      val.textContent = ((p.pwm / 255) * 5).toFixed(1) + "V";
    } else if (p.mode === "INPUT") {
      badge.textContent = "INPUT"; badge.className = "pin-mode-badge pin-mode-in";
    } else {
      badge.textContent = "OFF"; badge.className = "pin-mode-badge pin-mode-off";
    }

    // update board SVG pin colour
    const bpin = document.getElementById(`bpin-${i}`);
    if (bpin) {
      bpin.setAttribute("fill", p.value === "HIGH" || p.pwm > 128 ? "#3fb950" : "#30363d");
    }
  }

  // sim clock
  const ms = simTick * parseInt(document.getElementById("speed-select").value);
  document.getElementById("sim-clock").textContent =
    `Tick: ${simTick}  |  ~${(ms/1000).toFixed(2)}s elapsed  |  Stmt: ${simStmtIdx}/${simLoopStmts.length}`;
}

// ── toggle an INPUT pin manually ──────────────────────────
function toggleInputPin(pinNum) {
  if (!simPins[pinNum]) return;
  if (simPins[pinNum].mode === "INPUT") {
    simPins[pinNum].value = simPins[pinNum].value === "HIGH" ? "LOW" : "HIGH";
    updateSimUI();
  }
}

// ── run / stop ────────────────────────────────────────────
function simToggle() {
  if (simRunning) {
    simRunning = false;
    clearInterval(simTimer);
    document.getElementById("btn-sim-run").textContent = "▶ Run";
    document.getElementById("btn-sim-run").classList.remove("running");
    setStatus("Simulator paused");
  } else {
    // Auto-compile if no program loaded yet
    if (!simLoopStmts.length && !simSetupStmts.length) {
      compile();
      setTimeout(() => { if (simLoopStmts.length || simSetupStmts.length) simToggle(); }, 300);
      return;
    }
    simRunning = true;

    // ── Queue setup() stmts first, then loop will start after _setup_done sentinel ──
    if (!simSetupDone) {
      serialAppend(`[Simulator started — ${currentBoardKey.toUpperCase()} @ ${serialBaud} baud]`, "sys");
      renderPinTable();
      renderBoardSVG(currentBoardKey);
      runSimSetup();   // pushes setup stmts + sentinel into queue
    }

    // Always start the timer — it will drain setup queue first, then loop
    simTimer = setInterval(simStep, simSpeed);

    document.getElementById("btn-sim-run").textContent = "⏸ Pause";
    document.getElementById("btn-sim-run").classList.add("running");
    setStatus("Simulator running…");
  }
}

function simReset() {
  simRunning = false;
  clearInterval(simTimer);
  // stop wave generator if active
  if (analogWaveActive) {
    clearInterval(analogWaveTimer); analogWaveTimer = null;
    const waveChk = document.getElementById('analog-wave-en');
    if (waveChk) waveChk.checked = false;
    analogWaveActive = false;
  }
  simTick = 0; simStmtIdx = 0;
  simSetupDone = false;   // allow setup() to run again on next Run
  serialTxQueue = [];     // discard any pending input bytes
  document.getElementById("btn-sim-run").textContent = "▶ Run";
  document.getElementById("btn-sim-run").classList.remove("running");
  initSimPins();
  // re-apply pin modes AND pullup HIGH values from program
  if (simSetupStmts.length || simLoopStmts.length) {
    const cpp = (() => {
      const el = document.getElementById("out-cpp");
      if (!el) return "";
      const tmp = document.createElement("div"); tmp.innerHTML = el.innerHTML;
      return tmp.textContent;
    })();
    if (cpp) {
      applyInputPullupDefaults(cpp);
      // Also set OUTPUT modes
      const pinMap = {};
      for (const m of cpp.matchAll(/#define\s+(\w+)\s+(\d+)/g)) pinMap[m[1]] = parseInt(m[2]);
      for (const m of cpp.matchAll(/\bconst\s+(?:int|byte|uint8_t|pin_t)\s+(\w+)\s*=\s*(\d+);/g)) pinMap[m[1]] = parseInt(m[2]);
      for (const m of cpp.matchAll(/pinMode\((\w+),\s*OUTPUT\)/g)) {
        const num = pinMap[m[1]] !== undefined ? pinMap[m[1]] : parseInt(m[1]);
        if (!isNaN(num) && simPins[num]) simPins[num].mode = "OUTPUT";
      }
    }
  }
  simVars = {};
  // Restore global initial values so next Run starts with correct initial state
  for (const [k, v] of Object.entries(simGlobalInits)) {
    simVars[k] = v;
  }
  updateSimUI();
  renderBoardSVG(currentBoardKey);
  document.getElementById("sim-clock").textContent = "Stopped — click Run to simulate";
  serialAppend(`[Simulator reset]`, 'sys');
  setStatus("Simulator reset");
}

function simSetSpeed(v) { simSpeed = parseInt(v); simTickMs = simSpeed; if (simRunning) { clearInterval(simTimer); simTimer = setInterval(simStep, simSpeed); } }

// ── pin table renderer ────────────────────────────────────
function renderPinTable() {
  const numD = Math.min(currentBoard.digital, 20);
  let html = "";
  for (let i = 0; i < numD; i++) {
    const isPWM = currentBoard.pwmPins.includes(i);
    const p = simPins[i] || { mode:"OFF", value:"LOW", pwm:0 };

    // derive display values from actual sim state
    let modeClass = "pin-mode-off", modeLabel = "OFF";
    let toggleClass = "low", toggleLabel = "LOW";
    let barClass = "low", barWidth = "0%";
    let voltLabel = "0V";

    if (p.mode === "OUTPUT") {
      modeClass = "pin-mode-out"; modeLabel = "OUT";
      const hi = p.value === "HIGH";
      toggleClass = hi ? "high" : "low";
      toggleLabel = hi ? "HIGH" : "LOW";
      barClass = hi ? "high" : "low";
      barWidth = hi ? "100%" : "0%";
      voltLabel = hi ? "5V" : "0V";
    } else if (p.mode === "PWM") {
      modeClass = "pin-mode-pwm"; modeLabel = "PWM";
      const pct = Math.round((p.pwm / 255) * 100);
      toggleClass = "high"; toggleLabel = String(p.pwm);
      barClass = "pwm"; barWidth = pct + "%";
      voltLabel = ((p.pwm / 255) * 5).toFixed(1) + "V";
    } else if (p.mode === "INPUT") {
      modeClass = "pin-mode-in"; modeLabel = "IN";
      toggleClass = "input-mode"; toggleLabel = "---";
    }

    html += `<div class="pin-row" id="pin-row-${i}">
      <span class="pin-num">${i}</span>
      <span class="pin-name">D${i}${isPWM ? "~" : ""}</span>
      <span class="pin-mode-badge ${modeClass}">${modeLabel}</span>
      <button class="pin-toggle ${toggleClass}" onclick="toggleInputPin(${i})">${toggleLabel}</button>
      <div class="pin-bar-wrap"><div class="pin-bar ${barClass}" style="width:${barWidth}"></div></div>
      <span class="pin-val">${voltLabel}</span>
    </div>`;
  }
  document.getElementById("pin-table").innerHTML = html;
}

function renderAnalogTable() {
  const numA = Math.min(currentBoard.analog, 8);
  // Named channel labels per board type
  const chanNames = {
    uno:   ["LDR/A0","POT/A1","TEMP/A2","MIC/A3","SDA/A4","SCL/A5"],
    nano:  ["LDR/A0","POT/A1","TEMP/A2","MIC/A3","SDA/A4","SCL/A5","A6","A7"],
    mega:  ["A0","A1","A2","A3","A4","A5","A6","A7"],
    esp32: ["ADC0","ADC3","ADC4","ADC5","ADC6","ADC7"],
    rp2040:["GP26","GP27","GP28","GP29","—","—","—","—"],
    leonado:["A0","A1","A2","A3","A4","A5"],
  };
  const names = chanNames[currentBoardKey] || [];
  const vref = (currentBoardKey === "esp32") ? 3.3 : 5.0;
  let html = `<div style="font-size:9px;color:#555;margin-bottom:4px;font-family:monospace;">Vref: ${vref}V | 10-bit (0–1023)</div>`;
  for (let i = 0; i < numA; i++) {
    const cv = simAnalog[i] || 0;
    const volt = ((cv / 1023) * vref).toFixed(2);
    const lbl = names[i] || `A${i}`;
    html += `<div class="analog-row">
      <span class="analog-label">A${i}</span>
      <span class="analog-name" title="${lbl}">${lbl}</span>
      <input type="range" class="analog-slider" min="0" max="1023" value="${cv}"
        oninput="analogSet(${i},parseInt(this.value))"/>
      <span class="analog-num" id="av-${i}">${cv}</span>
      <span class="analog-volt" id="avv-${i}">${volt}V</span>
    </div>`;
  }
  document.getElementById("analog-table").innerHTML = html;
}

function analogSet(ch, val) {
  simAnalog[ch] = val;
  const vref = (currentBoardKey === "esp32") ? 3.3 : 5.0;
  const volt = ((val / 1023) * vref).toFixed(2);
  const numEl = document.getElementById(`av-${ch}`);
  const voltEl = document.getElementById(`avv-${ch}`);
  if (numEl) numEl.textContent = val;
  if (voltEl) voltEl.textContent = volt + "V";
}

// ── analog waveform generator ─────────────────────────────
function analogWaveToggle(on) {
  analogWaveActive = on;
  if (on) {
    analogWaveTimer = setInterval(() => {
      const numA = Math.min(currentBoard.analog, 8);
      analogWavePhase += 0.08;
      for (let i = 0; i < numA; i++) {
        const phase = analogWavePhase + i * 0.7;
        let v = 512;
        if (analogWaveType === "sine")     v = Math.round(512 + 511 * Math.sin(phase));
        else if (analogWaveType === "triangle") {
          const t = (phase % (2 * Math.PI)) / (2 * Math.PI);
          v = Math.round(t < 0.5 ? t * 2 * 1023 : (1 - t) * 2 * 1023);
        } else if (analogWaveType === "square") v = Math.sin(phase) > 0 ? 1023 : 0;
        else if (analogWaveType === "sawtooth") v = Math.round(((analogWavePhase % (2*Math.PI)) / (2*Math.PI)) * 1023);
        else if (analogWaveType === "noise") v = Math.round(Math.random() * 1023);
        simAnalog[i] = v;
        // update slider UI
        const slider = document.querySelector(`#analog-table .analog-slider:nth-of-type(${i+1})`);
        const rows = document.querySelectorAll('#analog-table .analog-row');
        if (rows[i]) {
          const sl = rows[i].querySelector('.analog-slider');
          if (sl) sl.value = v;
        }
        analogSet(i, v);
      }
    }, 80);
  } else {
    clearInterval(analogWaveTimer);
    analogWaveTimer = null;
  }
}

function analogWaveSetType(t) { analogWaveType = t; }

// ── serial monitor ────────────────────────────────────────

function serialTimestamp() {
  if (!serialShowTimestamp) return '';
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}.${String(now.getMilliseconds()).padStart(3,'0')}`;
  return `<span class="serial-ts">[${ts}]</span>`;
}

