(function initMonaco() {
  if (typeof monaco === 'undefined') {
    // Monaco not loaded yet — retry after a short delay
    setTimeout(initMonaco, 200);
    return;
  }

  // ── Arduino autocomplete data ───────────────────────────────
  // Each entry: { label, kind:'kw'|'fn'|'snip'|'const'|'type', sig, doc, insert, detail }
  const AC = [
    // ── Types / Memory qualifiers ──────────────────────────────
    {label:'int',           kind:'type', sig:'int',                     doc:'16-bit signed integer (-32768 to 32767)',                    insert:'int ${1:name} = ${2:0};'},
    {label:'unsigned int',  kind:'type', sig:'unsigned int',            doc:'16-bit unsigned integer (0 to 65535)',                       insert:'unsigned int ${1:name} = ${2:0};'},
    {label:'long',          kind:'type', sig:'long',                    doc:'32-bit signed integer (-2,147,483,648 to 2,147,483,647)',     insert:'long ${1:name} = ${2:0};'},
    {label:'unsigned long', kind:'type', sig:'unsigned long',           doc:'32-bit unsigned integer. Used with millis()/micros()',        insert:'unsigned long ${1:name} = ${2:0};'},
    {label:'float',         kind:'type', sig:'float',                   doc:'32-bit floating point number (6-7 decimal digits precision)', insert:'float ${1:name} = ${2:0.0};'},
    {label:'double',        kind:'type', sig:'double',                  doc:'Same as float on most Arduinos (32-bit)',                     insert:'double ${1:name} = ${2:0.0};'},
    {label:'bool',          kind:'type', sig:'bool',                    doc:'Boolean — true or false',                                    insert:'bool ${1:name} = ${2:false};'},
    {label:'char',          kind:'type', sig:'char',                    doc:'8-bit signed integer or ASCII character (-128 to 127)',       insert:'char ${1:name} = \'${2:A}\';'},
    {label:'byte',          kind:'type', sig:'byte',                    doc:'8-bit unsigned integer (0 to 255). Arduino-specific.',        insert:'byte ${1:name} = ${2:0};'},
    {label:'word',          kind:'type', sig:'word',                    doc:'16-bit unsigned integer — alias for unsigned int',            insert:'word ${1:name} = ${2:0};'},
    {label:'String',        kind:'type', sig:'String',                  doc:'Arduino String object (uses heap — prefer char[] for memory)', insert:'String ${1:name} = "${2:}";'},
    {label:'void',          kind:'type', sig:'void',                    doc:'No return value — used for functions that return nothing',     insert:'void'},
    // Memory qualifiers
    {label:'const',         kind:'kw',   sig:'const type name = val',   doc:'Constant — stored in flash, cannot be changed at runtime',    insert:'const ${1:int} ${2:NAME} = ${3:0};'},
    {label:'static',        kind:'kw',   sig:'static type name = val',  doc:'Persists between function calls — retains value',             insert:'static ${1:int} ${2:name} = ${3:0};'},
    {label:'volatile',      kind:'kw',   sig:'volatile type name',      doc:'Tells compiler variable can change at any time (use in ISRs)', insert:'volatile ${1:int} ${2:name} = ${3:0};'},
    {label:'PROGMEM',       kind:'kw',   sig:'const type name[] PROGMEM', doc:'Store constant data in flash instead of SRAM (saves RAM)',  insert:'const ${1:char} ${2:name}[] PROGMEM = ${3:{}};'},
    {label:'pgm_read_byte', kind:'fn',   sig:'pgm_read_byte(&arr[i])',  doc:'Read a byte from PROGMEM flash storage',                     insert:'pgm_read_byte(&${1:array}[${2:i}])'},
    {label:'pgm_read_word', kind:'fn',   sig:'pgm_read_word(&arr[i])',  doc:'Read a word (2 bytes) from PROGMEM flash storage',            insert:'pgm_read_word(&${1:array}[${2:i}])'},
    {label:'F',             kind:'fn',   sig:'F("string")',             doc:'Store string literal in flash — saves SRAM. Use with Serial.print(F("..."))', insert:'F("${1:text}")'},
    // ── Digital I/O ───────────────────────────────────────────
    {label:'pinMode',       kind:'fn',   sig:'pinMode(pin, mode)',       doc:'Set pin as INPUT, OUTPUT or INPUT_PULLUP',                   insert:'pinMode(${1:pin}, ${2:OUTPUT});'},
    {label:'digitalWrite',  kind:'fn',   sig:'digitalWrite(pin, value)', doc:'Write HIGH (1) or LOW (0) to a digital pin',                insert:'digitalWrite(${1:pin}, ${2:HIGH});'},
    {label:'digitalRead',   kind:'fn',   sig:'digitalRead(pin)',         doc:'Read digital pin — returns HIGH or LOW',                    insert:'digitalRead(${1:pin})'},
    {label:'analogWrite',   kind:'fn',   sig:'analogWrite(pin, 0-255)', doc:'PWM output — 0=off, 255=full on. Only on PWM pins (~)',       insert:'analogWrite(${1:pin}, ${2:128});'},
    {label:'analogRead',    kind:'fn',   sig:'analogRead(pin)',          doc:'Read analog pin — returns 0-1023 (10-bit ADC)',              insert:'analogRead(${1:A0})'},
    {label:'analogReference', kind:'fn', sig:'analogReference(type)',    doc:'Set ADC reference voltage: DEFAULT, INTERNAL, EXTERNAL',     insert:'analogReference(${1:DEFAULT});'},
    // ── Time ─────────────────────────────────────────────────
    {label:'delay',         kind:'fn',   sig:'delay(ms)',                doc:'Pause sketch for ms milliseconds. Blocks everything.',       insert:'delay(${1:1000});'},
    {label:'delayMicroseconds', kind:'fn', sig:'delayMicroseconds(us)', doc:'Pause for microseconds. Accurate for small values (<16383)', insert:'delayMicroseconds(${1:100});'},
    {label:'millis',        kind:'fn',   sig:'millis()',                 doc:'Returns unsigned long — ms since sketch started. Rolls over after ~50 days', insert:'millis()'},
    {label:'micros',        kind:'fn',   sig:'micros()',                 doc:'Returns unsigned long — microseconds since sketch started',  insert:'micros()'},
    // ── Math ─────────────────────────────────────────────────
    {label:'map',           kind:'fn',   sig:'map(val, fromL, fromH, toL, toH)', doc:'Re-map a number from one range to another',         insert:'map(${1:value}, ${2:0}, ${3:1023}, ${4:0}, ${5:255})'},
    {label:'constrain',     kind:'fn',   sig:'constrain(val, min, max)', doc:'Clamp a value between min and max',                         insert:'constrain(${1:value}, ${2:0}, ${3:255})'},
    {label:'abs',           kind:'fn',   sig:'abs(x)',                   doc:'Absolute value of x',                                       insert:'abs(${1:x})'},
    {label:'min',           kind:'fn',   sig:'min(a, b)',                doc:'Return the smaller of two values',                          insert:'min(${1:a}, ${2:b})'},
    {label:'max',           kind:'fn',   sig:'max(a, b)',                doc:'Return the larger of two values',                           insert:'max(${1:a}, ${2:b})'},
    {label:'pow',           kind:'fn',   sig:'pow(base, exponent)',      doc:'Raise base to exponent power — returns double',             insert:'pow(${1:base}, ${2:exp})'},
    {label:'sqrt',          kind:'fn',   sig:'sqrt(x)',                  doc:'Square root — returns double',                              insert:'sqrt(${1:x})'},
    {label:'random',        kind:'fn',   sig:'random(max) / random(min,max)', doc:'Random long between 0 and max-1',                    insert:'random(${1:100})'},
    {label:'randomSeed',    kind:'fn',   sig:'randomSeed(seed)',         doc:'Seed the random number generator (use analogRead(A0))',     insert:'randomSeed(${1:analogRead(A0)});'},
    // ── Serial ────────────────────────────────────────────────
    {label:'Serial.begin',  kind:'fn',   sig:'Serial.begin(baud)',       doc:'Start serial — common bauds: 9600, 115200',                 insert:'Serial.begin(${1:9600});'},
    {label:'Serial.print',  kind:'fn',   sig:'Serial.print(val)',        doc:'Print to serial monitor (no newline)',                      insert:'Serial.print(${1:value});'},
    {label:'Serial.println',kind:'fn',   sig:'Serial.println(val)',      doc:'Print to serial with newline',                             insert:'Serial.println(${1:value});'},
    {label:'Serial.available', kind:'fn',sig:'Serial.available()',       doc:'Returns number of bytes waiting to be read',               insert:'Serial.available()'},
    {label:'Serial.read',   kind:'fn',   sig:'Serial.read()',            doc:'Read one byte from serial buffer',                         insert:'Serial.read()'},
    {label:'Serial.readString', kind:'fn',sig:'Serial.readString()',     doc:'Read serial buffer as String (waits for timeout)',          insert:'Serial.readString()'},
    {label:'Serial.parseInt', kind:'fn', sig:'Serial.parseInt()',        doc:'Parse next integer from serial stream',                    insert:'Serial.parseInt()'},
    {label:'Serial.write',  kind:'fn',   sig:'Serial.write(val)',        doc:'Send raw byte to serial',                                  insert:'Serial.write(${1:value});'},
    {label:'Serial.flush',  kind:'fn',   sig:'Serial.flush()',           doc:'Wait for outgoing serial data to finish sending',          insert:'Serial.flush();'},
    {label:'Serial.end',    kind:'fn',   sig:'Serial.end()',             doc:'Disable serial port',                                      insert:'Serial.end();'},
    // ── Tone ─────────────────────────────────────────────────
    {label:'tone',          kind:'fn',   sig:'tone(pin, freq, duration?)', doc:'Generate square wave on pin. freq in Hz.',               insert:'tone(${1:pin}, ${2:440});'},
    {label:'noTone',        kind:'fn',   sig:'noTone(pin)',               doc:'Stop tone generation on pin',                             insert:'noTone(${1:pin});'},
    // ── Interrupts ───────────────────────────────────────────
    {label:'attachInterrupt', kind:'fn', sig:'attachInterrupt(digitalPinToInterrupt(pin), ISR, mode)', doc:'Attach ISR to pin. mode: RISING, FALLING, CHANGE, LOW', insert:'attachInterrupt(digitalPinToInterrupt(${1:pin}), ${2:isr}, ${3:RISING});'},
    {label:'detachInterrupt', kind:'fn', sig:'detachInterrupt(digitalPinToInterrupt(pin))', doc:'Remove interrupt from pin',             insert:'detachInterrupt(digitalPinToInterrupt(${1:pin}));'},
    {label:'interrupts',    kind:'fn',   sig:'interrupts()',              doc:'Re-enable interrupts (after noInterrupts())',              insert:'interrupts();'},
    {label:'noInterrupts',  kind:'fn',   sig:'noInterrupts()',            doc:'Disable interrupts — use sparingly in time-critical code', insert:'noInterrupts();'},
    {label:'pulseIn',       kind:'fn',   sig:'pulseIn(pin, value, timeout?)', doc:'Measure pulse length in microseconds',               insert:'pulseIn(${1:pin}, ${2:HIGH})'},
    // ── Wire / I2C ───────────────────────────────────────────
    {label:'Wire.begin',    kind:'fn',   sig:'Wire.begin()',              doc:'Initialize I2C as master. Call once in setup()',           insert:'Wire.begin();'},
    {label:'Wire.beginTransmission', kind:'fn', sig:'Wire.beginTransmission(address)', doc:'Begin I2C transmission to device address',  insert:'Wire.beginTransmission(${1:0x3C});'},
    {label:'Wire.write',    kind:'fn',   sig:'Wire.write(val)',           doc:'Queue byte for I2C transmission',                         insert:'Wire.write(${1:value});'},
    {label:'Wire.endTransmission', kind:'fn', sig:'Wire.endTransmission()', doc:'Transmit queued I2C bytes and stop',                   insert:'Wire.endTransmission();'},
    {label:'Wire.requestFrom', kind:'fn',sig:'Wire.requestFrom(addr, count)', doc:'Request bytes from I2C device',                     insert:'Wire.requestFrom(${1:0x3C}, ${2:1});'},
    {label:'Wire.available',kind:'fn',   sig:'Wire.available()',          doc:'Returns number of bytes available to read from I2C',      insert:'Wire.available()'},
    {label:'Wire.read',     kind:'fn',   sig:'Wire.read()',               doc:'Read one byte received from I2C device',                  insert:'Wire.read()'},
    // ── SPI ──────────────────────────────────────────────────
    {label:'SPI.begin',     kind:'fn',   sig:'SPI.begin()',               doc:'Initialize SPI bus',                                      insert:'SPI.begin();'},
    {label:'SPI.transfer',  kind:'fn',   sig:'SPI.transfer(val)',         doc:'Send and receive one byte over SPI',                      insert:'SPI.transfer(${1:0x00})'},
    {label:'SPI.end',       kind:'fn',   sig:'SPI.end()',                 doc:'Disable SPI bus',                                         insert:'SPI.end();'},
    // ── EEPROM ───────────────────────────────────────────────
    {label:'EEPROM.read',   kind:'fn',   sig:'EEPROM.read(address)',      doc:'Read one byte from EEPROM (0-255)',                       insert:'EEPROM.read(${1:0})'},
    {label:'EEPROM.write',  kind:'fn',   sig:'EEPROM.write(address, val)', doc:'Write one byte to EEPROM. Max 100,000 write cycles!',   insert:'EEPROM.write(${1:0}, ${2:value});'},
    {label:'EEPROM.update', kind:'fn',   sig:'EEPROM.update(address, val)', doc:'Write to EEPROM only if value changed — saves cycles', insert:'EEPROM.update(${1:0}, ${2:value});'},
    // ── Constants ────────────────────────────────────────────
    {label:'HIGH',          kind:'const',sig:'HIGH = 1',                  doc:'Digital HIGH — 5V (or 3.3V on 3.3V boards)',              insert:'HIGH'},
    {label:'LOW',           kind:'const',sig:'LOW = 0',                   doc:'Digital LOW — 0V (GND)',                                  insert:'LOW'},
    {label:'INPUT',         kind:'const',sig:'INPUT',                     doc:'Pin mode — floating input (no pull-up)',                   insert:'INPUT'},
    {label:'OUTPUT',        kind:'const',sig:'OUTPUT',                    doc:'Pin mode — driven output',                                insert:'OUTPUT'},
    {label:'INPUT_PULLUP',  kind:'const',sig:'INPUT_PULLUP',              doc:'Pin mode — input with internal pull-up resistor enabled', insert:'INPUT_PULLUP'},
    {label:'LED_BUILTIN',   kind:'const',sig:'LED_BUILTIN',               doc:'Pin number of the built-in LED (usually 13)',             insert:'LED_BUILTIN'},
    {label:'A0',kind:'const',sig:'A0',doc:'Analog pin 0',insert:'A0'},{label:'A1',kind:'const',sig:'A1',doc:'Analog pin 1',insert:'A1'},
    {label:'A2',kind:'const',sig:'A2',doc:'Analog pin 2',insert:'A2'},{label:'A3',kind:'const',sig:'A3',doc:'Analog pin 3',insert:'A3'},
    {label:'A4',kind:'const',sig:'A4',doc:'Analog pin 4 (SDA on Uno)',insert:'A4'},{label:'A5',kind:'const',sig:'A5',doc:'Analog pin 5 (SCL on Uno)',insert:'A5'},
    {label:'true',          kind:'const',sig:'true = 1',                  doc:'Boolean true',                                            insert:'true'},
    {label:'false',         kind:'const',sig:'false = 0',                 doc:'Boolean false',                                           insert:'false'},
    {label:'nullptr',       kind:'const',sig:'nullptr',                   doc:'Null pointer constant (C++11)',                           insert:'nullptr'},
    // ── Preprocessor ─────────────────────────────────────────
    {label:'#include',      kind:'kw',   sig:'#include <library.h>',      doc:'Include a library header file',                           insert:'#include <${1:library.h}>'},
    {label:'#define',       kind:'kw',   sig:'#define NAME value',        doc:'Define a macro constant — no type, no semicolon',         insert:'#define ${1:NAME} ${2:value}'},
    {label:'#ifdef',        kind:'kw',   sig:'#ifdef NAME',               doc:'Compile block only if NAME is defined',                    insert:'#ifdef ${1:NAME}\n$0\n#endif'},
    {label:'#ifndef',       kind:'kw',   sig:'#ifndef NAME',              doc:'Compile block only if NAME is NOT defined',                insert:'#ifndef ${1:NAME}\n#define ${1:NAME}\n$0\n#endif'},
    // ── Control flow snippets ─────────────────────────────────
    {label:'if',            kind:'snip', sig:'if (condition) { }',        doc:'If statement',                                            insert:'if (${1:condition}) {\n\t$0\n}'},
    {label:'ifelse',        kind:'snip', sig:'if/else',                   doc:'If / else statement',                                     insert:'if (${1:condition}) {\n\t$0\n} else {\n\t\n}'},
    {label:'for',           kind:'snip', sig:'for (int i=0; i<N; i++)',   doc:'For loop',                                                insert:'for (int ${1:i} = 0; ${1:i} < ${2:10}; ${1:i}++) {\n\t$0\n}'},
    {label:'while',         kind:'snip', sig:'while (condition) { }',     doc:'While loop',                                              insert:'while (${1:condition}) {\n\t$0\n}'},
    {label:'switch',        kind:'snip', sig:'switch (var) { case: }',    doc:'Switch statement',                                        insert:'switch (${1:var}) {\n\tcase ${2:0}:\n\t\t$0\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}'},
    {label:'setup',         kind:'snip', sig:'void setup() { }',          doc:'Arduino setup — runs once at startup',                    insert:'void setup() {\n\t$0\n}'},
    {label:'loop',          kind:'snip', sig:'void loop() { }',           doc:'Arduino loop — runs repeatedly forever',                  insert:'void loop() {\n\t$0\n}'},
    {label:'isr',           kind:'snip', sig:'void ISR_NAME() { }',       doc:'Interrupt Service Routine — keep it short and fast',      insert:'void ${1:isrName}() {\n\t$0\n}'},
    // ── GitHub library hint ───────────────────────────────────
    {label:'@lib',          kind:'snip', sig:'// @lib https://github.com/...', doc:'Install an unofficial library from GitHub during cloud compile', insert:'// @lib https://github.com/${1:user}/${2:repo}'},
  ];

  // Kind → Monaco CompletionItemKind mapping
  const CK = monaco.languages.CompletionItemKind;
  const kindMap = { kw:'Keyword', fn:'Function', snip:'Snippet', const:'Constant', type:'Class' };

  // ── Dot-triggered member completions ──────────────────────
  const DOT_MEMBERS = {
    Serial:  ['begin','print','println','available','read','readString','parseInt','write','flush','end'],
    Wire:    ['begin','beginTransmission','write','endTransmission','requestFrom','available','read'],
    SPI:     ['begin','transfer','end','beginTransaction','endTransaction'],
    EEPROM:  ['read','write','update','get','put','length'],
    Servo:   ['attach','write','read','detach','writeMicroseconds','readMicroseconds','attached'],
  };

  // ── Scan user code for declared variables/functions ────────
  function getUserSymbols(model) {
    const code = model.getValue();
    const symbols = [];
    const seen = new Set();
    // Function definitions: void foo() / int bar(
    const fnRe = /^(?:void|int|float|bool|char|byte|long|unsigned\s+\w+|String)\s+(\w+)\s*\(/mg;
    let m;
    while ((m = fnRe.exec(code)) !== null) {
      if (!seen.has(m[1])) { seen.add(m[1]); symbols.push({ label:m[1], kind:'fn', sig:m[1]+'()', doc:'User-defined function', insert:m[1]+'($0)' }); }
    }
    // Variable declarations: int foo = / float bar;
    const varRe = /^(?:const\s+)?(?:int|float|double|bool|char|byte|long|unsigned\s+\w+|String|word)\s+(\w+)\s*[=;(,]/mg;
    while ((m = varRe.exec(code)) !== null) {
      if (!seen.has(m[1])) { seen.add(m[1]); symbols.push({ label:m[1], kind:'kw', sig:m[1], doc:'User variable', insert:m[1] }); }
    }
    // #define macros
    const defRe = /^#define\s+(\w+)/mg;
    while ((m = defRe.exec(code)) !== null) {
      if (!seen.has(m[1])) { seen.add(m[1]); symbols.push({ label:m[1], kind:'const', sig:'#define '+m[1], doc:'User macro', insert:m[1] }); }
    }
    return symbols;
  }

  // ── Main completion provider ───────────────────────────────
  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['.', '#', '<'],
    provideCompletionItems: (model, position) => {
      const word     = model.getWordUntilPosition(position);
      const line     = model.getLineContent(position.lineNumber);
      const charBefore = line[position.column - 2] || '';
      const range    = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };

      const Snip = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

      // ── Dot completion (Serial., Wire., etc.) ─────────────
      if (charBefore === '.') {
        const objMatch = line.slice(0, position.column - 2).match(/(\w+)$/);
        if (objMatch && DOT_MEMBERS[objMatch[1]]) {
          return {
            suggestions: DOT_MEMBERS[objMatch[1]].map(m => ({
              label: m, kind: CK.Method,
              detail: objMatch[1] + '.' + m + '()',
              insertText: m + '($0);', insertTextRules: Snip,
              range,
            }))
          };
        }
      }

      // ── #include <  completion ─────────────────────────────
      if (line.trim().startsWith('#include')) {
        const libs = [
          'Arduino.h','Wire.h','SPI.h','EEPROM.h','Servo.h','Stepper.h',
          'SoftwareSerial.h','LiquidCrystal.h','LiquidCrystal_I2C.h',
          'Adafruit_SSD1306.h','Adafruit_GFX.h','Adafruit_NeoPixel.h',
          'DHT.h','FastLED.h','IRremote.h','NewPing.h','RTClib.h',
          'OneWire.h','DallasTemperature.h','TM1637Display.h',
          'HX711.h','MFRC522.h','PubSubClient.h','ArduinoJson.h',
          'MPU6050.h','AccelStepper.h','Keypad.h','Encoder.h',
          'SD.h','avr/pgmspace.h',
        ];
        return {
          suggestions: libs.map(l => ({
            label: l, kind: CK.Module,
            detail: 'Library header',
            insertText: l, range,
          }))
        };
      }

      // ── General completions: builtins + user symbols ───────
      const userSyms = getUserSymbols(model);
      const all = [...AC, ...userSyms];

      return {
        suggestions: all.map(s => {
          const isSnip = s.kind === 'snip' || (s.insert && s.insert.includes('$'));
          return {
            label:           s.label,
            kind:            CK[kindMap[s.kind] || 'Function'],
            detail:          s.sig || s.label,
            documentation:   { value: '**' + (s.sig || s.label) + '**\n\n' + (s.doc || '') },
            insertText:      s.insert || s.label,
            insertTextRules: isSnip ? Snip : 0,
            range,
            sortText:        (s.kind === 'snip' ? '0' : s.kind === 'fn' ? '1' : '2') + s.label,
          };
        })
      };
    }
  });

  // ── Hover provider — show docs on hover ───────────────────
  monaco.languages.registerHoverProvider('cpp', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const w = word.word;
      // Check full "Obj.method" by looking at surrounding context
      const line = model.getLineContent(position.lineNumber);
      const col  = position.column - 1;
      // Try "Serial.println" style
      let fullMatch = null;
      for (const s of AC) {
        if (s.label === w || s.label.endsWith('.' + w)) {
          fullMatch = s; break;
        }
      }
      if (!fullMatch) return null;
      return {
        contents: [
          { value: '```cpp\n' + fullMatch.sig + '\n```' },
          { value: fullMatch.doc },
        ]
      };
    }
  });

  // Create editor
  const container = document.getElementById('monaco-container');
  const hiddenTA = document.getElementById('mcu-editor');

  const initialCode = `#include <Arduino.h>

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}`;

  window.monacoEditor = monaco.editor.create(container, {
    value: initialCode,
    language: 'cpp',
    theme: 'vs-dark',
    fontSize: 13.5,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
    fontLigatures: true,
    lineHeight: 22,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 4,
    insertSpaces: true,
    wordWrap: 'off',
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'always',
    bracketPairColorization: { enabled: true },
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    suggestOnTriggerCharacters: true,
    quickSuggestions: { other: true, comments: false, strings: false },
    parameterHints: { enabled: true },
    formatOnPaste: true,
    multiCursorModifier: 'alt',   // Alt+Click for multi-cursor
    occurrencesHighlight: true,
    renderWhitespace: 'selection',
    padding: { top: 12, bottom: 12 },
    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  });

  // Sync Monaco → hidden textarea so all legacy code still works
  function syncToTextarea() {
    hiddenTA.value = window.monacoEditor.getValue();
  }
  window.monacoEditor.onDidChangeModelContent(syncToTextarea);
  syncToTextarea();

  // Sync textarea → Monaco (for code written by legacy functions)
  const origDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  Object.defineProperty(hiddenTA, 'value', {
    get() { return window.monacoEditor ? window.monacoEditor.getValue() : origDescriptor.get.call(this); },
    set(v) {
      if (window.monacoEditor) {
        const cur = window.monacoEditor.getValue();
        if (cur !== v) {
          window.monacoEditor.setValue(v || '');
        }
      }
      origDescriptor.set.call(this, v || '');
    },
    configurable: true,
  });

  // Keybindings
  window.monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => editorCompileAndRun());
  window.monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => editorToggleComment());
  window.monacoEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => editorFormat());

  // Override editor functions to use Monaco APIs
  // ── Format ──
  window.editorFormat = function() {
    if (!window.monacoEditor) return;
    window.monacoEditor.getAction('editor.action.formatDocument')?.run() ||
      window.monacoEditor.trigger('keyboard', 'editor.action.formatDocument', {});
    setBadge('idle', 'Formatted');
  };

  // ── Toggle comment ──
  window.editorToggleComment = function() {
    if (!window.monacoEditor) return;
    window.monacoEditor.trigger('keyboard', 'editor.action.commentLine', {});
  };

  // ── Insert snippet ──
  window.editorInsertSnippet = function(key) {
    if (!window.monacoEditor) return;
    const snippets = {
      setup: 'void setup() {\n\t\n}',
      loop:  'void loop() {\n\t\n}',
    };
    const text = snippets[key];
    if (!text) return;
    const sel = window.monacoEditor.getSelection();
    window.monacoEditor.executeEdits('snippet', [{ range: sel, text }]);
    window.monacoEditor.focus();
  };

  // ── cppInsert ──
  window.cppInsert = function(type) {
    if (!window.monacoEditor) return;
    const snips = {
      dw:  'digitalWrite(${1:pin}, ${2:HIGH});',
      dr:  'int ${1:val} = digitalRead(${2:pin});',
      ser: 'Serial.println(${1:value});',
      for: 'for (int ${1:i} = 0; ${1:i} < ${2:10}; ${1:i}++) {\n\t$0\n}',
      if:  'if (${1:condition}) {\n\t$0\n}',
      var: '${1:int} ${2:name} = ${3:0};',
    };
    const snippet = snips[type];
    if (!snippet) return;
    const sel = window.monacoEditor.getSelection();
    window.monacoEditor.trigger('keyboard', 'editor.action.insertSnippet', { snippet });
    window.monacoEditor.focus();
  };

  // ── Error markers ──
  window.setMonacoErrors = function(errors) {
    if (!window.monacoEditor) return;
    const model = window.monacoEditor.getModel();
    if (!model) return;
    const markers = errors.map(e => ({
      severity: monaco.MarkerSeverity.Error,
      startLineNumber: e.line || 1, endLineNumber: e.line || 1,
      startColumn: e.col || 1, endColumn: e.endCol || 100,
      message: e.message,
      source: 'Arduino',
    }));
    monaco.editor.setModelMarkers(model, 'arduino', markers);
  };
  window.clearMonacoErrors = function() {
    if (!window.monacoEditor) return;
    const model = window.monacoEditor.getModel();
    if (model) monaco.editor.setModelMarkers(model, 'arduino', []);
  };

  // ── Status bar cursor position ──
  window.monacoEditor.onDidChangeCursorPosition(e => {
    const el = document.getElementById('cursor-pos');
    if (el) el.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
  });

  // ── Focus Monaco when text editor pane shown ──
  const obs = new MutationObserver(() => {
    const pane = document.getElementById('text-editor-pane');
    if (pane && pane.style.display !== 'none' && window.monacoEditor) {
      setTimeout(() => { window.monacoEditor.layout(); window.monacoEditor.focus(); }, 50);
    }
  });
  const pane = document.getElementById('text-editor-pane');
  if (pane) obs.observe(pane, { attributes: true, attributeFilter: ['style'] });

  console.log('[Monaco] Editor initialized');
})();
