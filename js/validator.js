function validateCpp(cpp) {
  return [];
  const errors = [];
  const lines = cpp.split("\n");

  // ── Known built-in identifiers (never flag these) ───────
  const BUILTINS = new Set([
    // Arduino functions
    "setup","loop","digitalWrite","digitalRead","analogRead","analogWrite",
    "pinMode","delay","delayMicroseconds","millis","micros","map","constrain",
    "min","max","abs","pow","sqrt","random","randomSeed","tone","noTone",
    "pulseIn","attachInterrupt","detachInterrupt","interrupts","noInterrupts",
    "Serial","Wire","SPI","EEPROM","SD",
    // Types / keywords
    "void","int","float","double","bool","char","byte","long","short",
    "unsigned","String","auto","const","static","volatile","extern",
    "return","if","else","while","for","do","break","continue","switch","case",
    "default","new","delete","sizeof","nullptr","NULL","true","false",
    // Arduino constants
    "HIGH","LOW","INPUT","OUTPUT","INPUT_PULLUP","INPUT_PULLDOWN",
    "LED_BUILTIN","A0","A1","A2","A3","A4","A5","A6","A7","A8",
    "MOSI","MISO","SCK","SS","SDA","SCL",
    "F","PROGMEM","pgm_read_byte","pgm_read_word",
    "DHT11","DHT22","NEO_GRB","NEO_KHZ800","WHITE","BLACK","BLUE","RED","GREEN",
    "SSD1306_SWITCHCAPVCC","SSD1306_EXTERNALVCC",
    // Common lib objects (declared implicitly by their init blocks)
    "display","oled","uart","rtc","tm","irrecv","irResults","keypad",
    "ds18sensors","ds18wire","strip","motor","dht",
    "myServo","lcd","irrecv",
  ]);

  // ── First pass: collect ALL user-declared names ──────────
  const declared = new Set(BUILTINS);
  // Map: pin-name → pin-number (from const int NAME = N)
  const pinNameToNum = {};

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("#")) continue;

    // const int LED_PIN = 4;   or   const int X = 4;
    const constPin = t.match(/^const\s+int\s+(\w+)\s*=\s*(\d+)\s*;/);
    if (constPin) {
      declared.add(constPin[1]);
      pinNameToNum[constPin[1]] = parseInt(constPin[2]);
      continue;
    }

    // typed variable:  int x = 0;  float y;  bool b = true;  auto v = ...;
    const typedVar = t.match(/^(?:int|float|double|bool|char|byte|long|unsigned long|unsigned int|String|auto)\s+(\w+)\b/);
    if (typedVar) { declared.add(typedVar[1]); continue; }

    // function definition:  void foo(  int bar(
    const funcDef = t.match(/^(?:void|int|float|bool|String|char|byte|long)\s+(\w+)\s*\(/);
    if (funcDef) { declared.add(funcDef[1]); continue; }

    // object declaration:  Servo s;  DHT dht(...);  Adafruit_SSD1306 display(...);
    const objDecl = t.match(/^[A-Z]\w+(?:<[^>]+>)?\s+(\w+)\s*[=(;,]/);
    if (objDecl) { declared.add(objDecl[1]); continue; }

    // for-loop variable:  for (int i = 0 ...
    const forVar = t.match(/^for\s*\(\s*(?:int|float|auto)\s+(\w+)\s*=/);
    if (forVar) { declared.add(forVar[1]); continue; }
  }

  // ── Scan Serial.begin presence ───────────────────────────
  const hasSerialBegin = /Serial\s*\.\s*begin\s*\(\s*\d+\s*\)/.test(cpp);
  let   hasSetup = false, hasLoop = false;

  // ── Second pass: validate each line ──────────────────────
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t   = raw.trim();
    const ln  = i + 1;
    if (!t || t.startsWith("//") || t.startsWith("#")) continue;

    if (/^void setup\s*\(/.test(t)) hasSetup = true;
    if (/^void loop\s*\(/.test(t))  hasLoop  = true;

    // Skip declaration lines — they can't be usage errors
    const isDeclLine = /^(?:const\s+)?(?:int|float|double|bool|char|byte|long|unsigned|String|auto|void|[A-Z]\w+)\s/.test(t);

    // Serial.begin is auto-added by blocksToCpp — no validator needed

    // ── Undeclared identifier check ─────────────────────────
    // Only check non-declaration lines that contain a statement
    if (!isDeclLine) {
      // Strip string/char literals first so "Ready", 'x' etc. don't produce false positives
      const stripped = t
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')   // double-quoted strings
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");   // single-quoted chars
      const tokenRe = /\b([a-zA-Z_]\w*)\b/g;
      let tm;
      while ((tm = tokenRe.exec(stripped)) !== null) {
        const name = tm[1];
        // Skip if this token is a method/member (preceded by a dot)
        const precededByDot = tm.index > 0 && stripped[tm.index - 1] === '.';
        if (precededByDot) continue;
        // Skip known builtins, all-caps macros, single chars
        if (BUILTINS.has(name)) continue;
        if (/^[A-Z_][A-Z0-9_]*$/.test(name)) continue;  // ALL_CAPS macro
        if (name.length <= 1) continue;
        // Skip C++ extra keywords
        const extraKw = new Set(["include","define","ifdef","ifndef","endif",
          "pragma","struct","class","enum","typedef","template","namespace",
          "using","operator","inline","register"]);
        if (extraKw.has(name)) continue;
        if (!declared.has(name)) {
          errors.push({ line:ln, col: raw.indexOf(name) + 1, severity:"error",
            message:`'${name}' was not declared in this scope` });
          // Add to declared so we don't repeat the error for the same name
          declared.add(name);
        }
      }
    }

    // ── analogWrite on non-PWM pin ───────────────────────────
    // Match both literal pins and named constants: analogWrite(4,...) or analogWrite(LED_PIN,...)
    const awM = t.match(/\banalogWrite\s*\(\s*(\w+)\s*,/);
    if (awM) {
      const board = typeof currentBoard !== 'undefined' ? currentBoard : null;
      if (board) {
        let pinNum = null;
        if (/^\d+$/.test(awM[1])) {
          pinNum = parseInt(awM[1]);
        } else if (pinNameToNum[awM[1]] !== undefined) {
          pinNum = pinNameToNum[awM[1]];
        }
        if (pinNum !== null && !board.pwmPins.includes(pinNum)) {
          const nonPwmNote = board.nonPwmPins && board.nonPwmPins.includes(pinNum)
            ? ` (pin ${pinNum} is a non-PWM digital pin on ${board.name})`
            : ` (pin ${pinNum} is not in the PWM list for ${board.name}: [${board.pwmPins.join(",")}])`;
          errors.push({ line:ln, col:1, severity:"error",
            message:`analogWrite() cannot be used on pin ${pinNum}${nonPwmNote}` });
        }
      }
    }

    // ── delay(0) ─────────────────────────────────────────────
    if (/\bdelay\s*\(\s*0\s*\)/.test(t)) {
      errors.push({ line:ln, col:1, severity:"warning",
        message:"delay(0) has no effect" });
    }

    // ── Invalid pinMode mode ──────────────────────────────────
    const pmM = t.match(/\bpinMode\s*\(\s*\w+\s*,\s*(\w+)\s*\)/);
    if (pmM && !["OUTPUT","INPUT","INPUT_PULLUP","INPUT_PULLDOWN"].includes(pmM[1])) {
      errors.push({ line:ln, col:1, severity:"error",
        message:`Invalid pinMode mode '${pmM[1]}' — use OUTPUT, INPUT, or INPUT_PULLUP` });
    }

    // ── Method call on likely-undeclared object ───────────────
    const methodM = t.match(/^(\w+)\.(print|println|write|begin|available|read|setCursor|clear)\s*\(/);
    if (methodM && methodM[1] !== "Serial" && !declared.has(methodM[1])) {
      errors.push({ line:ln, col:1, severity:"error",
        message:`'${methodM[1]}' is not declared — did you forget to initialise it?` });
    }
  }

  if (!hasSetup) errors.push({ line:0, col:0, severity:"error",
    message:"Missing void setup() — every Arduino sketch needs a setup() function" });
  if (!hasLoop) errors.push({ line:0, col:0, severity:"error",
    message:"Missing void loop() — every Arduino sketch needs a loop() function" });

  return errors;
}

/* ── MicroPython validator ─────────────────────────────── */
function validatePython(src) {
  const errors = [];
  const lines = src.split("\n");
  const declaredNames = new Set([
    // builtins
    "print","len","range","int","float","str","bool","list","dict","tuple",
    "set","type","isinstance","enumerate","zip","map","filter","sorted",
    "reversed","min","max","sum","abs","round","hex","bin","oct","ord","chr",
    "input","open","bytes","bytearray","True","False","None","Exception",
    // machine module
    "Pin","PWM","UART","ADC","I2C","SPI","Timer","RTC","time_pulse_us",
    "sleep_ms","sleep_us","sleep","ticks_ms","ticks_us","ticks_diff",
    "machine","utime","time","sys","os","gc","re","json","struct",
    // common libs
    "neopixel","ssd1306","dht","ds18x20","onewire","tm1637","ir_rx",
    "ir","oled","uart","i2c","spi","rtc","strip","ds","motor","keypad",
    "adc0","adc1","adc2","adc3","adc4","adc5","adc6","adc7",
  ]);
  const assignedNames = new Set(declaredNames);
  let   indentStack = [0];
  let   inDef = false;
  let   hasSetup = false, hasLoop = false;
  let   hasUartInit = false;

  // First pass — collect all assigned names
  for (const line of lines) {
    const t = line.trimStart();
    if (!t || t.startsWith("#")) continue;
    // def name():
    const defM = t.match(/^def\s+(\w+)\s*\(/);
    if (defM) assignedNames.add(defM[1]);
    // name = ...  (any assignment)
    const assignM = t.match(/^([a-zA-Z_]\w*)\s*(?:\+|-|\*|\/)?=/);
    if (assignM && !t.includes("==")) assignedNames.add(assignM[1]);
    // from X import Y, Z
    const fromM = t.match(/^from\s+\S+\s+import\s+(.+)/);
    if (fromM) fromM[1].split(",").forEach(n => assignedNames.add(n.trim().split(" as ").pop().trim()));
    // import X
    const impM = t.match(/^import\s+(\S+)/);
    if (impM) assignedNames.add(impM[1].split(".")[0]);
    // for x in
    const forM = t.match(/^for\s+(\w+)\s+in\s+/);
    if (forM) assignedNames.add(forM[1]);
    // uart = UART(...)
    if (/=\s*UART\s*\(/.test(t)) { const m=t.match(/^(\w+)\s*=/); if(m) { assignedNames.add(m[1]); hasUartInit=true; } }
    // detect setup/loop
    if (/^def\s+setup\s*\(\s*\)\s*:/.test(t)) hasSetup = true;
    if (/^def\s+loop\s*\(\s*\)\s*:/.test(t))  hasLoop  = true;
  }

  // Second pass — validate
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t   = raw.trimStart();
    const ln  = i + 1;
    const indent = raw.length - t.length;
    if (!t || t.startsWith("#")) continue;

    // ── Indentation check ──
    const expected = indentStack[indentStack.length - 1];
    if (indent % 4 !== 0) {
      errors.push({ line:ln, col:indent+1, severity:"warning",
        message:`Unexpected indentation (${indent} spaces) — use multiples of 4` });
    }

    // ── Colon missing after def/if/else/for/while ──
    const blockKeywords = /^(def|if|elif|else|for|while|with|try|except|finally|class)\b/;
    if (blockKeywords.test(t) && !t.endsWith(":") && !t.includes("#")) {
      errors.push({ line:ln, col:1, severity:"error",
        message:`Missing ':' at end of '${t.split(" ")[0]}' block on line ${ln}` });
    }

    // ── Undefined name used ──
    // Extract names that appear to be used (called or referenced, not assigned)
    const usages = [...t.matchAll(/\b([a-zA-Z_]\w*)\s*(?:\(|\.|\[|$|\s)/g)];
    const pyKeywords = new Set(["if","elif","else","for","while","return","break",
      "continue","pass","def","class","import","from","as","in","not","and","or",
      "is","lambda","with","try","except","finally","raise","yield","global",
      "nonlocal","del","assert","True","False","None","print"]);
    for (const u of usages) {
      const name = u[1];
      if (pyKeywords.has(name)) continue;
      if (/^\d/.test(name)) continue;
      if (/^[A-Z_][A-Z0-9_]*$/.test(name)) continue; // constant
      // Skip if this line IS the assignment
      const isAssign = new RegExp(`^${name}\\s*(?:[+\\-*/]?=)`).test(t);
      if (isAssign) continue;
      // Skip if it's part of a def/class declaration
      if (/^(def|class)\s/.test(t)) continue;
      if (!assignedNames.has(name)) {
        errors.push({ line:ln, col:raw.indexOf(name)+1, severity:"error",
          message:`NameError: name '${name}' is not defined` });
        assignedNames.add(name); // only report once
      }
    }

    // ── uart.write / uart.read without UART init ──
    if (/\buart\.(write|read|any)\s*\(/.test(t) && !hasUartInit) {
      errors.push({ line:ln, col:1, severity:"error",
        message:`'uart' is used but UART() was never assigned — add: uart = UART(0, baudrate=9600)` });
    }

    // ── print() without from utime import / sleep_ms without import ──
    if (/\bsleep_ms\s*\(/.test(t) && !assignedNames.has("sleep_ms")) {
      errors.push({ line:ln, col:1, severity:"error",
        message:`sleep_ms is not imported — add: from utime import sleep_ms` });
    }
    if (/\bticks_ms\s*\(/.test(t) && !assignedNames.has("ticks_ms")) {
      errors.push({ line:ln, col:1, severity:"error",
        message:`ticks_ms is not imported — add: from utime import ticks_ms` });
    }

    // ── Division by zero literal ──
    if (/\/\s*0\b/.test(t) && !/\/\//.test(t)) {
      errors.push({ line:ln, col:1, severity:"error",
        message:`ZeroDivisionError: division by zero` });
    }

    // ── tab mixed with spaces ──
    if (raw.startsWith("\t")) {
      errors.push({ line:ln, col:1, severity:"warning",
        message:`Tab character used for indentation — use 4 spaces instead` });
    }

    // track indent stack for scope
    if (t.endsWith(":") && blockKeywords.test(t)) {
      indentStack.push(indent + 4);
    } else if (indent < indentStack[indentStack.length - 1]) {
      while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
        indentStack.pop();
      }
    }
  }

  // ── Missing setup / loop ──
  if (!hasSetup) errors.push({ line:0, col:0, severity:"warning",
    message:`No def setup(): found — add a setup() function for initialisation code` });
  if (!hasLoop) errors.push({ line:0, col:0, severity:"warning",
    message:`No def loop(): found — add a loop() function or a 'while True:' block` });

  return errors;
}

/* ── Format errors for the error panel ─────────────────── */
function formatErrors(errors) {
  if (!errors.length) return null;
  const errs  = errors.filter(e => e.severity === "error");
  const warns = errors.filter(e => e.severity === "warning");
  let out = "";
  if (errs.length)  out += errs.map(e  => `✗ ${e.line > 0 ? `Line ${e.line}: ` : ""}${e.message}`).join("\n");
  if (warns.length) out += (errs.length ? "\n" : "") + warns.map(w => `⚠ ${w.line > 0 ? `Line ${w.line}: ` : ""}${w.message}`).join("\n");
  return out;
}

// ═══════════════════════════════════════════════════════════
//  COMPILE + DISPLAY
// ═══════════════════════════════════════════════════════════
let lastHex="", currentMode="blocks";

let _panelOpenedForError = false;

function showPanelError(msg, title) {
  // If the output panel is collapsed, show the full error as a toast only —
  // don't write to the hidden panel bar at all.
  if (viewCollapsed) {
    showToast(title || '⚠ Compile Error', 'error', msg);
    return;
  }

  const bar = document.getElementById("panel-error-bar");
  const msgEl = document.getElementById("panel-error-msg");
  const titleEl = bar && bar.querySelector(".err-title span");
  if (!bar || !msgEl) return;
  msgEl.textContent = msg;
  bar.style.display = "block";
  bar.style.borderTopColor = "#f85149";
  bar.style.borderBottomColor = "#3a1a1a";
  if (titleEl) titleEl.textContent = title || "⚠ Compile Error";
  showTab("cpp");
}

function hidePanelError() {
  const bar = document.getElementById("panel-error-bar");
  if (bar) bar.style.display = "none";
  _panelOpenedForError = false;
}

function compile(){
  hidePanelError();
  try{
    let mcu, cpp;
    if(currentMode==="text"){
      cpp=document.getElementById("mcu-editor").value;
      if(!cpp.trim()){setStatus("Nothing to compile","error");return;}
      mcu=cpp; // in C++ mode, mcu and cpp are the same
    } else {
      const blocks=workspaceToBlocks();
      if(!blocks.length){setStatus("No blocks — add blocks first","error");return;}
      mcu=blocksToMCU(blocks);
      cpp=blocksToCpp(blocks);
    }

    // ── Run validators ──────────────────────────────────────
    const cppErrors  = validateCpp(cpp);
    const pyErrors   = []; // Arduino C++ editor — no Python validation

    const allErrors   = [...cppErrors.filter(e=>e.severity==="error"),
                          ...pyErrors.filter(e=>e.severity==="error")];
    const allWarnings = [...cppErrors.filter(e=>e.severity==="warning"),
                          ...pyErrors.filter(e=>e.severity==="warning")];

    if (allErrors.length > 0) {
      // Hard errors — show panel, don't continue to asm/hex
      const errText = formatErrors([...allErrors, ...allWarnings]);
      const errSummary = `${allErrors.length} error${allErrors.length>1?"s":""}${allWarnings.length?` · ${allWarnings.length} warning${allWarnings.length>1?"s":""}`:""}`
      setStatus(`✗ ${errSummary} — see panel`, "error");
      document.getElementById("out-cpp").innerHTML = highlightCPP(cpp);
      showPanelError(errText);
      if (window.setMonacoErrors) window.setMonacoErrors([...allErrors, ...allWarnings]);
      return;
    }

    // ── No hard errors — compile to ASM/HEX ────────────────
    document.getElementById("out-cpp").innerHTML = highlightCPP(cpp);

    if (allWarnings.length > 0) {
      const warnText = formatErrors(allWarnings);
      const warnSummary = `${allWarnings.length} warning${allWarnings.length>1?"s":""}`;
      setStatus(`⚠ Compiled with ${warnSummary} — check panel`, "ok");
      showPanelError(warnText);
      const bar = document.getElementById("panel-error-bar");
      const title = bar && bar.querySelector(".err-title span");
      if (title) title.textContent = "⚠ Warnings";
      if (bar) bar.style.borderColor = "#ba7517";
      if (window.setMonacoErrors) window.setMonacoErrors(allWarnings);
    } else {
      const lineInfo = `${cpp.split("\n").length} lines`;
      setStatus(`✓ OK — ${lineInfo}`);
      if (window.clearMonacoErrors) window.clearMonacoErrors();
    }
  } catch(e){
    const msg = e.message || String(e);
    setStatus("✗ Compile error — see panel","error");
    showPanelError(msg);
    console.error("Compile error:", e);
  }
}

// ── Toast notification system ─────────────────────────────
function showToast(msg, type = 'ok', detail = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { ok: '✓', error: '✗', warn: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  // For long error details, show in a scrollable code block
  const isLong = detail && detail.length > 120;
  const detailHtml = detail
    ? isLong
      ? `<div style="color:#9d9d9d;font-size:10.5px;margin-top:5px;max-height:120px;overflow-y:auto;
               background:#1a1a1a;border-radius:3px;padding:6px 8px;font-family:monospace;
               white-space:pre-wrap;word-break:break-word;line-height:1.5;">${escapeToast(detail)}</div>`
      : `<div style="color:#8b949e;font-size:11px;margin-top:3px;white-space:pre-wrap;">${escapeToast(detail)}</div>`
    : '';
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '●'}</span>
    <div class="toast-msg">
      <div class="toast-title">${escapeToast(msg)}</div>
      ${detailHtml}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
  container.appendChild(toast);
  // Longer timeout for errors with details so user can read them
  const duration = type === 'error' && isLong ? 12000 : type === 'error' ? 6000 : type === 'warn' ? 5000 : 3500;
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 320);
  }, duration);
}
function escapeToast(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setStatus(msg, type = "ok") {
  const el = document.getElementById("status");
  if (el) { el.textContent = msg; el.style.color = type === "error" ? "#f85149" : "#1d9e75"; }
}
function showTab(name){
  document.querySelectorAll(".panel-tab").forEach((t,i)=>{
    t.classList.toggle("active",["cpp","hex"][i]===name);
  });
  document.querySelectorAll(".panel-body").forEach(b=>{
    b.classList.toggle("active",b.id===`tab-${name}`);
  });
}
