function blockToJSON(block) {
  if (!block) return null;
  const t = block.type;
  const stmts = (name) => {
    const r=[]; let c=block.getInputTargetBlock(name);
    while(c){const j=blockToJSON(c);if(j)r.push(j);c=c.getNextBlock();}
    return r;
  };
  const condStr = (name) => {
    const b=block.getInputTargetBlock(name);
    if(!b) return "true";
    if(b.type==="mcu_compare") return `${b.getFieldValue("LEFT")} ${b.getFieldValue("OP").trim()} ${b.getFieldValue("RIGHT")}`;
    if(b.type==="mcu_logic_and"){
      const a=blockToJSON(b.getInputTargetBlock("A")), bb=blockToJSON(b.getInputTargetBlock("B"));
      return `${a?a.expr:"true"} and ${bb?bb.expr:"true"}`;
    }
    if(b.type==="mcu_logic_or"){
      const a=blockToJSON(b.getInputTargetBlock("A")), bb=blockToJSON(b.getInputTargetBlock("B"));
      return `${a?a.expr:"true"} or ${bb?bb.expr:"true"}`;
    }
    if(b.type==="mcu_logic_not"){
      const a=blockToJSON(b.getInputTargetBlock("A"));
      return `not ${a?a.expr:"true"}`;
    }
    if(b.type==="mcu_varname") return b.getFieldValue("NAME");
    if(b.type==="mcu_number")  return b.getFieldValue("NUM");
    return "true";
  };
  const v = (n) => block.getFieldValue(n);

  if(t==="mcu_pin_setup")     return {type:"pin_setup", name:v("NAME"), direction:v("DIR"), number:parseInt(v("NUM"))};
  if(t==="mcu_pin_mode")      return {type:"pin_mode",  pin:v("PIN"), mode:v("MODE")};
  if(t==="mcu_import")        return {type:"import",    lib:v("LIB")};
  if(t==="mcu_setup_block")   return {type:"setup",     children:stmts("BODY")};
  if(t==="mcu_func_def")      return {type:"func_def",  name:v("NAME"), children:stmts("BODY")};
  if(t==="mcu_func_call")     return {type:"func_call", name:v("NAME")};
  if(t==="mcu_forever")       return {type:"forever",   children:stmts("BODY")};
  if(t==="mcu_repeat")        return {type:"repeat",    times:parseInt(v("TIMES")), children:stmts("BODY")};
  if(t==="mcu_while")         return {type:"while",     condition:condStr("COND"), children:stmts("BODY")};
  if(t==="mcu_for_range")     return {type:"for_range", var:v("VAR"), from:parseInt(v("FROM")), to:parseInt(v("TO")), children:stmts("BODY")};
  if(t==="mcu_break")         return {type:"break"};
  if(t==="mcu_continue")      return {type:"continue"};
  if(t==="mcu_digital_write") return {type:"digital_write", pin:v("PIN"), value:v("VAL")};
  if(t==="mcu_digital_read")  return {type:"digital_read",  var:v("VAR"), pin:v("PIN")};
  if(t==="mcu_analog_read")   return {type:"analog_read",   var:v("VAR"), channel:parseInt(v("CH"))};
  if(t==="mcu_analog_write")  return {type:"analog_write",  pin:v("PIN"), value:parseInt(v("VAL"))};
  if(t==="mcu_pulse_in")      return {type:"pulse_in",      var:v("VAR"), pin:v("PIN"), level:v("LVL")};
  if(t==="mcu_tone")          return {type:"tone_play",     pin:v("PIN"), freq:parseInt(v("FREQ"))};
  if(t==="mcu_no_tone")       return {type:"tone_stop",     pin:v("PIN")};
  if(t==="mcu_beep")          return {type:"beep",          pin:v("PIN"), freq:parseInt(v("FREQ")), dur:parseInt(v("DUR"))};
  if(t==="mcu_if")            return {type:"if",   condition:condStr("COND"), then:stmts("THEN"), else:[]};
  if(t==="mcu_if_else")       return {type:"if",   condition:condStr("COND"), then:stmts("THEN"), else:stmts("ELSE")};
  if(t==="mcu_if_elif_else")  return {type:"if_elif", cond1:condStr("COND1"), then1:stmts("THEN1"), cond2:condStr("COND2"), then2:stmts("THEN2"), else:stmts("ELSE")};
  if(t==="mcu_delay")         return {type:"delay",    ms:parseInt(v("MS"))};
  if(t==="mcu_delay_micros")  return {type:"delay_us", us:parseInt(v("US"))};
  if(t==="mcu_set_var")       return {type:"set_var",  name:v("NAME"), value:v("VAL")};
  if(t==="mcu_change_var")    return {type:"change_var", name:v("NAME"), by:parseFloat(v("BY"))};
  if(t==="mcu_return")        return {type:"return",   value:v("VAL")};
  if(t==="mcu_serial_begin")  return {type:"lib_call", obj:"serial.Serial", method:"begin",   args:[parseInt(v("BAUD"))]};
  if(t==="mcu_serial_print")  return {type:"lib_call", obj:"serial.Serial", method:"print",   args:[v("VAL")]};
  if(t==="mcu_serial_println")return {type:"lib_call", obj:"serial.Serial", method:"println", args:[v("VAL")]};
  if(t==="mcu_serial_available") return {type:"serial_avail", children:stmts("BODY")};
  if(t==="mcu_serial_read")   return {type:"serial_read", var:v("VAR")};
  if(t==="mcu_servo_attach")  return {type:"lib_call", obj:v("OBJ"), method:"attach",  args:[parseInt(v("PIN"))]};
  if(t==="mcu_servo_write")   return {type:"lib_call", obj:v("OBJ"), method:"write",   args:[parseInt(v("ANGLE"))]};
  if(t==="mcu_servo_read")    return {type:"servo_read", var:v("VAR"), obj:v("OBJ")};
  if(t==="mcu_servo_detach")  return {type:"lib_call", obj:v("OBJ"), method:"detach",  args:[]};
  if(t==="mcu_lcd_begin")     return {type:"lcd_begin", obj:v("OBJ"), rs:parseInt(v("RS")), en:parseInt(v("EN")), d4:parseInt(v("D4")), d5:parseInt(v("D5")), d6:parseInt(v("D6")), d7:parseInt(v("D7")), cols:parseInt(v("COLS")), rows:parseInt(v("ROWS"))};
  if(t==="mcu_lcd_print")     return {type:"lib_call", obj:v("OBJ"), method:"print",   args:[`"${v("TXT")}"`]};
  if(t==="mcu_lcd_clear")     return {type:"lib_call", obj:v("OBJ"), method:"clear",   args:[]};
  if(t==="mcu_lcd_cursor")    return {type:"lib_call", obj:v("OBJ"), method:"setCursor", args:[parseInt(v("COL")),parseInt(v("ROW"))]};
  if(t==="mcu_lcd_backlight") return {type:"lib_call", obj:v("OBJ"), method:v("CMD").replace("()",""), args:[]};
  if(t==="mcu_dht_begin")     return {type:"dht_begin", obj:v("OBJ"), pin:parseInt(v("PIN")), dtype:v("TYPE")};
  if(t==="mcu_dht_temp")      return {type:"dht_read",  obj:v("OBJ"), var:v("VAR"), method:"readTemperature"};
  if(t==="mcu_dht_humidity")  return {type:"dht_read",  obj:v("OBJ"), var:v("VAR"), method:"readHumidity"};
  if(t==="mcu_compare")       return {type:"expr", expr:`${v("LEFT")} ${v("OP").trim()} ${v("RIGHT")}`};
  if(t==="mcu_math_op")       return {type:"expr", expr:`${v("LEFT")} ${v("OP")} ${v("RIGHT")}`};
  if(t==="mcu_map")           return {type:"expr", expr:`map(${v("VAL")}, ${v("FL")}, ${v("FH")}, ${v("TL")}, ${v("TH")})`};
  if(t==="mcu_constrain")     return {type:"expr", expr:`constrain(${v("VAL")}, ${v("MIN")}, ${v("MAX")})`};
  if(t==="mcu_millis")        return {type:"millis_var", var:v("VAR")};
  if(t==="mcu_number")        return {type:"expr", expr:v("NUM")};
  if(t==="mcu_text")          return {type:"expr", expr:`"${v("TXT")}"`};
  if(t==="mcu_varname")       return {type:"expr", expr:v("NAME")};
  // ── new blocks ──
  if(t==="mcu_button_read")   return {type:"button_read",   var:v("VAR"), pin:parseInt(v("PIN"))};
  if(t==="mcu_button_debounce") return {type:"button_debounce", var:v("VAR"), pin:parseInt(v("PIN")), ms:parseInt(v("MS"))};
  if(t==="mcu_relay_on")      return {type:"relay_on",  pin:parseInt(v("PIN"))};
  if(t==="mcu_relay_off")     return {type:"relay_off", pin:parseInt(v("PIN"))};
  if(t==="mcu_serial_readstring") return {type:"serial_readstr", var:v("VAR")};
  if(t==="mcu_ultrasonic_init") return {type:"ultra_init", trig:parseInt(v("TRIG")), echo:parseInt(v("ECHO"))};
  if(t==="mcu_ultrasonic_cm") return {type:"ultra_cm",   var:v("VAR"), trig:parseInt(v("TRIG")), echo:parseInt(v("ECHO"))};
  if(t==="mcu_ultrasonic_inch") return {type:"ultra_inch", var:v("VAR"), trig:parseInt(v("TRIG")), echo:parseInt(v("ECHO"))};
  if(t==="mcu_oled_begin")    return {type:"oled_begin",   w:parseInt(v("W")), h:parseInt(v("H")), addr:v("ADDR")};
  if(t==="mcu_oled_print")    return {type:"oled_print",   val:v("VAL")};
  if(t==="mcu_oled_println")  return {type:"oled_println", val:v("VAL")};
  if(t==="mcu_oled_set_cursor") return {type:"oled_cursor", x:parseInt(v("X")), y:parseInt(v("Y"))};
  if(t==="mcu_oled_set_size") return {type:"oled_size",    size:parseInt(v("SIZE"))};
  if(t==="mcu_oled_draw_rect") return {type:"oled_rect",   x:parseInt(v("X")), y:parseInt(v("Y")), w:parseInt(v("W")), h:parseInt(v("H"))};
  if(t==="mcu_oled_draw_circle") return {type:"oled_circle", x:parseInt(v("X")), y:parseInt(v("Y")), r:parseInt(v("R"))};
  if(t==="mcu_oled_draw_line") return {type:"oled_line",   x0:parseInt(v("X0")), y0:parseInt(v("Y0")), x1:parseInt(v("X1")), y1:parseInt(v("Y1"))};
  if(t==="mcu_oled_clear")    return {type:"oled_clear"};
  if(t==="mcu_oled_display")  return {type:"oled_display"};
  if(t==="mcu_oled_invert")   return {type:"oled_invert",  inv:v("INV")};
  if(t==="mcu_ir_obstacle")   return {type:"ir_obstacle",  var:v("VAR"), pin:parseInt(v("PIN"))};
  if(t==="mcu_ir_line")       return {type:"ir_line",      var:v("VAR"), pin:parseInt(v("PIN"))};
  if(t==="mcu_ir_begin")      return {type:"ir_begin",     pin:parseInt(v("PIN"))};
  if(t==="mcu_ir_receive")    return {type:"ir_receive",   var:v("VAR")};
  if(t==="mcu_ir_value")      return {type:"ir_value",     var:v("VAR")};
  if(t==="mcu_pir_read")      return {type:"pir_read",     var:v("VAR"), pin:parseInt(v("PIN"))};
  if(t==="mcu_soil_read")     return {type:"soil_read",    var:v("VAR"), ch:parseInt(v("CH"))};
  if(t==="mcu_sound_read")    return {type:"sound_read",   var:v("VAR"), ch:parseInt(v("CH"))};
  if(t==="mcu_ldr_read")      return {type:"ldr_read",     var:v("VAR"), ch:parseInt(v("CH"))};
  if(t==="mcu_ds18b20_begin") return {type:"ds18_begin",   pin:parseInt(v("PIN"))};
  if(t==="mcu_ds18b20_read")  return {type:"ds18_read",    var:v("VAR")};
  if(t==="mcu_neo_begin")     return {type:"neo_begin",    obj:v("OBJ"), pin:parseInt(v("PIN")), count:parseInt(v("COUNT"))};
  if(t==="mcu_neo_set_pixel") return {type:"neo_pixel",    obj:v("OBJ"), idx:parseInt(v("IDX")), r:parseInt(v("R")), g:parseInt(v("G")), b:parseInt(v("B"))};
  if(t==="mcu_neo_fill")      return {type:"neo_fill",     obj:v("OBJ"), r:parseInt(v("R")), g:parseInt(v("G")), b:parseInt(v("B"))};
  if(t==="mcu_neo_brightness") return {type:"neo_bright",  obj:v("OBJ"), br:parseInt(v("BR"))};
  if(t==="mcu_neo_show")      return {type:"neo_show",     obj:v("OBJ")};
  if(t==="mcu_neo_clear")     return {type:"neo_clear",    obj:v("OBJ")};
  if(t==="mcu_rgb_set")       return {type:"rgb_set",  rp:parseInt(v("RPIN")), gp:parseInt(v("GPIN")), bp:parseInt(v("BPIN")), r:parseInt(v("R")), g:parseInt(v("G")), b:parseInt(v("B"))};
  if(t==="mcu_rgb_off")       return {type:"rgb_off",  rp:parseInt(v("RPIN")), gp:parseInt(v("GPIN")), bp:parseInt(v("BPIN"))};
  if(t==="mcu_stepper_begin") return {type:"step_begin", obj:v("OBJ"), steps:parseInt(v("STEPS")), p1:parseInt(v("P1")), p2:parseInt(v("P2")), p3:parseInt(v("P3")), p4:parseInt(v("P4"))};
  if(t==="mcu_stepper_step")  return {type:"step_step",  obj:v("OBJ"), steps:parseInt(v("STEPS"))};
  if(t==="mcu_stepper_speed") return {type:"step_speed", obj:v("OBJ"), rpm:parseInt(v("RPM"))};
  if(t==="mcu_i2c_begin")     return {type:"i2c_begin"};
  if(t==="mcu_i2c_begin_transmission") return {type:"i2c_start", addr:v("ADDR")};
  if(t==="mcu_i2c_write")     return {type:"i2c_write",  val:v("VAL")};
  if(t==="mcu_i2c_end_transmission")   return {type:"i2c_end"};
  if(t==="mcu_i2c_request")   return {type:"i2c_req",   addr:v("ADDR"), bytes:parseInt(v("BYTES"))};
  if(t==="mcu_i2c_read")      return {type:"i2c_read",  var:v("VAR")};
  if(t==="mcu_spi_begin")     return {type:"spi_begin"};
  if(t==="mcu_spi_transfer")  return {type:"spi_xfer",  var:v("VAR"), val:v("VAL")};
  if(t==="mcu_spi_end")       return {type:"spi_end"};
  if(t==="mcu_keypad_begin")  return {type:"kpad_begin", rows:parseInt(v("ROWS")), cols:parseInt(v("COLS"))};
  if(t==="mcu_keypad_getkey") return {type:"kpad_key",  var:v("VAR")};
  if(t==="mcu_rtc_begin")     return {type:"rtc_begin"};
  if(t==="mcu_rtc_get_hour")  return {type:"rtc_get",   var:v("VAR"), field:"hour"};
  if(t==="mcu_rtc_get_minute") return {type:"rtc_get",  var:v("VAR"), field:"minute"};
  if(t==="mcu_rtc_get_second") return {type:"rtc_get",  var:v("VAR"), field:"second"};
  if(t==="mcu_rtc_get_date")  return {type:"rtc_get",   var:v("VAR"), field:"date"};
  if(t==="mcu_rtc_set_time")  return {type:"rtc_set",   h:parseInt(v("H")), m:parseInt(v("M")), s:parseInt(v("S"))};
  if(t==="mcu_tm1637_begin")  return {type:"tm_begin",  clk:parseInt(v("CLK")), dio:parseInt(v("DIO"))};
  if(t==="mcu_tm1637_show")   return {type:"tm_show",   val:v("VAL")};
  if(t==="mcu_tm1637_brightness") return {type:"tm_bright", br:parseInt(v("BR"))};
  return null;
}

function workspaceToBlocks() {
  const ws=Blockly.getMainWorkspace(), top=ws.getTopBlocks(true), blocks=[];
  for(const b of top){let c=b;while(c){const j=blockToJSON(c);if(j)blocks.push(j);c=c.getNextBlock();}}
  return blocks;
}

// ═══════════════════════════════════════════════════════════
//  BLOCKS → MICROPYTHON SOURCE
// ═══════════════════════════════════════════════════════════
