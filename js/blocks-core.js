Blockly.Blocks['mcu_pin_setup']={init(){
  this.appendDummyInput()
    .appendField("pin").appendField(new Blockly.FieldTextInput("LED"),"NAME")
    .appendField("=").appendField(new Blockly.FieldDropdown([["output","output"],["input","input"],["input_pullup","input_pullup"]]),"DIR")
    .appendField("(").appendField(new Blockly.FieldNumber(13,0,53),"NUM").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.setup);this.setTooltip("Declare a pin with direction");
}};

Blockly.Blocks['mcu_pin_mode']={init(){
  this.appendDummyInput()
    .appendField("pinMode").appendField(new Blockly.FieldTextInput("LED"),"PIN")
    .appendField(new Blockly.FieldDropdown([["OUTPUT","OUTPUT"],["INPUT","INPUT"],["INPUT_PULLUP","INPUT_PULLUP"]]),"MODE");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.setup);
}};

Blockly.Blocks['mcu_import']={init(){
  this.appendDummyInput()
    .appendField("import")
    .appendField(new Blockly.FieldDropdown([["serial","serial"],["servo","servo"],["lcd","lcd"],["dht","dht"],["wire","wire"],["neo","neo"]]),"LIB");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.setup);
}};

Blockly.Blocks['mcu_setup_block']={init(){
  this.appendDummyInput().appendField("def setup():");
  this.appendStatementInput("BODY").setCheck(null);
  this.setColour(C.setup);this.setTooltip("Runs once at power-on");
}};

Blockly.Blocks['mcu_func_def']={init(){
  this.appendDummyInput()
    .appendField("def").appendField(new Blockly.FieldTextInput("myFunc"),"NAME").appendField("():");
  this.appendStatementInput("BODY").setCheck(null);
  this.setColour(C.setup);this.setTooltip("Define a custom function");
}};

Blockly.Blocks['mcu_func_call']={init(){
  this.appendDummyInput()
    .appendField("call").appendField(new Blockly.FieldTextInput("myFunc"),"NAME").appendField("()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.setup);
}};

/* ── LOOP CATEGORY ──────────────────────────────────────── */
Blockly.Blocks['mcu_forever']={init(){
  this.appendDummyInput().appendField("def loop():");
  this.appendStatementInput("BODY").setCheck(null);
  this.setColour(C.loop);this.setTooltip("Runs forever");
}};

Blockly.Blocks['mcu_repeat']={init(){
  this.appendDummyInput()
    .appendField("repeat").appendField(new Blockly.FieldNumber(5,1),"TIMES").appendField("times");
  this.appendStatementInput("BODY").setCheck(null);
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.loop);
}};

Blockly.Blocks['mcu_while']={init(){
  this.appendValueInput("COND").appendField("while");
  this.appendStatementInput("BODY").setCheck(null);
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.loop);
}};

Blockly.Blocks['mcu_for_range']={init(){
  this.appendDummyInput()
    .appendField("for").appendField(new Blockly.FieldTextInput("i"),"VAR")
    .appendField("in range(").appendField(new Blockly.FieldNumber(0,0),"FROM")
    .appendField(",").appendField(new Blockly.FieldNumber(10,1),"TO")
    .appendField("):");
  this.appendStatementInput("BODY").setCheck(null);
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.loop);
}};

Blockly.Blocks['mcu_break']={init(){
  this.appendDummyInput().appendField("break");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.loop);
}};

Blockly.Blocks['mcu_continue']={init(){
  this.appendDummyInput().appendField("continue");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.loop);
}};

/* ── DIGITAL I/O ────────────────────────────────────────── */
Blockly.Blocks['mcu_digital_write']={init(){
  this.appendDummyInput()
    .appendField("digitalWrite").appendField(new Blockly.FieldTextInput("LED"),"PIN")
    .appendField(",").appendField(new Blockly.FieldDropdown([["HIGH","HIGH"],["LOW","LOW"]]),"VAL");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.io);
}};

Blockly.Blocks['mcu_digital_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("btn"),"VAR")
    .appendField("= digitalRead").appendField(new Blockly.FieldTextInput("BUTTON"),"PIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.io);
}};

Blockly.Blocks['mcu_analog_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("val"),"VAR")
    .appendField("= analogRead A").appendField(new Blockly.FieldNumber(0,0,5),"CH");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.io);
}};

Blockly.Blocks['mcu_analog_write']={init(){
  this.appendDummyInput()
    .appendField("analogWrite").appendField(new Blockly.FieldTextInput("LED"),"PIN")
    .appendField(",").appendField(new Blockly.FieldNumber(128,0,255),"VAL");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.io);
}};

Blockly.Blocks['mcu_pulse_in']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("dur"),"VAR")
    .appendField("= pulseIn").appendField(new Blockly.FieldTextInput("TRIG"),"PIN")
    .appendField(new Blockly.FieldDropdown([["HIGH","HIGH"],["LOW","LOW"]]),"LVL");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.io);
}};

Blockly.Blocks['mcu_tone']={init(){
  this.appendDummyInput()
    .appendField("tone pin").appendField(new Blockly.FieldTextInput("BUZZ"),"PIN")
    .appendField("freq").appendField(new Blockly.FieldNumber(440,20,20000),"FREQ")
    .appendField("Hz");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.buzz);
}};

Blockly.Blocks['mcu_no_tone']={init(){
  this.appendDummyInput()
    .appendField("noTone pin").appendField(new Blockly.FieldTextInput("BUZZ"),"PIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.buzz);
}};

/* ── CONTROL ────────────────────────────────────────────── */
Blockly.Blocks['mcu_if']={init(){
  this.appendValueInput("COND").appendField("if");
  this.appendStatementInput("THEN").appendField(":");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ctrl);
}};

Blockly.Blocks['mcu_if_else']={init(){
  this.appendValueInput("COND").appendField("if");
  this.appendStatementInput("THEN").appendField(":");
  this.appendStatementInput("ELSE").appendField("else:");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ctrl);
}};

Blockly.Blocks['mcu_if_elif_else']={init(){
  this.appendValueInput("COND1").appendField("if");
  this.appendStatementInput("THEN1").appendField(":");
  this.appendValueInput("COND2").appendField("elif");
  this.appendStatementInput("THEN2").appendField(":");
  this.appendStatementInput("ELSE").appendField("else:");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ctrl);
}};

Blockly.Blocks['mcu_delay']={init(){
  this.appendDummyInput()
    .appendField("delay").appendField(new Blockly.FieldNumber(500,0),"MS").appendField("ms");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ctrl);
}};

Blockly.Blocks['mcu_delay_micros']={init(){
  this.appendDummyInput()
    .appendField("delayMicros").appendField(new Blockly.FieldNumber(100,0),"US").appendField("us");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ctrl);
}};

Blockly.Blocks['mcu_set_var']={init(){
  this.appendDummyInput()
    .appendField("set").appendField(new Blockly.FieldTextInput("x"),"NAME")
    .appendField("=").appendField(new Blockly.FieldTextInput("0"),"VAL");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ctrl);
}};

Blockly.Blocks['mcu_change_var']={init(){
  this.appendDummyInput()
    .appendField("change").appendField(new Blockly.FieldTextInput("x"),"NAME")
    .appendField("by").appendField(new Blockly.FieldNumber(1),"BY");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ctrl);
}};

Blockly.Blocks['mcu_return']={init(){
  this.appendDummyInput()
    .appendField("return").appendField(new Blockly.FieldTextInput(""),"VAL");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.ctrl);
}};

/* ── LOGIC / MATH ───────────────────────────────────────── */
Blockly.Blocks['mcu_compare']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("val"),"LEFT")
    .appendField(new Blockly.FieldDropdown([[">",">"],[">="," >="],[" < ","<"],["<=","<="],["==","=="],["!=","!="]]),"OP")
    .appendField(new Blockly.FieldTextInput("500"),"RIGHT");
  this.setOutput(true,"Boolean");
  this.setColour(C.logic);
}};

Blockly.Blocks['mcu_logic_and']={init(){
  this.appendValueInput("A");
  this.appendDummyInput().appendField("and");
  this.appendValueInput("B");
  this.setInputsInline(true);
  this.setOutput(true,"Boolean");
  this.setColour(C.logic);
}};

Blockly.Blocks['mcu_logic_or']={init(){
  this.appendValueInput("A");
  this.appendDummyInput().appendField("or");
  this.appendValueInput("B");
  this.setInputsInline(true);
  this.setOutput(true,"Boolean");
  this.setColour(C.logic);
}};

Blockly.Blocks['mcu_logic_not']={init(){
  this.appendValueInput("A").appendField("not");
  this.setOutput(true,"Boolean");
  this.setColour(C.logic);
}};

Blockly.Blocks['mcu_number']={init(){
  this.appendDummyInput().appendField(new Blockly.FieldNumber(0),"NUM");
  this.setOutput(true,"Number");this.setColour(C.logic);
}};

Blockly.Blocks['mcu_text']={init(){
  this.appendDummyInput().appendField('"').appendField(new Blockly.FieldTextInput("hello"),"TXT").appendField('"');
  this.setOutput(true,"String");this.setColour(C.logic);
}};

Blockly.Blocks['mcu_varname']={init(){
  this.appendDummyInput().appendField(new Blockly.FieldTextInput("val"),"NAME");
  this.setOutput(true,null);this.setColour(C.logic);
}};

Blockly.Blocks['mcu_math_op']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("a"),"LEFT")
    .appendField(new Blockly.FieldDropdown([["+","+"],["-","-"],["*","*"],["/","/"],["% (mod)","%"]]),"OP")
    .appendField(new Blockly.FieldTextInput("b"),"RIGHT");
  this.setOutput(true,"Number");this.setColour(C.logic);
}};

Blockly.Blocks['mcu_map']={init(){
  this.appendDummyInput()
    .appendField("map").appendField(new Blockly.FieldTextInput("val"),"VAL")
    .appendField("from").appendField(new Blockly.FieldNumber(0),"FL").appendField("-").appendField(new Blockly.FieldNumber(1023),"FH")
    .appendField("to").appendField(new Blockly.FieldNumber(0),"TL").appendField("-").appendField(new Blockly.FieldNumber(255),"TH");
  this.setOutput(true,"Number");this.setColour(C.logic);
}};

Blockly.Blocks['mcu_constrain']={init(){
  this.appendDummyInput()
    .appendField("constrain").appendField(new Blockly.FieldTextInput("val"),"VAL")
    .appendField("min").appendField(new Blockly.FieldNumber(0),"MIN")
    .appendField("max").appendField(new Blockly.FieldNumber(255),"MAX");
  this.setOutput(true,"Number");this.setColour(C.logic);
}};

Blockly.Blocks['mcu_millis']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("t"),"VAR").appendField("= millis()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.logic);
}};

/* ── SERIAL ─────────────────────────────────────────────── */
Blockly.Blocks['mcu_serial_begin']={init(){
  this.appendDummyInput()
    .appendField("Serial.begin(")
    .appendField(new Blockly.FieldDropdown([["9600","9600"],["115200","115200"],["57600","57600"],["4800","4800"]]),"BAUD")
    .appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.serial);
}};

Blockly.Blocks['mcu_serial_print']={init(){
  this.appendDummyInput()
    .appendField("Serial.print(").appendField(new Blockly.FieldTextInput("msg"),"VAL").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.serial);
}};

Blockly.Blocks['mcu_serial_println']={init(){
  this.appendDummyInput()
    .appendField("Serial.println(").appendField(new Blockly.FieldTextInput("msg"),"VAL").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.serial);
}};

Blockly.Blocks['mcu_serial_available']={init(){
  this.appendDummyInput()
    .appendField("if Serial.available() > 0:");
  this.appendStatementInput("BODY").setCheck(null);
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.serial);
}};

Blockly.Blocks['mcu_serial_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("c"),"VAR").appendField("= Serial.read()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.serial);
}};

/* ── SERVO ──────────────────────────────────────────────── */
Blockly.Blocks['mcu_servo_attach']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("myServo"),"OBJ")
    .appendField(".attach( pin").appendField(new Blockly.FieldNumber(9,0,13),"PIN").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.servo);
}};

Blockly.Blocks['mcu_servo_write']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("myServo"),"OBJ")
    .appendField(".write(").appendField(new Blockly.FieldNumber(90,0,180),"ANGLE").appendField("\u00b0)");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.servo);
}};

Blockly.Blocks['mcu_servo_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("ang"),"VAR")
    .appendField("=").appendField(new Blockly.FieldTextInput("myServo"),"OBJ").appendField(".read()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.servo);
}};

Blockly.Blocks['mcu_servo_detach']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("myServo"),"OBJ").appendField(".detach()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.servo);
}};

/* ── LCD ────────────────────────────────────────────────── */
Blockly.Blocks['mcu_lcd_begin']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("lcd"),"OBJ")
    .appendField("RS:").appendField(new Blockly.FieldNumber(12,0),"RS")
    .appendField("EN:").appendField(new Blockly.FieldNumber(11,0),"EN")
    .appendField("D4:").appendField(new Blockly.FieldNumber(5,0),"D4")
    .appendField("D5:").appendField(new Blockly.FieldNumber(4,0),"D5")
    .appendField("D6:").appendField(new Blockly.FieldNumber(3,0),"D6")
    .appendField("D7:").appendField(new Blockly.FieldNumber(2,0),"D7");
  this.appendDummyInput()
    .appendField("Cols:").appendField(new Blockly.FieldNumber(16,1),"COLS")
    .appendField("Rows:").appendField(new Blockly.FieldNumber(2,1),"ROWS");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.lcd);
}};

Blockly.Blocks['mcu_lcd_print']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("lcd"),"OBJ")
    .appendField('.print("').appendField(new Blockly.FieldTextInput("Hello!"),"TXT").appendField('")');
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.lcd);
}};

Blockly.Blocks['mcu_lcd_clear']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("lcd"),"OBJ").appendField(".clear()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.lcd);
}};

Blockly.Blocks['mcu_lcd_cursor']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("lcd"),"OBJ")
    .appendField(".setCursor(col").appendField(new Blockly.FieldNumber(0,0,15),"COL")
    .appendField("row").appendField(new Blockly.FieldNumber(0,0,3),"ROW").appendField(")");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.lcd);
}};

Blockly.Blocks['mcu_lcd_backlight']={init(){
  this.appendDummyInput()
    .appendField(new Blockly.FieldTextInput("lcd"),"OBJ")
    .appendField(new Blockly.FieldDropdown([[".backlight()",".backlight()"],["noBacklight()","noBacklight()"]]),"CMD");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.lcd);
}};

/* ── DHT ────────────────────────────────────────────────── */
Blockly.Blocks['mcu_dht_begin']={init(){
  this.appendDummyInput()
    .appendField("DHT").appendField(new Blockly.FieldTextInput("dht"),"OBJ")
    .appendField("pin").appendField(new Blockly.FieldNumber(2,0,53),"PIN")
    .appendField(new Blockly.FieldDropdown([["DHT11","DHT11"],["DHT22","DHT22"]]),"TYPE")
    .appendField(".begin()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.dht);
}};

Blockly.Blocks['mcu_dht_temp']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("temp"),"VAR")
    .appendField("=").appendField(new Blockly.FieldTextInput("dht"),"OBJ").appendField(".readTemperature()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.dht);
}};

Blockly.Blocks['mcu_dht_humidity']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("hum"),"VAR")
    .appendField("=").appendField(new Blockly.FieldTextInput("dht"),"OBJ").appendField(".readHumidity()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.dht);
}};

/* ── BUZZER ─────────────────────────────────────────────── */
Blockly.Blocks['mcu_beep']={init(){
  this.appendDummyInput()
    .appendField("beep pin").appendField(new Blockly.FieldTextInput("BUZZ"),"PIN")
    .appendField("freq").appendField(new Blockly.FieldNumber(1000,20,20000),"FREQ")
    .appendField("Hz for").appendField(new Blockly.FieldNumber(200,1),"DUR").appendField("ms");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.buzz);
}};

/* ── BUTTON / SWITCH ────────────────────────────────────── */
Blockly.Blocks['mcu_button_read']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("btn"),"VAR")
    .appendField("= button on pin").appendField(new Blockly.FieldNumber(2,0,53),"PIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.btn);
}};
Blockly.Blocks['mcu_button_debounce']={init(){
  this.appendDummyInput()
    .appendField("debounced button pin").appendField(new Blockly.FieldNumber(2,0,53),"PIN")
    .appendField("delay").appendField(new Blockly.FieldNumber(50,1),"MS").appendField("ms → var")
    .appendField(new Blockly.FieldTextInput("pressed"),"VAR");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.btn);
}};

/* ── RELAY ──────────────────────────────────────────────── */
Blockly.Blocks['mcu_relay_on']={init(){
  this.appendDummyInput()
    .appendField("relay ON — pin").appendField(new Blockly.FieldNumber(7,0,53),"PIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.relay);
}};
Blockly.Blocks['mcu_relay_off']={init(){
  this.appendDummyInput()
    .appendField("relay OFF — pin").appendField(new Blockly.FieldNumber(7,0,53),"PIN");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.relay);
}};

/* ── SERIAL READ STRING ──────────────────────────────────── */
Blockly.Blocks['mcu_serial_readstring']={init(){
  this.appendDummyInput()
    .appendField("var").appendField(new Blockly.FieldTextInput("str"),"VAR")
    .appendField("= Serial.readString()");
  this.setPreviousStatement(true);this.setNextStatement(true);
  this.setColour(C.serial);
}};

/* ── ULTRASONIC (HC-SR04) ───────────────────────────────── */
