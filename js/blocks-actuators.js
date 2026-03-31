Blockly.Blocks['mcu_stepper_begin']={init(){
  this.appendDummyInput()
    .appendField("Stepper").appendField(new Blockly.FieldTextInput("motor"),"OBJ")
    .appendField("steps").appendField(new Blockly.FieldNumber(200,1),"STEPS")
    .appendField("pins IN1").appendField(new Blockly.FieldNumber(8,0,53),"P1")
    .appendField("IN2").appendField(new Blockly.FieldNumber(9,0,53),"P2")
    .appendField("IN3").appendField(new Blockly.FieldNumber(10,0,53),"P3")
    .appendField("IN4").appendField(new Blockly.FieldNumber(11,0,53),"P4");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.stepper);
}};
Blockly.Blocks['mcu_stepper_step']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("motor"),"OBJ")
    .appendField(".step(").appendField(new Blockly.FieldNumber(100,-10000,10000),"STEPS").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.stepper);
}};
Blockly.Blocks['mcu_stepper_speed']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("motor"),"OBJ")
    .appendField(".setSpeed(").appendField(new Blockly.FieldNumber(60,1),"RPM").appendField(" RPM)");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.stepper);
}};

/* ── I2C ────────────────────────────────────────────────── */
Blockly.Blocks['mcu_i2c_begin']={init(){
  this.appendDummyInput().appendField("Wire.begin()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.i2c);
}};
Blockly.Blocks['mcu_i2c_begin_transmission']={init(){
  this.appendDummyInput()
    .appendField("Wire.beginTransmission(").appendField(new Blockly.FieldTextInput("0x3C"),"ADDR").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.i2c);
}};
Blockly.Blocks['mcu_i2c_write']={init(){
  this.appendDummyInput()
    .appendField("Wire.write(").appendField(new Blockly.FieldTextInput("0x00"),"VAL").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.i2c);
}};
Blockly.Blocks['mcu_i2c_end_transmission']={init(){
  this.appendDummyInput().appendField("Wire.endTransmission()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.i2c);
}};
Blockly.Blocks['mcu_i2c_request']={init(){
  this.appendDummyInput()
    .appendField("Wire.requestFrom(").appendField(new Blockly.FieldTextInput("0x3C"),"ADDR")
    .appendField("bytes").appendField(new Blockly.FieldNumber(1,1),"BYTES").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.i2c);
}};
Blockly.Blocks['mcu_i2c_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("data"),"VAR")
    .appendField("= Wire.read()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.i2c);
}};

/* ── SPI ────────────────────────────────────────────────── */
Blockly.Blocks['mcu_spi_begin']={init(){
  this.appendDummyInput().appendField("SPI.begin()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.spi);
}};
Blockly.Blocks['mcu_spi_transfer']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("recv"),"VAR")
    .appendField("= SPI.transfer(").appendField(new Blockly.FieldTextInput("0x00"),"VAL").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.spi);
}};
Blockly.Blocks['mcu_spi_end']={init(){
  this.appendDummyInput().appendField("SPI.end()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.spi);
}};

/* ── KEYPAD 4×4 ─────────────────────────────────────────── */
Blockly.Blocks['mcu_keypad_begin']={init(){
  this.appendDummyInput()
    .appendField("Keypad.begin(rows").appendField(new Blockly.FieldNumber(4,1,8),"ROWS")
    .appendField("cols").appendField(new Blockly.FieldNumber(4,1,8),"COLS").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.keypad);
}};
Blockly.Blocks['mcu_keypad_getkey']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("key"),"VAR")
    .appendField("= Keypad.getKey()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.keypad);
}};

/* ── RTC DS3231 ─────────────────────────────────────────── */
Blockly.Blocks['mcu_rtc_begin']={init(){
  this.appendDummyInput().appendField("RTC.begin()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.rtc);
}};
Blockly.Blocks['mcu_rtc_get_hour']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("h"),"VAR").appendField("= RTC.hour()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.rtc);
}};
Blockly.Blocks['mcu_rtc_get_minute']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("m"),"VAR").appendField("= RTC.minute()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.rtc);
}};
Blockly.Blocks['mcu_rtc_get_second']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("s"),"VAR").appendField("= RTC.second()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.rtc);
}};
Blockly.Blocks['mcu_rtc_get_date']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("d"),"VAR").appendField("= RTC.date()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.rtc);
}};
Blockly.Blocks['mcu_rtc_set_time']={init(){
  this.appendDummyInput()
    .appendField("RTC.setTime(h").appendField(new Blockly.FieldNumber(12,0,23),"H")
    .appendField("m").appendField(new Blockly.FieldNumber(0,0,59),"M")
    .appendField("s").appendField(new Blockly.FieldNumber(0,0,59),"S").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.rtc);
}};

/* ── TM1637 7-SEGMENT ───────────────────────────────────── */
Blockly.Blocks['mcu_tm1637_begin']={init(){
  this.appendDummyInput()
    .appendField("TM1637.begin(CLK").appendField(new Blockly.FieldNumber(2,0,53),"CLK")
    .appendField("DIO").appendField(new Blockly.FieldNumber(3,0,53),"DIO").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.tm);
}};
Blockly.Blocks['mcu_tm1637_show']={init(){
  this.appendDummyInput()
    .appendField("TM1637.showNumber(").appendField(new Blockly.FieldTextInput("1234"),"VAL").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.tm);
}};
Blockly.Blocks['mcu_tm1637_brightness']={init(){
  this.appendDummyInput()
    .appendField("TM1637.setBrightness(").appendField(new Blockly.FieldNumber(7,0,7),"BR").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.tm);
}};

// ═══════════════════════════════════════════════════════════
//  BLOCK → JSON SERIALIZER
// ═══════════════════════════════════════════════════════════
