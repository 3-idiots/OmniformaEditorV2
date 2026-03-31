function blocksToCpp(blockList) {
  const includes=[], globals=[], setupPin=[], setupBody=[], loopBody=[], extraFuncs=[];
  // Lines that appear BEFORE setup() and AFTER loop() in the sketch (top-level stray blocks)
  const preSetupLines=[], postLoopLines=[];
  // Track declared global object names to prevent duplicates
  const declaredGlobals = new Set();

  function addGlobal(line, key) {
    // key is the unique identifier (object name); if omitted, use the full line
    const k = key || line;
    if (declaredGlobals.has(k)) return;
    declaredGlobals.add(k);
    globals.push(line);
  }

  function addSetup(line) {
    if (!setupBody.includes(line)) setupBody.push(line);
  }

  function addInc(lib){
    const i = STDLIB_INC[lib] || (lib.includes('.h') ? lib : null);
    if(i && !includes.includes(i)) includes.push(i);
  }
  function ensureSerial(baud=9600){
    if(!setupBody.some(l=>l.includes('Serial.begin'))) setupBody.unshift(`  Serial.begin(${baud});`);
  }
  function eArg(a){return(typeof a==="number")?String(a):String(a);}

  function emitLibCall(b) {
    const args=(b.args||[]).map(eArg).join(", ");
    const obj=String(b.obj||"").replace(/^(serial|servo|lcd|dht|wire|neo)\./i,"");
    const m=b.method||"";
    if(/serial/i.test(b.obj)){
      if(m==="begin")   return `Serial.begin(${args});`;
      if(m==="println") return `Serial.println(${args});`;
      if(m==="print")   return `Serial.print(${args});`;
      if(m==="read")    return `Serial.read();`;
      if(m==="available") return `Serial.available();`;
    }
    if(m==="backlight")   return `${obj}.backlight();`;
    if(m==="noBacklight") return `${obj}.noBacklight();`;
    return `${obj}.${m}(${args});`;
  }

  // emitBlock: returns array of C++ lines for the given block at given depth.
  // For structural blocks (setup/forever/import/pin_setup/func_def/dht_begin)
  // it writes directly into the appropriate bucket and returns [].
  function emitBlock(b, depth) {
    const ind="  ".repeat(depth), lines=[];
    if(!b||!b.type) return lines;
    switch(b.type) {
      case "import":
        // serial doesn't need a #include — Arduino Serial is built-in
        if(b.lib !== "serial") addInc(b.lib);
        break;
      case "pin_setup": {
        const c=pinConst(b.name);
        globals.push(`const int ${c} = ${b.number};`);
        const mode = b.direction==="output"?"OUTPUT":b.direction==="input_pullup"?"INPUT_PULLUP":"INPUT";
        setupPin.push(`  pinMode(${c}, ${mode});`);
        break;
      }
      case "pin_mode":
        setupPin.push(`  pinMode(${pinConst(b.pin)}, ${b.mode});`);
        break;
      case "digital_write":
        lines.push(`${ind}digitalWrite(${pinConst(b.pin)}, ${b.value});`); break;
      case "analog_write":
        lines.push(`${ind}analogWrite(${pinConst(b.pin)}, ${b.value});`); break;
      case "digital_read":
        lines.push(`${ind}int ${b.var} = digitalRead(${pinConst(b.pin)});`); break;
      case "analog_read":
        lines.push(`${ind}int ${b.var} = analogRead(${b.channel});`); break;
      case "pulse_in":
        lines.push(`${ind}long ${b.var} = pulseIn(${pinConst(b.pin)}, ${b.level});`); break;
      case "tone_play":
        lines.push(`${ind}tone(${pinConst(b.pin)}, ${b.freq});`); break;
      case "tone_stop":
        lines.push(`${ind}noTone(${pinConst(b.pin)});`); break;
      case "beep":
        lines.push(`${ind}tone(${pinConst(b.pin)}, ${b.freq});`);
        lines.push(`${ind}delay(${b.dur});`);
        lines.push(`${ind}noTone(${pinConst(b.pin)});`);
        break;
      case "delay":    lines.push(`${ind}delay(${b.ms});`); break;
      case "delay_us": lines.push(`${ind}delayMicroseconds(${b.us});`); break;
      case "set_var":  lines.push(`${ind}auto ${b.name} = ${b.value};`); break;
      case "change_var": lines.push(`${ind}${b.name} += ${b.by};`); break;
      case "return":   lines.push(`${ind}return ${b.value};`); break;
      case "break":    lines.push(`${ind}break;`); break;
      case "continue": lines.push(`${ind}continue;`); break;
      case "millis_var": lines.push(`${ind}unsigned long ${b.var} = millis();`); break;
      case "print":    ensureSerial(); lines.push(`${ind}Serial.println(${eArg(b.value)});`); break;
      case "lib_call": {
        const callLine = emitLibCall(b);
        if(/serial/i.test(b.obj)) {
          if(b.method === 'begin') { setupBody.push(`  ${callLine}`); break; }
          ensureSerial();
        }
        // Auto-add Servo.h include and Servo object global on first attach()
        if(b.method === 'attach' && b.obj && !/serial|lcd|dht|wire|neo/i.test(b.obj)) {
          if(!includes.includes('Servo.h')) includes.push('Servo.h');
          const servoObj = String(b.obj).replace(/^servo\./i, '');
          addGlobal(`Servo ${servoObj};`, servoObj);
        }
        lines.push(`${ind}${callLine}`);
        break;
      }
      case "serial_avail": ensureSerial();
        lines.push(`${ind}if (Serial.available() > 0) {`);
        for(const c of (b.children||[])) lines.push(...emitBlock(c,depth+1));
        lines.push(`${ind}}`); break;
      case "serial_read":
        lines.push(`${ind}char ${b.var} = Serial.read();`); break;
      case "servo_read":
        lines.push(`${ind}int ${b.var} = ${b.obj}.read();`); break;
      case "dht_begin":
        if(!includes.includes("DHT.h")) includes.push("DHT.h");
        addGlobal(`DHT ${b.obj}(${b.pin}, ${b.dtype});`, b.obj);
        if(!setupBody.some(l=>l.includes(`${b.obj}.begin`))) setupBody.push(`  ${b.obj}.begin();`);
        break;
      case "dht_read":
        lines.push(`${ind}float ${b.var} = ${b.obj}.${b.method}();`);
        break;
      case "lcd_begin":
        if(!includes.includes("LiquidCrystal.h")) includes.push("LiquidCrystal.h");
        addGlobal(`LiquidCrystal ${b.obj}(${b.rs}, ${b.en}, ${b.d4}, ${b.d5}, ${b.d6}, ${b.d7});`, b.obj);
        if(!setupBody.some(l=>l.includes(`${b.obj}.begin`))) setupBody.push(`  ${b.obj}.begin(${b.cols}, ${b.rows});`);
        break;
      case "func_def": {
        const fl=[`void ${b.name}() {`];
        for(const c of (b.children||[])) fl.push(...emitBlock(c,1));
        fl.push("}","");
        extraFuncs.push(...fl); break;
      }
      case "func_call": lines.push(`${ind}${b.name}();`); break;
      case "if":
        lines.push(`${ind}if (${b.condition}) {`);
        for(const c of (b.then||[])) lines.push(...emitBlock(c,depth+1));
        if(b.else&&b.else.length){
          lines.push(`${ind}} else {`);
          for(const c of b.else) lines.push(...emitBlock(c,depth+1));
        }
        lines.push(`${ind}}`); break;
      case "if_elif":
        lines.push(`${ind}if (${b.cond1}) {`);
        for(const c of (b.then1||[])) lines.push(...emitBlock(c,depth+1));
        lines.push(`${ind}} else if (${b.cond2}) {`);
        for(const c of (b.then2||[])) lines.push(...emitBlock(c,depth+1));
        if(b.else&&b.else.length){
          lines.push(`${ind}} else {`);
          for(const c of b.else) lines.push(...emitBlock(c,depth+1));
        }
        lines.push(`${ind}}`); break;
      case "while":
        lines.push(`${ind}while (${b.condition}) {`);
        for(const c of (b.children||[])) lines.push(...emitBlock(c,depth+1));
        lines.push(`${ind}}`); break;
      case "for_range":
        lines.push(`${ind}for (int ${b.var} = ${b.from}; ${b.var} < ${b.to}; ${b.var}++) {`);
        for(const c of (b.children||[])) lines.push(...emitBlock(c,depth+1));
        lines.push(`${ind}}`); break;
      case "repeat": {
        const iv=`_i${depth}`;
        lines.push(`${ind}for (int ${iv} = 0; ${iv} < ${b.times}; ${iv}++) {`);
        for(const c of (b.children||[])) lines.push(...emitBlock(c,depth+1));
        lines.push(`${ind}}`); break;
      }
      // ── setup / loop: emit children into their buckets ──
      case "setup":
        for(const c of (b.children||[])) setupBody.push(...emitBlock(c,1));
        break;
      case "forever":
        for(const c of (b.children||[])) loopBody.push(...emitBlock(c,1));
        break;

      // ── BUTTON ──
      case "button_read":
        globals.push(`const int ${pinConst(b.var)}_BTN = ${b.pin};`);
        setupPin.push(`  pinMode(${b.pin}, INPUT_PULLUP);`);
        lines.push(`${ind}int ${b.var} = digitalRead(${b.pin});`); break;
      case "button_debounce":
        lines.push(`${ind}bool ${b.var} = false;`);
        lines.push(`${ind}if(digitalRead(${b.pin}) == LOW){ delay(${b.ms}); ${b.var} = (digitalRead(${b.pin}) == LOW); }`); break;

      // ── RELAY ──
      case "relay_on":
        setupPin.push(`  pinMode(${b.pin}, OUTPUT);`);
        lines.push(`${ind}digitalWrite(${b.pin}, HIGH);`); break;
      case "relay_off":
        lines.push(`${ind}digitalWrite(${b.pin}, LOW);`); break;

      // ── SERIAL READ STRING ──
      case "serial_readstr":
        lines.push(`${ind}String ${b.var} = Serial.readString();`); break;

      // ── ULTRASONIC ──
      case "ultra_init":
        globals.push(`const int TRIG_PIN = ${b.trig};`);
        globals.push(`const int ECHO_PIN = ${b.echo};`);
        setupPin.push(`  pinMode(${b.trig}, OUTPUT);`);
        setupPin.push(`  pinMode(${b.echo}, INPUT);`); break;
      case "ultra_cm":
        lines.push(`${ind}digitalWrite(${b.trig}, LOW); delayMicroseconds(2);`);
        lines.push(`${ind}digitalWrite(${b.trig}, HIGH); delayMicroseconds(10); digitalWrite(${b.trig}, LOW);`);
        lines.push(`${ind}long ${b.var}_dur = pulseIn(${b.echo}, HIGH);`);
        lines.push(`${ind}float ${b.var} = ${b.var}_dur * 0.034 / 2.0;`); break;
      case "ultra_inch":
        lines.push(`${ind}digitalWrite(${b.trig}, LOW); delayMicroseconds(2);`);
        lines.push(`${ind}digitalWrite(${b.trig}, HIGH); delayMicroseconds(10); digitalWrite(${b.trig}, LOW);`);
        lines.push(`${ind}long ${b.var}_dur = pulseIn(${b.echo}, HIGH);`);
        lines.push(`${ind}float ${b.var} = ${b.var}_dur * 0.0133 / 2.0;`); break;

      // ── OLED ──
      case "oled_begin":
        if(!includes.includes("Wire.h"))            includes.push("Wire.h");
        if(!includes.includes("Adafruit_GFX.h"))    includes.push("Adafruit_GFX.h");
        if(!includes.includes("Adafruit_SSD1306.h")) includes.push("Adafruit_SSD1306.h");
        addGlobal(`Adafruit_SSD1306 display(${b.w}, ${b.h}, &Wire, -1);`, "display");
        if(!setupBody.some(l=>l.includes('display.begin'))) {
          setupBody.push(`  if(!display.begin(SSD1306_SWITCHCAPVCC, ${b.addr})) { Serial.println(F("SSD1306 failed")); for(;;); }`);
          setupBody.push(`  display.clearDisplay();`);
          setupBody.push(`  display.setTextColor(SSD1306_WHITE);`);
          setupBody.push(`  display.display();`);
        }
        break;
      case "oled_print":    lines.push(`${ind}display.print(${/^\d/.test(b.val)||b.val.startsWith('"')?b.val:'"'+b.val+'"'});`); break;
      case "oled_println":  lines.push(`${ind}display.println(${/^\d/.test(b.val)||b.val.startsWith('"')?b.val:'"'+b.val+'"'});`); break;
      case "oled_cursor":   lines.push(`${ind}display.setCursor(${b.x}, ${b.y});`); break;
      case "oled_size":     lines.push(`${ind}display.setTextSize(${b.size});`); break;
      case "oled_rect":     lines.push(`${ind}display.drawRect(${b.x}, ${b.y}, ${b.w}, ${b.h}, WHITE);`); break;
      case "oled_circle":   lines.push(`${ind}display.drawCircle(${b.x}, ${b.y}, ${b.r}, WHITE);`); break;
      case "oled_line":     lines.push(`${ind}display.drawLine(${b.x0}, ${b.y0}, ${b.x1}, ${b.y1}, WHITE);`); break;
      case "oled_clear":    lines.push(`${ind}display.clearDisplay();`); break;
      case "oled_display":  lines.push(`${ind}display.display();`); break;
      case "oled_invert":   lines.push(`${ind}display.invertDisplay(${b.inv});`); break;

      // ── IR ──
      case "ir_obstacle":
        setupPin.push(`  pinMode(${b.pin}, INPUT);`);
        lines.push(`${ind}int ${b.var} = digitalRead(${b.pin});`); break;
      case "ir_line":
        setupPin.push(`  pinMode(${b.pin}, INPUT);`);
        lines.push(`${ind}int ${b.var} = digitalRead(${b.pin});`); break;
      case "ir_begin":
        addInc("IRremote.h");
        addGlobal(`IRrecv irrecv(${b.pin});`, "irrecv");
        addGlobal(`decode_results irResults;`, "irResults");
        if(!setupBody.some(l=>l.includes('irrecv.enableIRIn'))) setupBody.push(`  irrecv.enableIRIn();`);
        break;
      case "ir_receive":
        lines.push(`${ind}bool ${b.var} = irrecv.decode(&irResults);`); break;
      case "ir_value":
        lines.push(`${ind}long ${b.var} = irResults.value; irrecv.resume();`); break;

      // ── PIR ──
      case "pir_read":
        setupPin.push(`  pinMode(${b.pin}, INPUT);`);
        lines.push(`${ind}int ${b.var} = digitalRead(${b.pin});`); break;

      // ── SOIL / SOUND / LDR ──
      case "soil_read": lines.push(`${ind}int ${b.var} = analogRead(A${b.ch});`); break;
      case "sound_read": lines.push(`${ind}int ${b.var} = analogRead(A${b.ch});`); break;
      case "ldr_read":  lines.push(`${ind}int ${b.var} = analogRead(A${b.ch});`); break;

      // ── DS18B20 ──
      case "ds18_begin":
        addInc("OneWire.h"); addInc("DallasTemperature.h");
        addGlobal(`OneWire ds18wire(${b.pin});`, "ds18wire");
        addGlobal(`DallasTemperature ds18sensors(&ds18wire);`, "ds18sensors");
        if(!setupBody.some(l=>l.includes('ds18sensors.begin'))) setupBody.push(`  ds18sensors.begin();`);
        break;
      case "ds18_read":
        lines.push(`${ind}ds18sensors.requestTemperatures();`);
        lines.push(`${ind}float ${b.var} = ds18sensors.getTempCByIndex(0);`); break;

      // ── NEOPIXEL ──
      case "neo_begin":
        if(!includes.includes("Adafruit_NeoPixel.h")) includes.push("Adafruit_NeoPixel.h");
        addGlobal(`Adafruit_NeoPixel ${b.obj}(${b.count}, ${b.pin}, NEO_GRB + NEO_KHZ800);`, b.obj);
        if(!setupBody.some(l=>l.includes(`${b.obj}.begin`))) setupBody.push(`  ${b.obj}.begin(); ${b.obj}.show();`);
        break;
      case "neo_pixel":    lines.push(`${ind}${b.obj}.setPixelColor(${b.idx}, ${b.obj}.Color(${b.r}, ${b.g}, ${b.b}));`); break;
      case "neo_fill":     lines.push(`${ind}${b.obj}.fill(${b.obj}.Color(${b.r}, ${b.g}, ${b.b}));`); break;
      case "neo_bright":   lines.push(`${ind}${b.obj}.setBrightness(${b.br});`); break;
      case "neo_show":     lines.push(`${ind}${b.obj}.show();`); break;
      case "neo_clear":    lines.push(`${ind}${b.obj}.clear(); ${b.obj}.show();`); break;

      // ── RGB LED ──
      case "rgb_set":
        setupPin.push(`  pinMode(${b.rp}, OUTPUT); pinMode(${b.gp}, OUTPUT); pinMode(${b.bp}, OUTPUT);`);
        lines.push(`${ind}analogWrite(${b.rp}, ${b.r}); analogWrite(${b.gp}, ${b.g}); analogWrite(${b.bp}, ${b.b});`); break;
      case "rgb_off":
        lines.push(`${ind}analogWrite(${b.rp}, 0); analogWrite(${b.gp}, 0); analogWrite(${b.bp}, 0);`); break;

      // ── STEPPER ──
      case "step_begin":
        if(!includes.includes("Stepper.h")) includes.push("Stepper.h");
        addGlobal(`Stepper ${b.obj}(${b.steps}, ${b.p1}, ${b.p2}, ${b.p3}, ${b.p4});`, b.obj);
        break;
      case "step_step":  lines.push(`${ind}${b.obj}.step(${b.steps});`); break;
      case "step_speed": lines.push(`${ind}${b.obj}.setSpeed(${b.rpm});`); break;

      // ── I2C ──
      case "i2c_begin":  if(!includes.includes("Wire.h")) includes.push("Wire.h"); setupBody.push(`  Wire.begin();`); break;
      case "i2c_start":  lines.push(`${ind}Wire.beginTransmission(${b.addr});`); break;
      case "i2c_write":  lines.push(`${ind}Wire.write(${b.val});`); break;
      case "i2c_end":    lines.push(`${ind}Wire.endTransmission();`); break;
      case "i2c_req":    lines.push(`${ind}Wire.requestFrom(${b.addr}, ${b.bytes});`); break;
      case "i2c_read":   lines.push(`${ind}byte ${b.var} = Wire.read();`); break;

      // ── SPI ──
      case "spi_begin":  if(!includes.includes("SPI.h")) includes.push("SPI.h"); setupBody.push(`  SPI.begin();`); break;
      case "spi_xfer":   lines.push(`${ind}byte ${b.var} = SPI.transfer(${b.val});`); break;
      case "spi_end":    lines.push(`${ind}SPI.end();`); break;

      // ── KEYPAD ──
      case "kpad_begin":
        addInc("Keypad.h");
        globals.push(`// Keypad: connect row/col pins manually`);
        globals.push(`const byte ROWS = ${b.rows}; const byte COLS = ${b.cols};`); break;
      case "kpad_key":
        lines.push(`${ind}char ${b.var} = keypad.getKey();`); break;

      // ── RTC ──
      case "rtc_begin":
        if(!includes.includes("RTClib.h")) includes.push("RTClib.h");
        if(!includes.includes("Wire.h"))   includes.push("Wire.h");
        addGlobal(`RTC_DS3231 rtc;`, "rtc");
        if(!setupBody.some(l=>l.includes('rtc.begin'))) {
          setupBody.push(`  Wire.begin();`);
          setupBody.push(`  rtc.begin();`);
        }
        break;
      case "rtc_get": {
        const rtcF = b.field === "hour" ? "hour()" : b.field === "minute" ? "minute()" : b.field === "second" ? "second()" : "day()";
        lines.push(`${ind}int ${b.var} = rtc.now().${rtcF};`); break;
      }
      case "rtc_set":
        lines.push(`${ind}rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));  // or use: DateTime(Y,M,D,${b.h},${b.m},${b.s})`); break;

      // ── TM1637 ──
      case "tm_begin":
        if(!includes.includes("TM1637Display.h")) includes.push("TM1637Display.h");
        addGlobal(`TM1637Display tm(${b.clk}, ${b.dio});`, "tm");
        if(!setupBody.some(l=>l.includes('tm.setBrightness'))) setupBody.push(`  tm.setBrightness(7);`);
        break;
      case "tm_show":    lines.push(`${ind}tm.showNumberDec(${b.val});`); break;
      case "tm_bright":  lines.push(`${ind}tm.setBrightness(${b.br});`); break;

      default:
        lines.push(`${ind}// unknown: ${b.type}`);
    }
    return lines;
  }

  // ── Two-pass top-level processing ──────────────────────────
  // Determine the position of setup() and loop() in the list first.
  const structuralTypes = new Set([
    "import","pin_setup","setup","forever","func_def",
    "dht_begin","ultra_init","oled_begin","ir_begin","neo_begin",
    "step_begin","i2c_begin","spi_begin","kpad_begin","rtc_begin","tm_begin",
    "ds18_begin","button_read"
  ]);

  const setupIdx   = blockList.findIndex(b => b.type === "setup");
  const foreverIdx = blockList.findIndex(b => b.type === "forever");

  // Variable-declaration block types — these produce typed declarations
  // and belong at file scope when placed above setup().
  const varDeclTypes = new Set(["set_var","millis_var"]);

  for (let i = 0; i < blockList.length; i++) {
    const b = blockList[i];
    if (structuralTypes.has(b.type)) {
      emitBlock(b, 1);
      continue;
    }

    // Emit the block at depth=0 for globals (no leading indent) or depth=1 for function bodies
    const beforeSetup = setupIdx === -1 || i < setupIdx;
    const afterLoop   = foreverIdx !== -1 && i > foreverIdx;
    const between     = setupIdx !== -1 && foreverIdx !== -1 && i > setupIdx && i < foreverIdx;

    if (beforeSetup) {
      // ── ABOVE setup() ── → global scope
      // Emit without indent (depth=0) and type the variable properly
      const strayLines = emitBlock(b, 0);
      for (const line of strayLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Convert "auto name = val;" → typed global if possible
        const autoM = trimmed.match(/^auto\s+(\w+)\s*=\s*(.+);$/);
        if (autoM) {
          const [, name, val] = autoM;
          const isInt   = /^-?\d+$/.test(val);
          const isFloat = /^-?\d+\.\d+$/.test(val);
          const isStr   = /^"/.test(val);
          const isBool  = val === "true" || val === "false";
          if (isFloat)     globals.push(`float ${name} = ${val};`);
          else if (isInt)  globals.push(`int ${name} = ${val};`);
          else if (isStr)  globals.push(`String ${name} = ${val};`);
          else if (isBool) globals.push(`bool ${name} = ${val};`);
          else             globals.push(`auto ${name} = ${val};`);
        } else if (/^unsigned long/.test(trimmed) || /^int /.test(trimmed) ||
                   /^float /.test(trimmed) || /^bool /.test(trimmed) ||
                   /^String /.test(trimmed) || /^char /.test(trimmed)) {
          // Already typed — goes to globals as-is
          globals.push(trimmed);
        } else {
          // Non-declaration statement above setup → goes to top of setup() body
          setupBody.unshift("  " + trimmed);
        }
      }

    } else if (between) {
      // ── BETWEEN setup() and loop() ── → end of setup() body
      const strayLines = emitBlock(b, 1);
      setupBody.push(...strayLines);

    } else if (afterLoop) {
      // ── BELOW loop() ── → end of loop() body
      const strayLines = emitBlock(b, 1);
      loopBody.push(...strayLines);

    } else {
      // No setup/loop defined — fall back to globals for declarations, setup otherwise
      const strayLines = emitBlock(b, 0);
      for (const line of strayLines) {
        const t = line.trim();
        if (!t) continue;
        if (/^(int|float|bool|String|char|unsigned|auto)\s/.test(t)) globals.push(t);
        else setupBody.push("  " + t);
      }
    }
  }

  const out=[];
  for(const i of includes) out.push(`#include <${i}>`);
  if(includes.length) out.push("");
  for(const g of globals) out.push(g);
  if(globals.length) out.push("");
  if(extraFuncs.length){out.push(...extraFuncs);}
  out.push("void setup() {");
  out.push(...setupPin,...setupBody);
  out.push("}","","void loop() {");
  out.push(...loopBody);
  out.push("}");
  return out.join("\n");
}

// ═══════════════════════════════════════════════════════════
//  MICROPYTHON SOURCE → ARDUINO C++ COMPILER
// ═══════════════════════════════════════════════════════════
