function mcuSourceToCpp(src) {
  const includes = [], globals = [], setupPin = [], setupBody = [], loopBody = [], extraFuncs = [];
  const lines = src.split("\n");
  let mode = null, funcName = null, funcLines = [];

  // Pin object registry: name → pin number, mode
  const pinObjs = {}; // { LED: { num: 13, mode: "OUTPUT" } }

  function addInc(h) { if (!includes.includes(h)) includes.push(h); }

  // ── translate one indented MicroPython line → C++ ────────
  function translateLine(raw) {
    const stripped = raw.trimStart();
    const iDepth = Math.floor((raw.length - stripped.length) / 4);
    const ind = "  ".repeat(iDepth);
    let s = stripped;

    if (!s) return "";
    // comments
    if (s.startsWith("#")) return `${ind}// ${s.slice(1).trim()}`;

    // ── imports ── (skip, handled by includes)
    if (/^(from machine import|import time|import sys|import dht|import machine)/.test(s)) return `${ind}// ${s}`;

    // ── Pin object declaration: NAME = Pin(num, mode) ──
    const pinDecl = s.match(/^(\w+)\s*=\s*Pin\((\d+),\s*(Pin\.(OUT|IN|IN,\s*Pin\.PULL_UP))\)/);
    if (pinDecl) {
      const [, name, num, , modeStr] = pinDecl;
      const cMode = modeStr === "OUT" ? "OUTPUT" : modeStr.includes("PULL_UP") ? "INPUT_PULLUP" : "INPUT";
      const cname = name.toUpperCase() + "_PIN";
      pinObjs[name] = { num, mode: cMode, cname };
      globals.push(`const int ${cname} = ${num};`);
      setupPin.push(`  pinMode(${cname}, ${cMode});`);
      return null; // handled
    }

    // ── ADC init: adc0 = machine.ADC(0) ──
    if (/^adc\d+\s*=\s*(machine\.)?ADC\(/.test(s)) return `${ind}// ADC: ${s}`;

    // ── UART init: uart = UART(0, baudrate=N) ──
    const uartM = s.match(/^uart\s*=\s*UART\([\d]+,\s*baudrate=(\d+)\)/);
    if (uartM) { setupBody.push(`  Serial.begin(${uartM[1]});`); return null; }

    // ── PIN .value(1|0) → digitalWrite ──
    const pinVal = s.match(/^(\w+)\.value\(([01])\)/);
    if (pinVal) {
      // match by var name OR by cname (LED or LED_PIN both work)
      const pobj = pinObjs[pinVal[1]] || Object.values(pinObjs).find(p => p.cname === pinVal[1]);
      if (pobj) return `${ind}digitalWrite(${pobj.cname}, ${pinVal[2] === "1" ? "HIGH" : "LOW"});`;
    }
    // pin.value() read → digitalRead
    const pinRead = s.match(/^(\w+)\s*=\s*(\w+)\.value\(\)/);
    if (pinRead) {
      const pobj = pinObjs[pinRead[2]] || Object.values(pinObjs).find(p => p.cname === pinRead[2]);
      if (pobj) return `${ind}int ${pinRead[1]} = digitalRead(${pobj.cname});`;
    }

    // ── time.sleep_ms(N) → delay(N) ──
    const slMs = s.match(/^time\.sleep_ms\((.+)\)/);
    if (slMs) return `${ind}delay(${slMs[1]});`;
    const slUs = s.match(/^time\.sleep_us\((.+)\)/);
    if (slUs) return `${ind}delayMicroseconds(${slUs[1]});`;
    const slS  = s.match(/^time\.sleep\((.+)\)/);
    if (slS)  return `${ind}delay((int)(${slS[1]} * 1000));`;

    // ── time.ticks_ms() → millis() ──
    s = s.replace(/time\.ticks_ms\(\)/g, "millis()");
    s = s.replace(/time\.ticks_diff\((.+?),\s*(.+?)\)/g, "((unsigned long)($1) - (unsigned long)($2))");

    // ── ADC read: var = adc0.read() → analogRead(A0) ──
    const adcRead = s.match(/^(\w+)\s*=\s*adc(\d+)\.read\(\)/);
    if (adcRead) return `${ind}int ${adcRead[1]} = analogRead(A${adcRead[2]});`;

    // ── print(x) → Serial.println(x) ──
    const printM = s.match(/^print\((.+)\)$/);
    if (printM) return `${ind}Serial.println(${printM[1]});`;
    // sys.stdout.write → Serial.print
    const writeM = s.match(/^sys\.stdout\.write\((.+)\)$/);
    if (writeM) return `${ind}Serial.print(${writeM[1]});`;

    // ── uart.any() → Serial.available() > 0 ──
    s = s.replace(/uart\.any\(\)/g, "Serial.available() > 0");
    s = s.replace(/uart\.read\(1\)/g, "(char)Serial.read()");

    // ── PWM ──
    const pwmDecl = s.match(/^(\w+)\s*=\s*PWM\((\w+_PIN),\s*freq=(\d+),\s*duty=(\d+)\)/);
    if (pwmDecl) {
      addInc(null); // no include needed for tone
      return `${ind}tone(${pwmDecl[2]}, ${pwmDecl[3]});`;
    }
    const pwmDeinit = s.match(/^(\w+)\.deinit\(\)/);
    if (pwmDeinit) return `${ind}noTone(0); // ${pwmDeinit[1]}.deinit()`;

    // ── DHT ──
    const dhtDecl = s.match(/^(\w+)\s*=\s*dht\.(DHT\d+)\(Pin\((\d+)\)\)/);
    if (dhtDecl) {
      addInc("DHT.h");
      globals.push(`DHT ${dhtDecl[1]}(${dhtDecl[3]}, ${dhtDecl[2]});`);
      setupBody.push(`  ${dhtDecl[1]}.begin();`);
      return null;
    }
    const dhtRead = s.match(/^(\w+)\.(readTemperature|readHumidity)\(\)/);
    if (dhtRead) return `${ind}float _dhtval = ${dhtRead[1]}.${dhtRead[2]}();`;

    // ── if / elif / else / while / for → C++ ──
    if (/^if .+:$/.test(s))   return `${ind}if (${_convertCond(s.slice(3, -1).trim())}) {`;
    if (/^elif .+:$/.test(s)) return `${ind}} else if (${_convertCond(s.slice(5, -1).trim())}) {`;
    if (/^else:$/.test(s))    return `${ind}} else {`;
    if (/^while .+:$/.test(s)) return `${ind}while (${_convertCond(s.slice(6, -1).trim())}) {`;

    const forRange = s.match(/^for (\w+) in range\((.+)\):$/);
    if (forRange) {
      const args = forRange[2].split(",").map(x => x.trim());
      if (args.length === 1) return `${ind}for (int ${forRange[1]} = 0; ${forRange[1]} < ${args[0]}; ${forRange[1]}++) {`;
      if (args.length === 2) return `${ind}for (int ${forRange[1]} = ${args[0]}; ${forRange[1]} < ${args[1]}; ${forRange[1]}++) {`;
      if (args.length === 3) return `${ind}for (int ${forRange[1]} = ${args[0]}; ${forRange[1]} < ${args[1]}; ${forRange[1]} += ${args[2]}) {`;
    }

    // ── assignment with MicroPython type inference ──
    const assign = s.match(/^(\w+)\s*([+\-*\/]?=)\s*(.+)$/);
    if (assign && !s.includes("==") && !s.includes("!=") && !s.includes("<=") && !s.includes(">=")) {
      const [, name, op, val] = assign;
      if (op === "+=") return `${ind}${name} += ${_convertExpr(val)};`;
      if (op === "-=") return `${ind}${name} -= ${_convertExpr(val)};`;
      const converted = _convertExpr(val);
      const isNum  = /^-?\d+(\.\d+)?$/.test(val.trim());
      const isFloat = /^-?\d+\.\d+$/.test(val.trim());
      const isStr  = /^["']/.test(val.trim());
      const isBool = val.trim() === "True" || val.trim() === "False";
      const cval   = isBool ? (val.trim() === "True" ? "true" : "false") : converted;
      if (isFloat) return `${ind}float ${name} = ${cval};`;
      if (isNum)   return `${ind}int ${name} = ${cval};`;
      if (isStr)   return `${ind}String ${name} = ${cval.replace(/'/g, '"')};`;
      if (isBool)  return `${ind}bool ${name} = ${cval};`;
      return `${ind}auto ${name} = ${cval};`;
    }

    // ── return / break / continue / pass ──
    if (/^return\b/.test(s)) return `${ind}${_convertExpr(s)};`;
    if (s === "break")    return `${ind}break;`;
    if (s === "continue") return `${ind}continue;`;
    if (s === "pass")     return "";

    // ── bare function call or expression statement ──
    let out = _convertExpr(s);
    if (!out.endsWith(";") && !out.endsWith("{") && !out.endsWith("}")) out += ";";
    return `${ind}${out}`;
  }

  // Convert MicroPython condition to C++
  function _convertCond(c) {
    c = c.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||").replace(/\bnot\b/g, "!");
    c = c.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false");
    c = c.replace(/time\.ticks_ms\(\)/g, "millis()");
    for (const [pname, pobj] of Object.entries(pinObjs)) {
      c = c.replace(new RegExp(`\\b${pname}\\.value\\(\\)`, "g"), `digitalRead(${pobj.cname})`);
    }
    return c;
  }

  // Convert MicroPython expression to C++
  function _convertExpr(s) {
    s = s.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false");
    s = s.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||").replace(/\bnot /g, "!");
    s = s.replace(/time\.sleep_ms\((.+?)\)/g, "delay($1)");
    s = s.replace(/time\.sleep_us\((.+?)\)/g, "delayMicroseconds($1)");
    s = s.replace(/time\.ticks_ms\(\)/g, "millis()");
    s = s.replace(/adc(\d+)\.read\(\)/g, "analogRead(A$1)");
    s = s.replace(/print\((.+?)\)/g, "Serial.println($1)");
    s = s.replace(/uart\.any\(\)/g, "Serial.available()");
    s = s.replace(/uart\.read\(1\)/g, "(char)Serial.read()");
    for (const [pname, pobj] of Object.entries(pinObjs)) {
      s = s.replace(new RegExp(`\\b${pname}\\.value\\((\\d)\\)`, "g"), `digitalWrite(${pobj.cname}, $1 ? HIGH : LOW)`);
      s = s.replace(new RegExp(`\\b${pname}\\.value\\(\\)`, "g"), `digitalRead(${pobj.cname})`);
    }
    // Python string concat: f-strings (basic)
    s = s.replace(/f"([^"]*?)"/g, (_, inner) => {
      const parts = inner.split(/\{([^}]+)\}/).map((p, i) => i % 2 === 0 ? `"${p}"` : p);
      return parts.join(' + ');
    });
    return s;
  }

  // ── main parse loop ──────────────────────────────────────
  for (const raw of lines) {
    const stripped = raw.trimStart();
    if (!stripped) continue;

    // function definitions
    const funcDef = stripped.match(/^def (\w+)\(\):/);
    if (funcDef) {
      if (funcName && funcName !== "setup" && funcName !== "loop" && funcLines.length) {
        extraFuncs.push(`void ${funcName}() {`, ...funcLines, "}", "");
      }
      funcName = funcDef[1]; funcLines = []; mode = funcName;
      continue;
    }

    // while True: main loop (ignore — handled via loop() structure)
    if (stripped === "while True:" || stripped === "while True :") { mode = "loop"; continue; }

    // setup() / loop() call at bottom — skip
    if (stripped === "setup()" || stripped === "loop()") continue;

    // handle pin decl at top level (outside functions)
    const pinDecl = stripped.match(/^(\w+)\s*=\s*Pin\((\d+),\s*Pin\.(OUT|IN)\)/);
    if (pinDecl && !mode) {
      const [, name, num, modeStr] = pinDecl;
      const cMode = modeStr === "OUT" ? "OUTPUT" : "INPUT";
      const cname = name.toUpperCase() + "_PIN";
      pinObjs[name] = { num, mode: cMode, cname };
      globals.push(`const int ${cname} = ${num};`);
      setupPin.push(`  pinMode(${cname}, ${cMode});`);
      continue;
    }

    if (!mode) {
      // top-level statements before any def
      const tl = translateLine(raw);
      if (tl !== null && tl !== undefined && tl !== "") setupBody.push(tl);
      continue;
    }

    const translated = translateLine(raw);
    if (translated === null || translated === undefined) continue;
    if (translated === "") continue;

    if (mode === "setup")     setupBody.push(translated);
    else if (mode === "loop") loopBody.push(translated);
    else                      funcLines.push(translated);
  }

  // flush last custom function
  if (funcName && funcName !== "setup" && funcName !== "loop" && funcLines.length)
    extraFuncs.push(`void ${funcName}() {`, ...funcLines, "}", "");

  // auto-close unclosed { braces
  function autoClose(arr) {
    let open = 0;
    for (const l of arr) { open += (l.match(/\{/g) || []).length; open -= (l.match(/\}/g) || []).length; }
    for (let i = 0; i < open; i++) arr.push("  }");
  }
  autoClose(setupBody); autoClose(loopBody);

  // assemble C++ output
  const out = [];
  for (const i of includes) out.push(`#include <${i}>`);
  if (includes.length) out.push("");
  for (const g of globals) out.push(g);
  if (globals.length) out.push("");
  if (extraFuncs.length) { out.push(...extraFuncs); }
  out.push("void setup() {");
  out.push(...setupPin, ...setupBody);
  out.push("}", "", "void loop() {");
  out.push(...loopBody);
  out.push("}");
  return out.join("\n");
}

// ═══════════════════════════════════════════════════════════
//  AVR HEX GENERATOR
// ═══════════════════════════════════════════════════════════
const AVR_OPS={NOP:0x0000,LDI:0xE000,OUT:0xB800,RJMP:0xC000,RCALL:0xD000,RET:0x9508,SBI:0x9A00,CBI:0x9800};
const AVR_IO={DDRB:0x04,DDRC:0x07,DDRD:0x0A,PORTB:0x05,PORTC:0x08,PORTD:0x0B};
function pinToPort(n){return n<=7?["D",n]:n<=13?["B",n-8]:["C",n-14];}
function makeHex(bytes){
  const lines=[];let addr=0;
  for(let i=0;i<bytes.length;i+=16){
    const ch=bytes.slice(i,i+16),ll=ch.length;
    const raw=[ll,(addr>>8)&0xFF,addr&0xFF,0,...ch];
    const cs=(-(raw.reduce((a,b)=>a+b,0)))&0xFF;
    lines.push(":"+raw.map(b=>b.toString(16).padStart(2,"0").toUpperCase()).join("")+cs.toString(16).padStart(2,"0").toUpperCase());
    addr+=ll;
  }
  lines.push(":00000001FF");return lines.join("\n");
}
function cppToAsm(cpp){
  const asm=[],bytes=[];
  const emit=(w,c)=>{bytes.push(w&0xFF,(w>>8)&0xFF);asm.push("  "+c);};
  asm.push("; vector table");
  emit(AVR_OPS.RJMP,"RJMP __init");emit(AVR_OPS.NOP,"NOP ; INT0");emit(AVR_OPS.NOP,"NOP ; INT1");
  asm.push("; stack init");
  emit(AVR_OPS.LDI,"LDI R16, lo8(RAMEND)");emit(AVR_OPS.OUT,"OUT SPL, R16");
  emit(AVR_OPS.LDI,"LDI R16, hi8(RAMEND)");emit(AVR_OPS.OUT,"OUT SPH, R16");
  const pms=[...cpp.matchAll(/pinMode\((\w+),\s*(OUTPUT|INPUT[_PULLUP]*)\)/g)];
  if(pms.length) asm.push("; pinMode calls");
  for(const m of pms){
    const pn=(cpp.match(new RegExp(`const int ${m[1]}\\s*=\\s*(\\d+)`))||[])[1];
    if(pn){
      const[port,bit]=pinToPort(parseInt(pn));
      const reg=AVR_IO[`DDR${port}`]||0x04;
      const w=m[2]==="OUTPUT"?AVR_OPS.SBI|(reg<<3)|bit:AVR_OPS.CBI|(reg<<3)|bit;
      emit(w,`${m[2]==="OUTPUT"?"SBI":"CBI"} DDR${port}, ${bit}  ; pin ${pn} ${m[2]}`);
    }
  }
  const sb=cpp.match(/Serial\.begin\((\d+)\)/);
  if(sb){
    const ubrr=Math.max(0,Math.floor(16000000/(16*parseInt(sb[1])))-1);
    asm.push(`; Serial.begin(${sb[1]}) UBRR=${ubrr}`);
    emit(AVR_OPS.LDI,`LDI R16, ${ubrr&0xFF}`);emit(AVR_OPS.OUT,"OUT UBRRL, R16");
    emit(AVR_OPS.LDI,"LDI R16, 0x06");emit(AVR_OPS.OUT,"OUT UCSRB, R16");
  }
  asm.push("; main");
  emit(AVR_OPS.RCALL,"RCALL setup");emit(AVR_OPS.RCALL,"RCALL loop");emit(AVR_OPS.RJMP,"RJMP .-4");
  for(const m of [...cpp.matchAll(/digitalWrite\((\w+),\s*(HIGH|LOW)\)/g)]){
    const pn=(cpp.match(new RegExp(`const int ${m[1]}\\s*=\\s*(\\d+)`))||[])[1];
    if(pn){const[port,bit]=pinToPort(parseInt(pn));const pr=AVR_IO[`PORT${port}`]||0x05;
      emit(m[2]==="HIGH"?AVR_OPS.SBI|(pr<<3)|bit:AVR_OPS.CBI|(pr<<3)|bit,
           `${m[2]==="HIGH"?"SBI":"CBI"} PORT${port}, ${bit}  ; pin${pn} ${m[2]}`);}
  }
  for(const ms of [...cpp.matchAll(/delay\((\d+)\)/g)]){
    emit(AVR_OPS.RCALL,`RCALL _delay_${ms[1]}ms`);emit(AVR_OPS.RET,"RET");
  }
  asm.push("; epilogue");emit(AVR_OPS.RET,"RET");emit(AVR_OPS.RET,"RET");
  return{asm:asm.join("\n"),hex:makeHex(bytes),bytes};
}

// ═══════════════════════════════════════════════════════════
//  SYNTAX HIGHLIGHTERS
// ═══════════════════════════════════════════════════════════
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function wrapPre(h){return'<pre style="margin:0;background:transparent;border:none;padding:0;">'+h+'</pre>';}
function highlightMCU(src){
  return wrapPre(esc(src)
    // MicroPython keywords
    .replace(/\b(from|import|as|def|class|if|elif|else|while|for|in|not|in|and|or|not|return|break|continue|pass|True|False|None|lambda|try|except|finally|raise|with|yield|global|nonlocal|del|assert)\b/g,'<span class="kw">$1</span>')
    // machine module builtins
    .replace(/\b(Pin|PWM|UART|ADC|I2C|SPI|Timer|RTC|WDT|sleep_ms|sleep_us|sleep|ticks_ms|ticks_us|ticks_diff|time_pulse_us|freq|value|toggle|duty|duty_u16|read_u16|read|write|any|available|begin|deinit|init|reset|irq|mem8|mem16|mem32)\b/g,'<span class="fn">$1</span>')
    // common MicroPython functions
    .replace(/\b(print|len|range|int|float|str|bool|list|dict|tuple|set|type|isinstance|enumerate|zip|map|filter|sorted|reversed|min|max|sum|abs|round|hex|bin|oct|ord|chr|input|open|bytes|bytearray)\b/g,'<span class="fn">$1</span>')
    // strings
    .replace(/&quot;([^&]*)&quot;/g,'<span class="str">&quot;$1&quot;</span>')
    .replace(/&#x27;([^&]*)&#x27;/g,'<span class="str">&#x27;$1&#x27;</span>')
    // comments
    .replace(/#[^\n]*/g,'<span class="cmt">$&</span>')
    // numbers
    .replace(/\b(0x[0-9a-fA-F]+|\d+\.?\d*)\b/g,'<span class="num">$1</span>'));
}
function highlightCPP(src){
  return wrapPre(esc(src)
    .replace(/\b(void|int|auto|float|bool|long|unsigned|String|const|if|else|while|for|return|true|false|OUTPUT|INPUT|INPUT_PULLUP|HIGH|LOW|DHT11|DHT22)\b/g,'<span class="kw">$1</span>')
    .replace(/\b(pinMode|digitalWrite|digitalRead|analogRead|analogWrite|delay|delayMicroseconds|Serial|tone|noTone|pulseIn|millis|map|constrain|begin|print|println|write|read|attach|detach|clear|setCursor|backlight|readTemperature|readHumidity)\b/g,'<span class="fn">$1</span>')
    .replace(/&quot;([^&]*)&quot;/g,'<span class="str">&quot;$1</span>')
    .replace(/#include[^\n]*/g,'<span class="cmt">$&</span>')
    .replace(/\/\/[^\n]*/g,'<span class="cmt">$&</span>')
    .replace(/\b(\d+)\b/g,'<span class="num">$1</span>'));
}
function highlightASM(src){
  return wrapPre(esc(src)
    .replace(/\b(RJMP|RCALL|RET|LDI|OUT|SBI|CBI|NOP|SBIS|IN|PUSH|POP|MOV|ADD|SUB|AND|OR|EOR|COM)\b/g,'<span class="kw">$1</span>')
    .replace(/\b(R\d{1,2}|SPL|SPH|SREG|UBRRL|UCSRB)\b/g,'<span class="type">$1</span>')
    .replace(/;[^\n]*/g,'<span class="cmt">$&</span>')
    .replace(/\b(\d+)\b/g,'<span class="num">$1</span>'));
}
function renderHex(bytes,hexStr){
  let html=`<div class="stage-label">Intel HEX (${bytes.length} bytes)</div>`;
  html+=`<pre style="margin:0;background:#0d1117;border-radius:7px;padding:11px;border:1px solid #30363d;font-size:12px;">`+
    hexStr.split("\n").map(l=>{
      if(!l.startsWith(":")) return esc(l);
      const ll=l.slice(1,3),aa=l.slice(3,7),tt=l.slice(7,9),data=l.slice(9,l.length-2),cs=l.slice(-2);
      return`:<span class="hex-addr">${ll}${aa}${tt}</span><span class="hex-data">${data}</span><span class="hex-sum">${cs}</span>`;
    }).join("\n")+"</pre>";
  html+=`<div class="stage-label">Binary dump (first 32 bytes)</div><div style="padding:8px;background:#0d1117;border-radius:7px;border:1px solid #30363d;">`;
  Array.from({length:Math.min(4,Math.ceil(bytes.length/8))},(_,i)=>{
    const row=bytes.slice(i*8,i*8+8);
    const hx=Array.from(row).map(b=>b.toString(16).padStart(2,"0").toUpperCase()).join(" ");
    const bn=Array.from(row).map(b=>b.toString(2).padStart(8,"0")).join(" ");
    html+=`<div class="hex-row"><span class="hex-off">${(i*8).toString(16).padStart(4,"0")}:</span><span class="hex-bytes">${hx}</span><span class="hex-bin">${bn}</span></div>`;
  });
  html+="</div>"; return html;
}

// ═══════════════════════════════════════════════════════════
//  STATIC VALIDATORS
//  Returns array of {line, col, severity, message} objects.
//  severity: 'error' | 'warning'
// ═══════════════════════════════════════════════════════════

/* ── Arduino C++ validator ─────────────────────────────── */
