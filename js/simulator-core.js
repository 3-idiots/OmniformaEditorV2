let simPins  = {};   // { 0: {mode:'OUTPUT',value:'LOW',pwm:0}, ... }
let simAnalog = {};  // { 0: 512, 1: 0, ... }
let simVars  = {};   // { varName: value }
let simPinMap = {};  // { "LED_PIN": 13, "BUTTON_PIN": 2, ... } — named pin constants
let simRunning = false;
let simTimer = null;
let simSpeed = 1000;  // ms per loop tick
let simTickMs = 1000; // kept in sync with simSpeed
let simTick  = 0;
let simLoopStmts = [];
let simSetupDone = false;
let simGlobalInits = {};  // global variable initial values, applied at sim start
let serialLog = [];

// analog wave generator state
let analogWaveActive = false, analogWaveTimer = null, analogWavePhase = 0;
let analogWaveType = "sine";

// serial monitor state
let serialRxCount = 0, serialTxCount = 0;
let serialShowTimestamp = false;
let serialBaud = 9600;
let serialBuffer = [];

function initSimPins() {
  simPins = {};
  for (let i = 0; i < currentBoard.digital; i++) {
    simPins[i] = { mode: "OFF", value: "LOW", pwm: 0 };
  }
  simAnalog = {};
  for (let i = 0; i < currentBoard.analog; i++) {
    simAnalog[i] = 0;
  }
  simVars = {};
}

// Apply INPUT_PULLUP HIGH defaults from the compiled C++ — called after initSimPins
function applyInputPullupDefaults(cpp) {
  if (!cpp) return;
  const pinMap = {};
  for (const m of cpp.matchAll(/#define\s+(\w+)\s+(\d+)/g)) pinMap[m[1]] = parseInt(m[2]);
  for (const m of cpp.matchAll(/\bconst\s+(?:int|byte|uint8_t|pin_t)\s+(\w+)\s*=\s*(\d+);/g)) pinMap[m[1]] = parseInt(m[2]);
  for (const m of cpp.matchAll(/pinMode\s*\(\s*(\w+)\s*,\s*INPUT(?:_PULLUP)?\s*\)/g)) {
    const num = pinMap[m[1]] !== undefined ? pinMap[m[1]] : parseInt(m[1]);
    if (!isNaN(num) && simPins[num]) {
      simPins[num].mode  = "INPUT";
      simPins[num].value = "HIGH";  // pull-up: unpressed = HIGH
    }
  }
}

// ── build the simulation program from compiled C++ ────────
let simSetupStmts = [];  // statements from void setup()

function parseSimStmts(lines, pinMap) {
  const stmts = [];
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    i++;
    if (!t || t.startsWith("//")) continue;

    // ── if (cond) { ... } [else { ... }] ──
    const ifM = t.match(/^if\s*\((.+)\)\s*\{?$/);
    if (ifM) {
      const cond = ifM[1].trim();
      // collect then-body lines until matching }
      const thenLines = [], elseLines = [];
      let depth = t.endsWith("{") ? 1 : 0;
      if (depth === 0 && i < lines.length && lines[i].trim() === "{") { depth = 1; i++; }
      while (i < lines.length && depth > 0) {
        const ln = lines[i]; i++;
        const lt = ln.trim();
        if (lt === "{") { depth++; continue; }
        if (lt === "}") { depth--; if (depth === 0) break; }
        if (depth > 0) thenLines.push(lt);
      }
      // peek for else
      let elseIdx = i;
      if (elseIdx < lines.length && lines[elseIdx].trim().startsWith("} else") || (elseIdx < lines.length && lines[elseIdx].trim() === "else {")) {
        i = elseIdx + 1; depth = 1;
        while (i < lines.length && depth > 0) {
          const ln = lines[i]; i++;
          const lt = ln.trim();
          if (lt === "{") { depth++; continue; }
          if (lt === "}") { depth--; if (depth === 0) break; }
          if (depth > 0) elseLines.push(lt);
        }
      }
      stmts.push({
        op:   "if",
        cond:  cond,
        then:  parseSimStmts(thenLines, pinMap),
        else:  parseSimStmts(elseLines, pinMap),
      });
      continue;
    }

    // ── while (cond) { ... } ──
    const whileM = t.match(/^while\s*\((.+)\)\s*\{?$/);
    if (whileM) {
      const cond = whileM[1].trim();
      const bodyLines = [];
      let depth = t.endsWith("{") ? 1 : 0;
      if (depth === 0 && i < lines.length && lines[i].trim() === "{") { depth = 1; i++; }
      while (i < lines.length && depth > 0) {
        const ln = lines[i]; i++;
        const lt = ln.trim();
        if (lt === "{") { depth++; continue; }
        if (lt === "}") { depth--; if (depth === 0) break; }
        if (depth > 0) bodyLines.push(lt);
      }
      stmts.push({ op:"while", cond, body: parseSimStmts(bodyLines, pinMap) });
      continue;
    }

    // ── for (init; cond; incr) { ... } ──
    // Matches: for (int i = 0; i < N; i++) {
    //          for (int i = 0; i < N; i += M) {
    const forM = t.match(/^for\s*\(\s*(?:int\s+)?(\w+)\s*=\s*([^;]+);\s*([^;]+);\s*(.+?)\s*\)\s*\{?$/);
    if (forM) {
      const [, varName, initExpr, condExpr, incrExpr] = forM;
      const bodyLines = [];
      let depth = t.endsWith("{") ? 1 : 0;
      if (depth === 0 && i < lines.length && lines[i].trim() === "{") { depth = 1; i++; }
      while (i < lines.length && depth > 0) {
        const ln = lines[i]; i++;
        const lt = ln.trim();
        if (lt === "{") { depth++; continue; }
        if (lt === "}") { depth--; if (depth === 0) break; }
        if (depth > 0) bodyLines.push(lt);
      }
      stmts.push({
        op: "for",
        var: varName,
        init: initExpr.trim(),
        cond: condExpr.trim(),
        incr: incrExpr.trim(),
        body: parseSimStmts(bodyLines, pinMap),
      });
      continue;
    }

    // ── skip lone braces ──
    if (t === "{" || t === "}") continue;

    // ── digitalWrite(PIN, HIGH/LOW) ──
    const dw = t.match(/^digitalWrite\((\w+),\s*(HIGH|LOW)\);$/);
    if (dw) {
      const pin = pinMap[dw[1]] !== undefined ? pinMap[dw[1]] : parseInt(dw[1]);
      if (!isNaN(pin)) { stmts.push({op:"dw", pin, val:dw[2]}); continue; }
    }

    // ── analogWrite(PIN, val) ──
    const aw = t.match(/^analogWrite\((\w+),\s*(.+)\);$/);
    if (aw) {
      const pin = pinMap[aw[1]] !== undefined ? pinMap[aw[1]] : parseInt(aw[1]);
      if (!isNaN(pin)) { stmts.push({op:"aw", pin, valExpr:aw[2]}); continue; }
    }

    // ── delay(ms) ──
    const dl = t.match(/^delay\((.+)\);$/);
    if (dl) { stmts.push({op:"delay", msExpr:dl[1]}); continue; }

    // ── Serial.begin(baud) ──
    const sb = t.match(/^Serial\.begin\((\d+)\);$/);
    if (sb) { stmts.push({op:"serial_begin", baud:parseInt(sb[1])}); continue; }

    // ── Serial.println(expr) ──
    const sp = t.match(/^Serial\.println\((.+)\);$/);
    if (sp) { stmts.push({op:"serial", msg:sp[1]}); continue; }

    // ── Serial.print(expr) ──
    const spr = t.match(/^Serial\.print\((.+)\);$/);
    if (spr) { stmts.push({op:"serial_print", msg:spr[1]}); continue; }

    // ── var = Serial.read() ──
    const srRead = t.match(/^(?:char|int|auto|String)\s+(\w+)\s*=\s*Serial\.read\(\);$/);
    if (srRead) { stmts.push({op:"serial_read_var", name:srRead[1]}); continue; }

    // ── var = Serial.readString() — drain entire queue into one string ──
    const srStr = t.match(/^(?:String|auto)\s+(\w+)\s*=\s*Serial\.readString\(\);$/);
    if (srStr) { stmts.push({op:"serial_readstr_var", name:srStr[1]}); continue; }

    // ── DHT readTemperature / readHumidity — must come before generic setvar ──
    const dhtT = t.match(/^(?:float|int|auto)\s+(\w+)\s*=\s*(\w+)\.readTemperature\(\);$/);
    if (dhtT) { stmts.push({op:"dht_read_temp", varName:dhtT[1], dhtName:dhtT[2]}); continue; }
    const dhtH = t.match(/^(?:float|int|auto)\s+(\w+)\s*=\s*(\w+)\.readHumidity\(\);$/);
    if (dhtH) { stmts.push({op:"dht_read_hum", varName:dhtH[1], dhtName:dhtH[2]}); continue; }

    // ── servo.read() — read current simulated angle ──
    const servoR = t.match(/^(?:int|auto)\s+(\w+)\s*=\s*(\w+)\.read\(\);$/);
    if (servoR) { stmts.push({op:"servo_read_sim", varName:servoR[1], servoName:servoR[2]}); continue; }

    // ── millis() / micros() — map to simTick time ──
    const millisV = t.match(/^(?:unsigned long|long|auto)\s+(\w+)\s*=\s*millis\(\);$/);
    if (millisV) { stmts.push({op:"millis_sim", varName:millisV[1]}); continue; }
    const microsV = t.match(/^(?:unsigned long|long|auto)\s+(\w+)\s*=\s*micros\(\);$/);
    if (microsV) { stmts.push({op:"micros_sim", varName:microsV[1]}); continue; }

    // ── typed/auto variable declaration ──
    const vd = t.match(/^(?:int|auto|float|bool|unsigned long|long|char|String)\s+(\w+)\s*=\s*(.+);$/);
    if (vd) { stmts.push({op:"setvar", name:vd[1], expr:vd[2]}); continue; }

    // ── augmented assignment ──
    const vau = t.match(/^(\w+)\s*([+\-*\/]?=)\s*(.+);$/);
    if (vau && !t.includes("==")) {
      if (vau[2] === "=") stmts.push({op:"setvar", name:vau[1], expr:vau[3]});
      else                stmts.push({op:"augvar", name:vau[1], op2:vau[2], expr:vau[3]});
      continue;
    }
  }
  return stmts;
}

function buildSimProgram(cpp) {
  simLoopStmts  = [];
  simSetupStmts = [];
  simSetupDone  = false;
  simGlobalInits = {};

  // ── helper: extract a function body by brace counting ──────
  function extractFnBody(src, fnName) {
    const start = src.search(new RegExp(`void\\s+${fnName}\\s*\\(\\s*\\)\\s*\\{`));
    if (start === -1) return null;
    const openAt = src.indexOf("{", start);
    let depth = 0, i = openAt;
    while (i < src.length) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(openAt + 1, i); }
      i++;
    }
    return null;
  }

  // ── 1. extract pin name → number mappings from all common declaration styles ──
  //   #define LED_PIN 13
  //   const int LED_PIN = 13;   ← only const qualifies as a pin constant
  const pinMap = {};
  for (const m of cpp.matchAll(/#define\s+(\w+)\s+(\d+)/g))
    pinMap[m[1]] = parseInt(m[2]);
  for (const m of cpp.matchAll(/\bconst\s+(?:int|byte|uint8_t|pin_t)\s+(\w+)\s*=\s*(\d+);/g))
    pinMap[m[1]] = parseInt(m[2]);

  // Expose pinMap globally so simEval can resolve named constants like LED_PIN
  simPinMap = { ...pinMap };

  // ── 2. parse plain globals (int x = 0) — store as inits, don't touch simVars yet ──
  const globalDecls = [...cpp.matchAll(/^(?:int|float|bool|unsigned long|long)\s+(\w+)\s*=\s*([^;]+);/gm)];
  for (const m of globalDecls) {
    if (pinMap[m[1]] !== undefined) continue;  // skip pin constants
    try { simGlobalInits[m[1]] = eval(m[2]); } catch(e) { simGlobalInits[m[1]] = 0; }
  }

  // ── 3. extract pinMode calls → set pin modes ──
  const pmCalls = [...cpp.matchAll(/pinMode\((\w+),\s*(OUTPUT|INPUT(?:_PULLUP)?)\)/g)];
  for (const m of pmCalls) {
    const num = pinMap[m[1]] !== undefined ? pinMap[m[1]] : parseInt(m[1]);
    if (!isNaN(num) && simPins[num]) {
      simPins[num].mode = m[2] === "OUTPUT" ? "OUTPUT" : "INPUT";
    }
  }

  // ── 4. parse void setup() body ──
  const setupBody = extractFnBody(cpp, "setup");
  if (setupBody !== null) {
    const setupLines = setupBody.split("\n").map(l => l.trim()).filter(Boolean);
    simSetupStmts = parseSimStmts(setupLines, pinMap);
  }

  // ── 5. parse void loop() body ──
  const loopBody = extractFnBody(cpp, "loop");
  if (loopBody !== null) {
    const loopLines = loopBody.split("\n").map(l => l.trim()).filter(Boolean);
    simLoopStmts = parseSimStmts(loopLines, pinMap);
  }
}

// ── Serial TX queue — bytes sent FROM the user TO the MCU ─
let serialTxQueue = [];  // array of individual characters waiting to be read by Serial.read()

// ── execute all setup() statements through the queue (so for/while/delay work) ─
function runSimSetup() {
  if (simSetupDone) return;
  // Load global initial values into simVars
  for (const [k, v] of Object.entries(simGlobalInits)) {
    simVars[k] = v;
  }
  // Push setup stmts to the FRONT of the queue — they run before loop stmts
  // A sentinel op marks when setup finishes
  simStmtQueue = [...simSetupStmts, { op: '_setup_done' }, ...simStmtQueue];
}

// ── resolve a serial message expression to a display string ─
function resolveSerialMsg(raw) {
  let msg = raw.trim();
  // strip surrounding double quotes → literal string
  if (/^".*"$/.test(msg)) return msg.slice(1, -1);
  // strip surrounding single quotes → literal char (Arduino char literals)
  if (/^'.*'$/.test(msg)) return msg.slice(1, -1);
  // it's a variable or expression — resolve it
  const val = simVars[msg];
  if (val !== undefined) return String(val);
  // try evaluating as expression
  try {
    let expr = msg;
    for (const [k, v] of Object.entries(simVars)) {
      expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), JSON.stringify(v));
    }
    const result = eval(expr);
    return String(result);
  } catch(e) {}
  return msg; // fallback: show raw expression
}

// ── evaluate a condition in sim context ──────────────────
function simEvalCond(cond) {
  let c = cond.trim();
  // Serial.available() > 0  →  check the TX queue
  c = c.replace(/Serial\.available\(\)\s*>\s*0/g, () => serialTxQueue.length > 0 ? "true" : "false");
  c = c.replace(/Serial\.available\(\)/g, () => String(serialTxQueue.length));
  // digitalRead(pin) — resolve named constants too
  c = c.replace(/digitalRead\((\w+)\)/g, (_, p) => {
    const num = isNaN(parseInt(p)) ? simPinMap[p] : parseInt(p);
    if (num !== undefined && simPins[num]) return simPins[num].value === "HIGH" ? 1 : 0;
    return 0;
  });
  // Replace named pin constants (e.g. LED_PIN → 13)
  for (const [k, v] of Object.entries(simPinMap)) {
    c = c.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
  }
  // replace known variables
  for (const [k, v] of Object.entries(simVars)) {
    c = c.replace(new RegExp(`\\b${k}\\b`, "g"), JSON.stringify(v));
  }
  // HIGH/LOW/boolean keywords
  c = c.replace(/\bHIGH\b/g, "1").replace(/\bLOW\b/g, "0");
  c = c.replace(/\btrue\b/g, "true").replace(/\bfalse\b/g, "false");
  try { return !!eval(c); } catch(e) { return false; }
}

// ── execute a single sim statement (recursive for if/while) ─
function execSimStmt(stmt) {
  switch (stmt.op) {

    case "dw":
      if (simPins[stmt.pin]) {
        simPins[stmt.pin].value = stmt.val;
        simPins[stmt.pin].mode  = "OUTPUT";
      }
      break;

    case "aw":
      if (simPins[stmt.pin]) {
        const v = typeof stmt.valExpr === "string" ? simEval(stmt.valExpr) : stmt.val;
        simPins[stmt.pin].pwm  = parseInt(v) || 0;
        simPins[stmt.pin].mode = "PWM";
      }
      break;

    case "serial_begin":
      serialBaud = stmt.baud;
      { const lbl = document.getElementById("serial-baud-label");
        if (lbl) lbl.textContent = stmt.baud + " baud"; }
      { const sel = document.getElementById("serial-baud-sel");
        if (sel) sel.value = String(stmt.baud); }
      serialAppend(`[Serial.begin(${stmt.baud}) — port open]`, "sys");
      break;

    case "serial":
      serialAppend(resolveSerialMsg(stmt.msg), "rx");
      break;

    case "serial_print":
      serialAppend(resolveSerialMsg(stmt.msg), "rx");
      break;

    case "serial_read_var":
      // consume one character from the TX queue
      if (serialTxQueue.length > 0) {
        simVars[stmt.name] = serialTxQueue.shift();
      } else {
        simVars[stmt.name] = "";   // nothing in buffer
      }
      break;

    case "serial_readstr_var":
      // drain the entire TX queue into one string (simulates readString() with timeout)
      // trim trailing \r\n like the real Arduino implementation
      simVars[stmt.name] = serialTxQueue.splice(0).join("").replace(/[\r\n]+$/, "");
      break;

    case "servo_read_sim":
      if (typeof compState !== "undefined" && compState.servos) {
        const sName = stmt.servoName || (compDetected.servoNames && compDetected.servoNames[0]) || 'myServo';
        simVars[stmt.varName] = (compState.servos[sName] && compState.servos[sName].angle) || 90;
      } else {
        simVars[stmt.varName] = 90;
      }
      break;

    case "millis_sim":
      simVars[stmt.varName] = simTick * parseInt(document.getElementById("speed-select")?.value || 1000);
      break;

    case "micros_sim":
      simVars[stmt.varName] = simTick * parseInt(document.getElementById("speed-select")?.value || 1000) * 1000;
      break;

    case "setvar":
      simVars[stmt.name] = simEval(stmt.expr);
      break;

    case "addvar":
      simVars[stmt.name] = (simVars[stmt.name] || 0) + simEval(stmt.expr);
      break;

    case "augvar": {
      const cur = simVars[stmt.name] || 0;
      const rhs = simEval(stmt.expr);
      if      (stmt.op2 === "+=") simVars[stmt.name] = cur + rhs;
      else if (stmt.op2 === "-=") simVars[stmt.name] = cur - rhs;
      else if (stmt.op2 === "*=") simVars[stmt.name] = cur * rhs;
      else if (stmt.op2 === "/=") simVars[stmt.name] = rhs !== 0 ? cur / rhs : 0;
      break;
    }

    case "if":
      if (simEvalCond(stmt.cond)) {
        for (let i = (stmt.then || []).length - 1; i >= 0; i--) simStmtQueue.unshift(stmt.then[i]);
      } else {
        for (let i = (stmt.else || []).length - 1; i >= 0; i--) simStmtQueue.unshift(stmt.else[i]);
      }
      break;

    case "for": {
      // Initialise the loop variable
      simVars[stmt.var] = simEval(stmt.init);
      // Build a while-equivalent op and push to queue
      // Each tick: check cond, if true push body + increment + self back to queue
      const forAsWhile = {
        op: "_for_tick",
        var:  stmt.var,
        cond: stmt.cond,
        incr: stmt.incr,
        body: stmt.body,
      };
      simStmtQueue.unshift(forAsWhile);
      break;
    }

    case "_for_tick": {
      // Evaluate condition
      let condExpr = stmt.cond;
      for (const [k, v] of Object.entries(simVars)) {
        condExpr = condExpr.replace(new RegExp(`\\b${k}\\b`, "g"), JSON.stringify(v));
      }
      let condResult = false;
      try { condResult = !!eval(condExpr); } catch(e) {}
      if (!condResult) break;  // loop finished

      // Push: body stmts, then increment op, then re-check of this _for_tick
      const incrOp = { op: "_for_incr", var: stmt.var, incr: stmt.incr };
      const recheck = { ...stmt };  // same _for_tick to re-evaluate next iteration
      const toQueue = [...(stmt.body || []), incrOp, recheck];
      for (let i = toQueue.length - 1; i >= 0; i--) {
        simStmtQueue.unshift(toQueue[i]);
      }
      break;
    }

    case "_for_incr": {
      const inc = stmt.incr.trim();
      if (/^\w+\+\+$/.test(inc)) {
        simVars[stmt.var] = (simVars[stmt.var] || 0) + 1;
      } else if (/^\w+--$/.test(inc)) {
        simVars[stmt.var] = (simVars[stmt.var] || 0) - 1;
      } else {
        const incrM = inc.match(/^(\w+)\s*([+\-*\/])=\s*(.+)$/);
        if (incrM) {
          const rhs = simEval(incrM[3]);
          const cur = simVars[incrM[1]] || 0;
          if      (incrM[2] === "+") simVars[incrM[1]] = cur + rhs;
          else if (incrM[2] === "-") simVars[incrM[1]] = cur - rhs;
          else if (incrM[2] === "*") simVars[incrM[1]] = cur * rhs;
          else if (incrM[2] === "/") simVars[incrM[1]] = rhs !== 0 ? cur / rhs : 0;
        }
      }
      break;
    }

    case "while": {
      // Inject while as a persistent looping stmt — re-check cond each tick
      // We do ONE iteration per simStep call to allow delays to work
      if (simEvalCond(stmt.cond)) {
        // Push body + re-check of this while stmt back to front of queue
        simStmtQueue.unshift(stmt);  // re-check while after body
        for (let i = (stmt.body || []).length - 1; i >= 0; i--) {
          simStmtQueue.unshift(stmt.body[i]);
        }
      }
      break;
    }

    case "delay": {
      // delay(ms) — simulate as ticks proportional to speed setting
      const ms = typeof stmt.msExpr === "string" ? simEval(stmt.msExpr) : (stmt.ms || 0);
      const ticks = Math.max(1, Math.round(ms / simTickMs));
      if (ticks > 1) {
        // Push a "wait" back into queue
        simStmtQueue.unshift({ op: "wait", ticks: ticks - 1 });
      }
      updateSimUI();
      break;
    }

    case "wait": {
      if (stmt.ticks > 1) {
        simStmtQueue.unshift({ op: "wait", ticks: stmt.ticks - 1 });
      }
      break;
    }

    case "_setup_done":
      simSetupDone = true;
      // Re-render pin table/SVG now that setup has fully executed
      renderPinTable();
      renderBoardSVG(currentBoardKey);
      updateSimUI();
      // If no loop, show idle message
      if (!simLoopStmts.length) {
        serialAppend("[No loop() body — setup complete, simulation idle]", "sys");
      }
      break;

    default:
      break;
  }
}

// ── eval a simple expression in sim context ────────────────
function simEval(expr) {
  expr = expr.trim();
  if (expr === "HIGH") return "HIGH";
  if (expr === "LOW")  return "LOW";
  if (expr === "true") return true;
  if (expr === "false") return false;
  // Serial.available() → queue length
  expr = expr.replace(/Serial\.available\(\)/g, () => String(serialTxQueue.length));
  // Serial.read() → consume one char from queue
  expr = expr.replace(/Serial\.read\(\)/g, () => {
    if (serialTxQueue.length > 0) return JSON.stringify(serialTxQueue.shift());
    return '""';
  });
  // Serial.readString() → drain entire queue into a string
  expr = expr.replace(/Serial\.readString\(\)/g, () => {
    return JSON.stringify(serialTxQueue.splice(0).join(""));
  });
  // millis() / micros() → simulated elapsed time
  expr = expr.replace(/\bmillis\(\)/g, () => String(simTick * parseInt(document.getElementById("speed-select")?.value || 1000)));
  expr = expr.replace(/\bmicros\(\)/g, () => String(simTick * parseInt(document.getElementById("speed-select")?.value || 1000) * 1000));
  // replace analogRead(pin) with simAnalog value — resolve named constants
  expr = expr.replace(/analogRead\((\w+)\)/g, (_, p) => {
    const num = isNaN(parseInt(p)) ? simPinMap[p] : parseInt(p);
    return (num !== undefined && simAnalog[num] !== undefined) ? simAnalog[num] : 0;
  });
  // replace digitalRead(pin) → 0 or 1 — resolve named constants
  expr = expr.replace(/digitalRead\((\w+)\)/g, (_, p) => {
    const num = isNaN(parseInt(p)) ? simPinMap[p] : parseInt(p);
    if (num !== undefined && simPins[num]) return simPins[num].value === "HIGH" ? 1 : 0;
    return 0;
  });
  // Replace named pin constants (HIGH/LOW/named pins) before var substitution
  expr = expr.replace(/\bHIGH\b/g, "1").replace(/\bLOW\b/g, "0");
  for (const [k, v] of Object.entries(simPinMap)) {
    expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
  }
  // replace known var names with their values
  for (const [k, v] of Object.entries(simVars)) {
    expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), JSON.stringify(v));
  }
  try { return eval(expr); } catch(e) { return 0; }
}

let simStmtIdx = 0;
let simDelayRemaining = 0;
let simStmtQueue = [];  // dynamic execution queue for while/delay support

function simStep() {
  // If queue is empty, refill from loop stmts (only after setup is complete)
  if (simStmtQueue.length === 0) {
    if (!simSetupDone) return;  // waiting for setup sentinel
    if (!simLoopStmts.length) return;
    simStmtQueue = [...simLoopStmts];
  }

  const stmt = simStmtQueue.shift();
  if (!stmt) return;

  execSimStmt(stmt);

  simTick++;
  updateSimUI();
}

