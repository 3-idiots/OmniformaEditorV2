Blockly.Blocks['mcu_neo_begin']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("strip"),"OBJ")
    .appendField("= NeoPixel(pin").appendField(new Blockly.FieldNumber(6,0,53),"PIN")
    .appendField("count").appendField(new Blockly.FieldNumber(8,1),"COUNT").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.neo);
}};
Blockly.Blocks['mcu_neo_set_pixel']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("strip"),"OBJ")
    .appendField(".setPixelColor(#").appendField(new Blockly.FieldNumber(0,0),"IDX")
    .appendField("R").appendField(new Blockly.FieldNumber(255,0,255),"R")
    .appendField("G").appendField(new Blockly.FieldNumber(0,0,255),"G")
    .appendField("B").appendField(new Blockly.FieldNumber(0,0,255),"B").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.neo);
}};
Blockly.Blocks['mcu_neo_fill']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("strip"),"OBJ")
    .appendField(".fill(R").appendField(new Blockly.FieldNumber(255,0,255),"R")
    .appendField("G").appendField(new Blockly.FieldNumber(0,0,255),"G")
    .appendField("B").appendField(new Blockly.FieldNumber(0,0,255),"B").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.neo);
}};
Blockly.Blocks['mcu_neo_brightness']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("strip"),"OBJ")
    .appendField(".setBrightness(").appendField(new Blockly.FieldNumber(50,0,255),"BR").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.neo);
}};
Blockly.Blocks['mcu_neo_show']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("strip"),"OBJ").appendField(".show()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.neo);
}};
Blockly.Blocks['mcu_neo_clear']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("strip"),"OBJ").appendField(".clear()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.neo);
}};

/* ── RGB LED ────────────────────────────────────────────── */
Blockly.Blocks['mcu_rgb_set']={init(){
  this.appendDummyInput()
    .appendField("RGB LED  R-pin").appendField(new Blockly.FieldNumber(9,0,53),"RPIN")
    .appendField("G-pin").appendField(new Blockly.FieldNumber(10,0,53),"GPIN")
    .appendField("B-pin").appendField(new Blockly.FieldNumber(11,0,53),"BPIN")
    .appendField("→ R").appendField(new Blockly.FieldNumber(255,0,255),"R")
    .appendField("G").appendField(new Blockly.FieldNumber(0,0,255),"G")
    .appendField("B").appendField(new Blockly.FieldNumber(0,0,255),"B");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.rgb);
}};
Blockly.Blocks['mcu_rgb_off']={init(){
  this.appendDummyInput()
    .appendField("RGB LED OFF  R").appendField(new Blockly.FieldNumber(9,0,53),"RPIN")
    .appendField("G").appendField(new Blockly.FieldNumber(10,0,53),"GPIN")
    .appendField("B").appendField(new Blockly.FieldNumber(11,0,53),"BPIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.rgb);
}};

/* ── STEPPER MOTOR ──────────────────────────────────────── */
