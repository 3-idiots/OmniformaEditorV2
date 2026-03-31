function blockToMCU(b, indent=0) {
  const p = "    ".repeat(indent);
  const p1 = "    ".repeat(indent + 1);
  const ch = (k) => (b[k] || []).map(c => blockToMCU(c, indent + 1)).join("");
  const t = b.type;

  // ── imports ──
  if (t === "import") {
    const libMap = {
      servo:  "from machine import PWM, Pin",
      lcd:    "from machine import I2C\nfrom lcd_api import LcdApi  # install lcd_api library",
      dht:    "import dht",
      wire:   "from machine import I2C, Pin",
      serial: "from machine import UART",
    };
    return (libMap[b.lib] || `# import ${b.lib}`) + "\n";
  }

  // ── pin declaration (MicroPython Pin object) ──
  if (t === "pin_setup") {
    const modeMap = { output:"Pin.OUT", input:"Pin.IN", input_pullup:"Pin.IN, Pin.PULL_UP" };
    return `${b.name} = Pin(${b.number}, ${modeMap[b.direction] || "Pin.OUT"})\n`;
  }

  if (t === "pin_mode") {
    const modeMap = { OUTPUT:"Pin.OUT", INPUT:"Pin.IN", INPUT_PULLUP:"Pin.IN, Pin.PULL_UP" };
    return `${p}${b.pin} = Pin(${b.pin}, ${modeMap[b.mode] || "Pin.OUT"})\n`;
  }

  // ── program structure ──
  if (t === "setup")    return `def setup():\n${ch("children") || p1 + "pass\n"}`;
  if (t === "forever")  return `def loop():\n${ch("children") || p1 + "pass\n"}`;
  if (t === "func_def") return `def ${b.name}():\n${ch("children") || p1 + "pass\n"}`;
  if (t === "func_call") return `${p}${b.name}()\n`;

  // ── digital I/O ──
  if (t === "digital_write") {
    const val = b.value === "HIGH" ? "1" : "0";
    return `${p}${pinConst(b.pin)}.value(${val})\n`;
  }
  if (t === "analog_write") {
    // MicroPython PWM
    return `${p}# PWM on ${pinConst(b.pin)}: duty ${b.value}/255\n${p}_pwm_${b.pin.toLowerCase().replace(/[^a-z0-9]/g,'_')} = PWM(${pinConst(b.pin)})\n${p}_pwm_${b.pin.toLowerCase().replace(/[^a-z0-9]/g,'_')}.duty(${Math.round(b.value / 255 * 1023)})\n`;
  }
  if (t === "digital_read")  return `${p}${b.var} = ${pinConst(b.pin)}.value()\n`;
  if (t === "analog_read")   return `${p}${b.var} = adc${b.channel}.read()\n`;
  if (t === "pulse_in")      return `${p}${b.var} = machine.time_pulse_us(${pinConst(b.pin)}, ${b.level === "HIGH" ? 1 : 0})\n`;

  // ── timing ──
  if (t === "delay")    return `${p}time.sleep_ms(${b.ms})\n`;
  if (t === "delay_us") return `${p}time.sleep_us(${b.us})\n`;
  if (t === "millis_var") return `${p}${b.var} = time.ticks_ms()\n`;

  // ── variables ──
  if (t === "set_var")    return `${p}${b.name} = ${b.value}\n`;
  if (t === "change_var") return `${p}${b.name} += ${b.by}\n`;
  if (t === "return")     return `${p}return ${b.value}\n`;
  if (t === "break")      return `${p}break\n`;
  if (t === "continue")   return `${p}continue\n`;

  // ── serial (UART) ──
  if (t === "print") return `${p}print(${b.value})\n`;
  if (t === "lib_call") {
    const args = (b.args || []).join(", ");
    const obj = b.obj || "";
    const m = b.method || "";
    if (/serial/i.test(obj)) {
      if (m === "begin")   return `${p}uart = UART(0, baudrate=${args})\n`;
      if (m === "println") return `${p}print(${args})\n`;
      if (m === "print")   return `${p}sys.stdout.write(str(${args}))\n`;
      if (m === "read")    return `${p}_ch = uart.read(1)\n`;
      if (m === "available") return `${p}uart.any()\n`;
    }
    if (m === "backlight")   return `${p}${obj}.backlight(True)\n`;
    if (m === "noBacklight") return `${p}${obj}.backlight(False)\n`;
    return `${p}${obj}.${m}(${args})\n`;
  }
  if (t === "serial_avail") return `${p}if uart.any():\n${ch("children")}`;
  if (t === "serial_read")  return `${p}${b.var} = uart.read(1)\n`;

  // ── tone / buzzer (MicroPython PWM) ──
  if (t === "tone_play") return `${p}_buz = PWM(${pinConst(b.pin)}, freq=${b.freq}, duty=512)\n`;
  if (t === "tone_stop") return `${p}_buz = PWM(${pinConst(b.pin)})\n${p}_buz.deinit()\n`;
  if (t === "beep")      return `${p}_buz = PWM(${pinConst(b.pin)}, freq=${b.freq}, duty=512)\n${p}time.sleep_ms(${b.dur})\n${p}_buz.deinit()\n`;

  // ── servo ──
  if (t === "servo_read") return `${p}${b.var} = ${b.obj}.read()\n`;

  // ── DHT sensor ──
  if (t === "dht_begin") return `${p}${b.obj} = dht.${b.dtype}(Pin(${b.pin}))\n`;
  if (t === "dht_read")  return `${p}${b.obj}.measure()\n${p}${b.var} = ${b.obj}.${b.method}()\n`;

  // ── control flow ──
  if (t === "if") {
    let s = `${p}if ${b.condition}:\n${ch("then") || p1 + "pass\n"}`;
    if (b.else && b.else.length) s += `${p}else:\n${ch("else")}`;
    return s;
  }
  if (t === "if_elif") {
    return `${p}if ${b.cond1}:\n${ch("then1") || p1 + "pass\n"}${p}elif ${b.cond2}:\n${ch("then2") || p1 + "pass\n"}${p}else:\n${ch("else") || p1 + "pass\n"}`;
  }
  if (t === "repeat") {
    return `${p}for _i in range(${b.times}):\n${ch("children") || p1 + "pass\n"}`;
  }
  if (t === "while")     return `${p}while ${b.condition}:\n${ch("children") || p1 + "pass\n"}`;
  if (t === "for_range") return `${p}for ${b.var} in range(${b.from}, ${b.to}):\n${ch("children") || p1 + "pass\n"}`;

  // ── new blocks MicroPython ──
  if (t === "button_read")   return `${p}${b.var} = Pin(${b.pin}, Pin.IN, Pin.PULL_UP).value()\n`;
  if (t === "button_debounce") return `${p}import time as _bt\n${p}${b.var} = False\n${p}if Pin(${b.pin}, Pin.IN, Pin.PULL_UP).value() == 0:\n${p}    _bt.sleep_ms(${b.ms}); ${b.var} = (Pin(${b.pin}, Pin.IN, Pin.PULL_UP).value() == 0)\n`;
  if (t === "relay_on")     return `${p}Pin(${b.pin}, Pin.OUT).value(1)\n`;
  if (t === "relay_off")    return `${p}Pin(${b.pin}, Pin.OUT).value(0)\n`;
  if (t === "serial_readstr") return `${p}${b.var} = uart.read().decode()\n`;
  if (t === "ultra_init")   return `${p}trig = Pin(${b.trig}, Pin.OUT)\n${p}echo = Pin(${b.echo}, Pin.IN)\n`;
  if (t === "ultra_cm")     return `${p}trig.value(0); time.sleep_us(2); trig.value(1); time.sleep_us(10); trig.value(0)\n${p}${b.var} = time_pulse_us(echo, 1) * 0.0343 / 2\n`;
  if (t === "ultra_inch")   return `${p}trig.value(0); time.sleep_us(2); trig.value(1); time.sleep_us(10); trig.value(0)\n${p}${b.var} = time_pulse_us(echo, 1) * 0.0133 / 2\n`;
  if (t === "oled_begin")   return `${p}from machine import I2C\nimport ssd1306\n${p}i2c = I2C(0)\n${p}oled = ssd1306.SSD1306_I2C(${b.w}, ${b.h}, i2c)\n`;
  if (t === "oled_print")   return `${p}oled.text("${b.val}", oled._x if hasattr(oled,"_x") else 0, 0)\n`;
  if (t === "oled_println") return `${p}oled.text(str(${b.val}), 0, 0)\n`;
  if (t === "oled_cursor")  return `${p}# OLED cursor set to (${b.x}, ${b.y}) — use in next oled.text call\n`;
  if (t === "oled_size")    return `${p}# OLED text size ${b.size} (MicroPython ssd1306 uses fixed size)\n`;
  if (t === "oled_rect")    return `${p}oled.rect(${b.x}, ${b.y}, ${b.w}, ${b.h}, 1)\n`;
  if (t === "oled_circle")  return `${p}# draw circle — use framebuf.ellipse if available\n`;
  if (t === "oled_line")    return `${p}oled.line(${b.x0}, ${b.y0}, ${b.x1}, ${b.y1}, 1)\n`;
  if (t === "oled_clear")   return `${p}oled.fill(0)\n`;
  if (t === "oled_display") return `${p}oled.show()\n`;
  if (t === "oled_invert")  return `${p}oled.invert(${b.inv === "true" ? 1 : 0})\n`;
  if (t === "ir_obstacle")  return `${p}${b.var} = Pin(${b.pin}, Pin.IN).value()\n`;
  if (t === "ir_line")      return `${p}${b.var} = Pin(${b.pin}, Pin.IN).value()\n`;
  if (t === "ir_begin")     return `${p}# IR receiver on pin ${b.pin} — use ir_rx library\n`;
  if (t === "ir_receive")   return `${p}${b.var} = ir.any()\n`;
  if (t === "ir_value")     return `${p}${b.var} = ir.get()\n`;
  if (t === "pir_read")     return `${p}${b.var} = Pin(${b.pin}, Pin.IN).value()\n`;
  if (t === "soil_read")    return `${p}${b.var} = ADC(${b.ch}).read_u16()\n`;
  if (t === "sound_read")   return `${p}${b.var} = ADC(${b.ch}).read_u16()\n`;
  if (t === "ldr_read")     return `${p}${b.var} = ADC(${b.ch}).read_u16()\n`;
  if (t === "ds18_begin")   return `${p}import ds18x20, onewire\n${p}_ow = onewire.OneWire(Pin(${b.pin}))\n${p}ds = ds18x20.DS18X20(_ow)\n`;
  if (t === "ds18_read")    return `${p}ds.convert_temp(); time.sleep_ms(750)\n${p}${b.var} = ds.read_temp(ds.scan()[0])\n`;
  if (t === "neo_begin")    return `${p}import neopixel\n${p}${b.obj} = neopixel.NeoPixel(Pin(${b.pin}), ${b.count})\n`;
  if (t === "neo_pixel")    return `${p}${b.obj}[${b.idx}] = (${b.r}, ${b.g}, ${b.b})\n`;
  if (t === "neo_fill")     return `${p}${b.obj}.fill((${b.r}, ${b.g}, ${b.b}))\n`;
  if (t === "neo_bright")   return `${p}# NeoPixel brightness: scale values by ${b.br}/255\n`;
  if (t === "neo_show")     return `${p}${b.obj}.write()\n`;
  if (t === "neo_clear")    return `${p}${b.obj}.fill((0,0,0)); ${b.obj}.write()\n`;
  if (t === "rgb_set")      return `${p}PWM(Pin(${b.rp})).duty_u16(${Math.round(b.r/255*65535)})\n${p}PWM(Pin(${b.gp})).duty_u16(${Math.round(b.g/255*65535)})\n${p}PWM(Pin(${b.bp})).duty_u16(${Math.round(b.b/255*65535)})\n`;
  if (t === "rgb_off")      return `${p}PWM(Pin(${b.rp})).duty_u16(0); PWM(Pin(${b.gp})).duty_u16(0); PWM(Pin(${b.bp})).duty_u16(0)\n`;
  if (t === "step_begin")   return `${p}from machine import Pin as _Pin\nimport ustepper\n${p}${b.obj} = ustepper.Stepper(${b.p1},${b.p2},${b.p3},${b.p4})\n`;
  if (t === "step_step")    return `${p}${b.obj}.step(${b.steps})\n`;
  if (t === "step_speed")   return `${p}${b.obj}.set_speed(${b.rpm})\n`;
  if (t === "i2c_begin")    return `${p}from machine import I2C as _I2C\ni2c = _I2C(0)\n`;
  if (t === "i2c_start")    return `# Wire.beginTransmission(${b.addr}) — use i2c.writeto\n`;
  if (t === "i2c_write")    return `${p}i2c.writeto(addr, bytes([${b.val}]))\n`;
  if (t === "i2c_end")      return `${p}# Wire.endTransmission() handled by i2c.writeto\n`;
  if (t === "i2c_req")      return `${p}i2c.readfrom(${b.addr}, ${b.bytes})\n`;
  if (t === "i2c_read")     return `${p}${b.var} = i2c.readfrom(addr, 1)[0]\n`;
  if (t === "spi_begin")    return `${p}from machine import SPI\nspi = SPI(0)\n`;
  if (t === "spi_xfer")     return `${p}${b.var} = spi.read(1, ${b.val})[0]\n`;
  if (t === "spi_end")      return `${p}spi.deinit()\n`;
  if (t === "kpad_begin")   return `${p}# Keypad ${b.rows}x${b.cols} — use keypad library\n`;
  if (t === "kpad_key")     return `${p}${b.var} = keypad.key()\n`;
  if (t === "rtc_begin")    return `${p}from machine import RTC\nrtc = RTC()\n`;
  if (t === "rtc_get") {
    const f=b.field; const idx=f==="hour"?4:f==="minute"?5:f==="second"?6:2;
    return `${p}${b.var} = rtc.datetime()[${idx}]  # ${f}\n`;
  }
  if (t === "rtc_set")      return `${p}rtc.datetime((2024, 1, 1, 0, ${b.h}, ${b.m}, ${b.s}, 0))\n`;
  if (t === "tm_begin")     return `${p}import tm1637\n${p}tm = tm1637.TM1637(clk=Pin(${b.clk}), dio=Pin(${b.dio}))\n`;
  if (t === "tm_show")      return `${p}tm.number(${b.val})\n`;
  if (t === "tm_bright")    return `${p}tm.brightness(${b.br})\n`;

  return `${p}# unknown block: ${t}\n`;
}

function blocksToMCU(list) {
  const imp   = list.filter(b => b.type === "import");
  const pins  = list.filter(b => b.type === "pin_setup");
  const rest  = list.filter(b => b.type !== "import" && b.type !== "pin_setup");

  const listStr = JSON.stringify(list);

  // Determine which machine module members are needed
  const needsPWM    = /analog_write|tone/.test(listStr);
  const needsADC    = /analog_read/.test(listStr);
  const needsUART   = /serial|print/.test(listStr) || imp.some(b => b.lib === "serial");
  const needsI2C    = imp.some(b => b.lib === "wire" || b.lib === "lcd");
  const needsTime   = /delay|millis_var/.test(listStr);

  const machineImports = ["Pin"];
  if (needsPWM)  machineImports.push("PWM");
  if (needsADC)  machineImports.push("ADC");
  if (needsUART) machineImports.push("UART");
  if (needsI2C)  machineImports.push("I2C");

  const headerLines = [
    "# MicroPython — generated by MCU Block Editor",
    `from machine import ${machineImports.join(", ")}`,
  ];
  if (needsTime) headerLines.push("import time");
  // Add any explicit import blocks (dht, servo, etc.) — deduplicate
  const explicitImports = imp.map(b => blockToMCU(b)).filter(Boolean);
  headerLines.push(...explicitImports);

  const header = headerLines.join("\n") + "\n\n";

  const pinDecls = pins.map(b => blockToMCU(b)).join("");

  // Add ADC init for any analogRead
  const analogChans = new Set();
  function findAnalog(bl) {
    if (!bl) return;
    if (bl.type === "analog_read") analogChans.add(bl.channel);
    for (const k of ["children","then","else","then1","then2"]) (bl[k]||[]).forEach(findAnalog);
  }
  list.forEach(findAnalog);
  const adcInits = [...analogChans].map(ch => `adc${ch} = ADC(${ch})`).join("\n");

  const body = rest.map(b => blockToMCU(b, 0)).join("");

  // Build main call at bottom
  const hasSetup = rest.some(b => b.type === "setup");
  const hasLoop  = rest.some(b => b.type === "forever");
  const main = [
    hasSetup || hasLoop ? "\n# ── run ─────────────────────────────────────────────────" : "",
    hasSetup ? "setup()" : "",
    hasLoop  ? "while True:\n    loop()" : "",
  ].filter(Boolean).join("\n");

  return header + (adcInits ? adcInits + "\n\n" : "") + pinDecls + (pinDecls ? "\n" : "") + body + main + "\n";
}

// ═══════════════════════════════════════════════════════════
//  BLOCKS → ARDUINO C++ (direct, no regex)
// ═══════════════════════════════════════════════════════════
const STDLIB_INC={servo:"Servo.h",lcd:"LiquidCrystal.h",dht:"DHT.h",wire:"Wire.h",neo:"Adafruit_NeoPixel.h"};

