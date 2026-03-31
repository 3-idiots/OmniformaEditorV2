const EXAMPLES={
blink:`<xml xmlns="https://developers.google.com/blockly/xml">
<block type="mcu_pin_setup" x="20" y="20"><field name="NAME">LED</field><field name="DIR">output</field><field name="NUM">13</field>
<next><block type="mcu_setup_block">
  <statement name="BODY"><block type="mcu_serial_begin"><field name="BAUD">9600</field>
    <next><block type="mcu_serial_println"><field name="VAL">"Blink start"</field></block></next>
  </block></statement>
<next><block type="mcu_forever">
  <statement name="BODY">
    <block type="mcu_digital_write"><field name="PIN">LED</field><field name="VAL">HIGH</field>
    <next><block type="mcu_delay"><field name="MS">500</field>
    <next><block type="mcu_digital_write"><field name="PIN">LED</field><field name="VAL">LOW</field>
    <next><block type="mcu_delay"><field name="MS">500</field></block></next>
    </block></next></block></next></block>
  </statement>
</block></next></block></next></block>
</xml>`,

sensor:`<xml xmlns="https://developers.google.com/blockly/xml">
<block type="mcu_import" x="20" y="20"><field name="LIB">serial</field>
<next><block type="mcu_pin_setup"><field name="NAME">LED</field><field name="DIR">output</field><field name="NUM">13</field>
<next><block type="mcu_setup_block">
  <statement name="BODY"><block type="mcu_serial_begin"><field name="BAUD">9600</field></block></statement>
<next><block type="mcu_forever">
  <statement name="BODY">
    <block type="mcu_analog_read"><field name="VAR">val</field><field name="CH">0</field>
    <next><block type="mcu_if_else">
      <value name="COND"><block type="mcu_compare"><field name="LEFT">val</field><field name="OP">&gt;</field><field name="RIGHT">500</field></block></value>
      <statement name="THEN"><block type="mcu_digital_write"><field name="PIN">LED</field><field name="VAL">HIGH</field>
        <next><block type="mcu_serial_println"><field name="VAL">val</field></block></next></block></statement>
      <statement name="ELSE"><block type="mcu_digital_write"><field name="PIN">LED</field><field name="VAL">LOW</field></block></statement>
      <next><block type="mcu_delay"><field name="MS">100</field></block></next>
    </block></next></block>
  </statement>
</block></next></block></next></block></next></block>
</xml>`,

servo:`<xml xmlns="https://developers.google.com/blockly/xml">
<block type="mcu_import" x="20" y="20"><field name="LIB">servo</field>
<next><block type="mcu_setup_block">
  <statement name="BODY"><block type="mcu_servo_attach"><field name="OBJ">myServo</field><field name="PIN">9</field>
    <next><block type="mcu_serial_begin"><field name="BAUD">9600</field></block></next></block></statement>
<next><block type="mcu_forever">
  <statement name="BODY">
    <block type="mcu_servo_write"><field name="OBJ">myServo</field><field name="ANGLE">0</field>
    <next><block type="mcu_delay"><field name="MS">500</field>
    <next><block type="mcu_servo_write"><field name="OBJ">myServo</field><field name="ANGLE">180</field>
    <next><block type="mcu_delay"><field name="MS">500</field></block></next>
    </block></next></block></next></block>
  </statement>
</block></next></block></next></block>
</xml>`,

traffic:`<xml xmlns="https://developers.google.com/blockly/xml">
<block type="mcu_pin_setup" x="20" y="20"><field name="NAME">RED</field><field name="DIR">output</field><field name="NUM">11</field>
<next><block type="mcu_pin_setup"><field name="NAME">YELLOW</field><field name="DIR">output</field><field name="NUM">12</field>
<next><block type="mcu_pin_setup"><field name="NAME">GREEN</field><field name="DIR">output</field><field name="NUM">13</field>
<next><block type="mcu_setup_block">
  <statement name="BODY"><block type="mcu_digital_write"><field name="PIN">RED</field><field name="VAL">LOW</field>
    <next><block type="mcu_digital_write"><field name="PIN">YELLOW</field><field name="VAL">LOW</field>
    <next><block type="mcu_digital_write"><field name="PIN">GREEN</field><field name="VAL">LOW</field></block></next></block></next>
  </block></statement>
<next><block type="mcu_forever">
  <statement name="BODY">
    <block type="mcu_digital_write"><field name="PIN">RED</field><field name="VAL">HIGH</field>
    <next><block type="mcu_delay"><field name="MS">3000</field>
    <next><block type="mcu_digital_write"><field name="PIN">RED</field><field name="VAL">LOW</field>
    <next><block type="mcu_digital_write"><field name="PIN">YELLOW</field><field name="VAL">HIGH</field>
    <next><block type="mcu_delay"><field name="MS">1000</field>
    <next><block type="mcu_digital_write"><field name="PIN">YELLOW</field><field name="VAL">LOW</field>
    <next><block type="mcu_digital_write"><field name="PIN">GREEN</field><field name="VAL">HIGH</field>
    <next><block type="mcu_delay"><field name="MS">3000</field>
    <next><block type="mcu_digital_write"><field name="PIN">GREEN</field><field name="VAL">LOW</field>
    </block></next></block></next></block></next></block></next></block></next></block></next></block></next></block></next></block>
  </statement>
</block></next></block></next></block></next></block>
</xml>`,

counter:`<xml xmlns="https://developers.google.com/blockly/xml">
<block type="mcu_import" x="20" y="20"><field name="LIB">serial</field>
<next><block type="mcu_pin_setup"><field name="NAME">LED</field><field name="DIR">output</field><field name="NUM">13</field>
<next><block type="mcu_setup_block">
  <statement name="BODY"><block type="mcu_serial_begin"><field name="BAUD">9600</field></block></statement>
<next><block type="mcu_forever">
  <statement name="BODY">
    <block type="mcu_set_var"><field name="NAME">count</field><field name="VAL">0</field>
    <next><block type="mcu_while">
      <value name="COND"><block type="mcu_compare"><field name="LEFT">count</field><field name="OP">&lt;</field><field name="RIGHT">10</field></block></value>
      <statement name="BODY">
        <block type="mcu_serial_println"><field name="VAL">count</field>
        <next><block type="mcu_change_var"><field name="NAME">count</field><field name="BY">1</field>
        <next><block type="mcu_digital_write"><field name="PIN">LED</field><field name="VAL">HIGH</field>
        <next><block type="mcu_delay"><field name="MS">200</field>
        <next><block type="mcu_digital_write"><field name="PIN">LED</field><field name="VAL">LOW</field>
        <next><block type="mcu_delay"><field name="MS">200</field>
        </block></next></block></next></block></next></block></next></block></next></block>
      </statement>
      <next><block type="mcu_delay"><field name="MS">2000</field></block></next>
    </block></next></block>
  </statement>
</block></next></block></next></block></next></block>
</xml>`
};

function loadExample(name){
  const ws=Blockly.getMainWorkspace();
  ws.clear();
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(EXAMPLES[name]),ws);
  if(currentMode==="text") setMode("blocks");
  setTimeout(compile,200);
  setStatus(`Loaded: ${name}`);
}


// ═══════════════════════════════════════════════════════════
//  BOARD DEFINITIONS
// ═══════════════════════════════════════════════════════════
