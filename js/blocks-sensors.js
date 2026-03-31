Blockly.Blocks['mcu_ultrasonic_init']={init(){
  this.appendDummyInput()
    .appendField("Ultrasonic  trig").appendField(new Blockly.FieldNumber(9,0,53),"TRIG")
    .appendField("echo").appendField(new Blockly.FieldNumber(10,0,53),"ECHO");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ultra);
}};
Blockly.Blocks['mcu_ultrasonic_cm']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("dist"),"VAR")
    .appendField("= distance cm  trig").appendField(new Blockly.FieldNumber(9,0,53),"TRIG")
    .appendField("echo").appendField(new Blockly.FieldNumber(10,0,53),"ECHO");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ultra);
}};
Blockly.Blocks['mcu_ultrasonic_inch']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("dist"),"VAR")
    .appendField("= distance inch  trig").appendField(new Blockly.FieldNumber(9,0,53),"TRIG")
    .appendField("echo").appendField(new Blockly.FieldNumber(10,0,53),"ECHO");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ultra);
}};

/* ── OLED SSD1306 ───────────────────────────────────────── */
Blockly.Blocks['mcu_oled_begin']={init(){
  this.appendDummyInput()
    .appendField("OLED.begin(").appendField(new Blockly.FieldNumber(128,1),"W")
    .appendField("x").appendField(new Blockly.FieldNumber(64,1),"H").appendField(")  addr")
    .appendField(new Blockly.FieldTextInput("0x3C"),"ADDR");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_print']={init(){
  this.appendDummyInput()
    .appendField("OLED.print(").appendField(new Blockly.FieldTextInput("hello"),"VAL").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_println']={init(){
  this.appendDummyInput()
    .appendField("OLED.println(").appendField(new Blockly.FieldTextInput("hello"),"VAL").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_set_cursor']={init(){
  this.appendDummyInput()
    .appendField("OLED.setCursor(x").appendField(new Blockly.FieldNumber(0,0),"X")
    .appendField("y").appendField(new Blockly.FieldNumber(0,0),"Y").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_set_size']={init(){
  this.appendDummyInput()
    .appendField("OLED.setTextSize(").appendField(new Blockly.FieldNumber(1,1,4),"SIZE").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_draw_rect']={init(){
  this.appendDummyInput()
    .appendField("OLED.drawRect x").appendField(new Blockly.FieldNumber(0,0),"X")
    .appendField("y").appendField(new Blockly.FieldNumber(0,0),"Y")
    .appendField("w").appendField(new Blockly.FieldNumber(20,1),"W")
    .appendField("h").appendField(new Blockly.FieldNumber(10,1),"H");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_draw_circle']={init(){
  this.appendDummyInput()
    .appendField("OLED.drawCircle x").appendField(new Blockly.FieldNumber(64,0),"X")
    .appendField("y").appendField(new Blockly.FieldNumber(32,0),"Y")
    .appendField("r").appendField(new Blockly.FieldNumber(10,1),"R");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_draw_line']={init(){
  this.appendDummyInput()
    .appendField("OLED.drawLine x0").appendField(new Blockly.FieldNumber(0,0),"X0")
    .appendField("y0").appendField(new Blockly.FieldNumber(0,0),"Y0")
    .appendField("x1").appendField(new Blockly.FieldNumber(127,0),"X1")
    .appendField("y1").appendField(new Blockly.FieldNumber(63,0),"Y1");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_clear']={init(){
  this.appendDummyInput().appendField("OLED.clearDisplay()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_display']={init(){
  this.appendDummyInput().appendField("OLED.display()  ← push to screen");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};
Blockly.Blocks['mcu_oled_invert']={init(){
  this.appendDummyInput()
    .appendField("OLED.invertDisplay(")
    .appendField(new Blockly.FieldDropdown([["true","true"],["false","false"]]),"INV")
    .appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.oled);
}};

/* ── IR SENSOR ──────────────────────────────────────────── */
Blockly.Blocks['mcu_ir_obstacle']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("obstacle"),"VAR")
    .appendField("= IR obstacle  pin").appendField(new Blockly.FieldNumber(3,0,53),"PIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ir);
}};
Blockly.Blocks['mcu_ir_line']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("onLine"),"VAR")
    .appendField("= IR line sensor  pin").appendField(new Blockly.FieldNumber(4,0,53),"PIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ir);
}};
Blockly.Blocks['mcu_ir_begin']={init(){
  this.appendDummyInput()
    .appendField("IRrecv.begin(pin").appendField(new Blockly.FieldNumber(11,0,53),"PIN").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ir);
}};
Blockly.Blocks['mcu_ir_receive']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("recv"),"VAR")
    .appendField("= IR.decode()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ir);
}};
Blockly.Blocks['mcu_ir_value']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("code"),"VAR")
    .appendField("= IR.value()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ir);
}};

/* ── PIR MOTION ─────────────────────────────────────────── */
Blockly.Blocks['mcu_pir_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("motion"),"VAR")
    .appendField("= PIR pin").appendField(new Blockly.FieldNumber(5,0,53),"PIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.pir);
}};

/* ── SOIL / WATER ───────────────────────────────────────── */
Blockly.Blocks['mcu_soil_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("moisture"),"VAR")
    .appendField("= soil sensor A").appendField(new Blockly.FieldNumber(0,0,15),"CH");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.soil);
}};

/* ── SOUND SENSOR ───────────────────────────────────────── */
Blockly.Blocks['mcu_sound_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("sound"),"VAR")
    .appendField("= sound sensor A").appendField(new Blockly.FieldNumber(1,0,15),"CH");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.sound);
}};

/* ── LDR LIGHT ──────────────────────────────────────────── */
Blockly.Blocks['mcu_ldr_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("light"),"VAR")
    .appendField("= LDR A").appendField(new Blockly.FieldNumber(0,0,15),"CH");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ldr);
}};

/* ── DS18B20 TEMP SENSOR ────────────────────────────────── */
Blockly.Blocks['mcu_ds18b20_begin']={init(){
  this.appendDummyInput()
    .appendField("DS18B20.begin(pin").appendField(new Blockly.FieldNumber(8,0,53),"PIN").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ds18);
}};
Blockly.Blocks['mcu_ds18b20_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("temp"),"VAR")
    .appendField("= DS18B20.getTempC()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ds18);
}};

/* ── NEOPIXEL / WS2812 ──────────────────────────────────── */
