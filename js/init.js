const workspace=Blockly.inject("blockly-div",{
  toolbox:document.getElementById("toolbox"),
  theme: Blockly.Theme.defineTheme('mcuDark', {
    base: Blockly.Themes.Dark,
    componentStyles: {
      workspaceBackgroundColour: '#0d1117',
      toolboxBackgroundColour:   '#010409',
      toolboxForegroundColour:   '#c9d1d9',
      flyoutBackgroundColour:    '#0d1117',
      flyoutForegroundColour:    '#c9d1d9',
      flyoutOpacity:             0.97,
      scrollbarColour:           '#21262d',
      scrollbarOpacity:          0.8,
      insertionMarkerColour:     '#e94560',
      insertionMarkerOpacity:    0.5,
      markerColour:              '#e94560',
      cursorColour:              '#e94560',
    },
    blockStyles: {
      logic_blocks:    { colourPrimary:'#1a3a5c', colourSecondary:'#0d2137', colourTertiary:'#2d6db5' },
      loop_blocks:     { colourPrimary:'#1a4a2e', colourSecondary:'#0d2a1a', colourTertiary:'#1d9e75' },
      math_blocks:     { colourPrimary:'#2a2a0d', colourSecondary:'#1a1a07', colourTertiary:'#ba7517' },
      text_blocks:     { colourPrimary:'#1a0d2e', colourSecondary:'#0d0719', colourTertiary:'#7f77dd' },
      variable_blocks: { colourPrimary:'#2e1a0d', colourSecondary:'#1a0d07', colourTertiary:'#d85a30' },
      procedure_blocks:{ colourPrimary:'#1a0d1a', colourSecondary:'#0d070d', colourTertiary:'#d4537e' },
    },
    categoryStyles: {
      setup_cat:  { colour:'#7f77dd' },
      loop_cat:   { colour:'#1d9e75' },
      io_cat:     { colour:'#1d9e75' },
      ctrl_cat:   { colour:'#ba7517' },
      logic_cat:  { colour:'#5f5e5a' },
      serial_cat: { colour:'#a32d2d' },
      servo_cat:  { colour:'#993556' },
      lcd_cat:    { colour:'#0f6e56' },
      dht_cat:    { colour:'#993c1d' },
      buzz_cat:   { colour:'#633806' },
      ultra_cat:  { colour:'#1565C0' },
      oled_cat:   { colour:'#1a1a6e' },
      ir_cat:     { colour:'#4a1a6a' },
      neo_cat:    { colour:'#1a1a5a' },
      sensors_cat:{ colour:'#7B3F00' },
      displays_cat:{ colour:'#085041' },
      actuators_cat:{ colour:'#4a1a4a' },
      lights_cat: { colour:'#4a4a00' },
      comms_cat:  { colour:'#1a3a5c' },
    },
    fontStyle: {
      family: 'Courier New, monospace',
      weight: '600',
      size:   11,
    },
  }),
  grid:{spacing:20,length:3,colour:"#1e2a3a",snap:true},
  zoom:{controls:true,wheel:true,startScale:0.9,maxScale:3,minScale:0.3,scaleSpeed:1.2},
  trashcan:true, scrollbars:true, sounds:false,
});

let compileTimer;
workspace.addChangeListener(()=>{
  if(currentMode!=="blocks") return;
  clearTimeout(compileTimer);
  compileTimer=setTimeout(compile,700);
});

// Auto-place setup + loop blocks on fresh workspace
function placeStarterBlocks() {
  const ws = Blockly.getMainWorkspace();
  ws.clear();
  const xml = `<xml xmlns="https://developers.google.com/blockly/xml">
    <block type="mcu_setup_block" x="40" y="40">
      <statement name="BODY"></statement>
    </block>
    <block type="mcu_forever" x="40" y="160">
      <statement name="BODY"></statement>
    </block>
  </xml>`;
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), ws);
}

// Override loadExample to always start with fresh starter blocks if needed
const _origLoadExample = loadExample;
function loadExample(name) {
  _origLoadExample(name);
}

// On first load: place starter blocks, don't auto-load blink
setTimeout(() => {
  placeStarterBlocks();
  selectBoard("uno");
  setStatus("Ready — setup() and loop() blocks added. Drag blocks inside them, then click Run in the Simulator.");
}, 400);
