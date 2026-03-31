# ⬡ Omniforma Editor V2<sub> by 3-idiots</sub>

> **A browser-based Arduino C++ IDE built to motivate beginners to learn and engage in coding — rather than copy-pasting.**

Omniforma Editor V2 is a free, open-source, zero-install web IDE for Arduino development. It combines a visual drag-and-drop block editor with a full Monaco-powered C++ code editor, a live hardware simulator, and a real serial monitor — all running entirely in the browser. No downloads. No setup. Just open and start building.

> 🔗 **Previous version:** [Omniforma Editor V1](https://github.com/3-idiots/Omniforma-editor) — the original MicroPython-based editor that started it all.

---
## Demos

[V1 Demo](https://3-idiots.github.io/Omniforma-editor/)   
[V2 Demo](https://3-idiots.github.io/OmniformaEditorV2/)

---

## 🆕 What's New in V2

V2 is a significant rewrite over [V1](https://github.com/3-idiots/Omniforma-editor), shifting focus from MicroPython to Arduino C++ as the primary target and replacing several internal systems with more capable ones.

| Area | V1 | V2 |
|---|---|---|
| **Target language** | MicroPython + Arduino C++ (dual) | Arduino C++ (primary focus) |
| **Code editor** | Custom textarea with line-number gutter | Full **Monaco Editor** (VS Code engine) — syntax highlighting, IntelliSense-style shortcuts, Ctrl+Enter to run, Ctrl+/ to comment |
| **Compile pipeline** | 4-stage: MicroPython → C++ → ASM → HEX (educational) | Direct Blocks → C++ with real **cloud compile** via render server |
| **Real compilation** | Educational/approximated HEX output | True GCC compilation via **[omniforma-deploy2.onrender.com](https://omniforma-deploy2.onrender.com)** — produces a genuine flashable `.hex` |
| **Hardware upload** | Not supported | **Browser-based upload** via `arduino-web-uploader` — flash directly from the browser |
| **Real Serial Monitor** | Not present | Full **Web Serial API** monitor — connect a physical Arduino over USB, send/receive live data |
| **File management** | No file save/load | New / Open / Save workflow with **Google Drive integration** — browse, open, and save `.ino` files to your Drive |
| **Sketch naming** | No named files | Named sketches with unsaved-changes indicator |
| **Simulator extras** | Basic pin table | Added **Components tab** (auto-detects LCD, Servo, NeoPixel from code), **analog wave generator**, board SVG visual |
| **Editor toolbar** | Minimal | Quick-insert snippet buttons (`setup()`, `loop()`, `for`, `if`, `digitalWrite`, `serial`, etc.) |
| **Panel layout** | Fixed panels | All panels independently **collapsible and drag-resizable** |

### ☁️ Render Server
Cloud compile is powered by the Omniforma render server:

```
https://omniforma-deploy2.onrender.com
```

Paste this URL into the **Render server URL** field in the top bar, then hit **Compile & Upload** to send your sketch for real GCC compilation. The server returns a genuine `.hex` file that can be flashed to your board.

> **Note:** The render server is hosted on Render's free tier and may take ~30 seconds to wake up on first use.

---

## 🎯 Purpose

Too many beginners get stuck in a cycle of copy-pasting Arduino code without ever truly understanding what it does. Omniforma Editor was created to break that cycle.

By pairing a visual block editor with instant, readable C++ output, learners can *see* exactly what code their blocks generate — building genuine understanding one block at a time. The goal isn't just to make Arduino easier; it's to make learning Arduino actually stick.

---

## ✨ Features

### 🧩 Dual Editor Modes
- **Blocks Mode** — drag-and-drop Blockly-powered visual programming with categorized Arduino blocks
- **Arduino C++ Mode** — full Monaco Editor (the engine behind VS Code) with syntax highlighting, auto-formatting, snippet insertion, and inline error display

### ⚡ Live Code Generation
Blocks instantly compile to clean, readable Arduino C++ in the output panel — so beginners always see the real code behind their visuals

### 🖥️ Built-in Simulator
Simulate your Arduino sketch directly in the browser without any hardware:
- Digital & analog pin state visualization
- Board SVG visual (Uno, Mega, Nano, ESP32, RP2040, Leonardo)
- Serial Monitor with baud rate control, timestamps, and quick-send presets
- Analog wave generator (Sine, Triangle, Square, Sawtooth, Noise)
- Component detection tab (LCD, Servo, NeoPixel, etc.)
- Adjustable simulation speed (1x, 2x, 5x, 20x)

### 📡 Real Serial Monitor
Connect a physical Arduino over USB using the Web Serial API:
- Live RX/TX byte tracking
- Adjustable baud rate & line endings
- Auto-scroll, timestamps, and export

### ☁️ Cloud Compile & Upload
Point the editor to the render server (`https://omniforma-deploy2.onrender.com`) to compile via real GCC and get a genuine `.hex` file back — then flash it to your board directly from the browser using the built-in uploader

### 💾 File Management
- New / Open / Save sketch workflow
- Download as `.ino` or `.hex`
- Google Drive integration — sign in to browse, open, and save files directly to your Drive

### 🔌 Board Support
| Board | Flash | Digital Pins | Analog Pins |
|---|---|---|---|
| Arduino Uno (ATmega328P) | 32KB | 14 | 6 |
| Arduino Mega 2560 | 256KB | 54 | 16 |
| Arduino Nano | 32KB | 14 | 8 |
| ESP32 DevKit | 4MB | 34 | 18 |
| Raspberry Pi Pico (RP2040) | 2MB | 26 | 3 |
| Arduino Leonardo | 32KB | 20 | 12 |

### 🧱 Block Library
A rich, organized block toolbox covering:

| Category | What's included |
|---|---|
| 🏗 Program | `setup()`, `loop()`, functions, pin declarations, imports |
| 🔀 Flow Control | if/else, for, while, break, continue, return |
| 📊 Variables & Math | variables, math ops, map, constrain, comparisons, logic |
| ⏱ Timing | delay, delayMicroseconds, millis |
| ⚡ Digital I/O | digitalRead/Write, analogRead/Write, pulseIn, buttons, relays |
| 📡 Serial | Serial.begin, print, println, read, available |
| 🔭 Sensors | DHT, HC-SR04 Ultrasonic, DS18B20, IR, PIR, Soil, Sound, LDR |
| 🖥 Displays | I2C LCD, OLED (SSD1306), 7-Segment (TM1637) |
| ⚙ Actuators | Servo, Stepper, Buzzer/Tone |
| 💡 Lights | NeoPixel/WS2812, RGB LED |
| 📶 Communication | I2C (Wire), SPI, 4x4 Keypad, RTC (DS3231) |

---

## 📁 File Structure

```
OmniformaEditorV2/
│
├── index.html                    # Main entry point (modular version)
├── OmniformaEditorV2-oneFile.html # Self-contained single-file version
│
├── css/
│   ├── base.css                  # CSS variables, resets, global tokens
│   ├── layout.css                # Top bar, main grid, pane layout
│   ├── panels.css                # Output panel and tab styles
│   ├── simulator.css             # Simulator panel and component UI
│   ├── editor.css                # Monaco editor toolbar and containers
│   └── modal.css                 # All modal dialogs (open, save, new file)
│
└── js/
    ├── colours.js                # Block colour palette definitions
    ├── blocks-core.js            # Core block definitions (program, flow, math, I/O)
    ├── blocks-sensors.js         # Sensor block definitions
    ├── blocks-displays.js        # Display block definitions (LCD, OLED, 7-seg)
    ├── blocks-actuators.js       # Actuator block definitions (servo, stepper, buzzer)
    ├── serializer.js             # Blockly workspace save/load
    ├── emitter-micropython.js    # MicroPython code emitter (legacy/alt target)
    ├── emitter-cpp.js            # Arduino C++ code generator from blocks
    ├── compiler.js               # Compile pipeline and error handling
    ├── validator.js              # Block and code validation
    ├── ui.js                     # UI state, toasts, mode switching
    ├── examples.js               # Example sketches
    ├── boards.js                 # Board definitions and pin specs
    ├── simulator-core.js         # Simulator execution engine
    ├── simulator-ui.js           # Simulator rendering and pin tables
    ├── serial-monitor.js         # In-browser simulated serial monitor
    ├── serial-monitor-real.js    # Real serial monitor (Web Serial API)
    ├── panel-resize.js           # Drag-to-resize panel handles
    ├── init.js                   # App bootstrap and event wiring
    ├── cloud-compile.js          # Cloud compile & upload integration
    ├── monaco-editor.js          # Monaco editor setup and keybindings
    └── gdrive.js                 # Google Drive sign-in, browse, open, save
```

---

## 🚀 Getting Started

No installation required. Just open `index.html` in a modern browser (Chrome recommended for Web Serial support).

```bash
git clone https://github.com/3-idiots/OmniformaEditorV2.git
cd OmniformaEditorV2
# Open index.html in your browser — that's it!
```

Or use the single-file version for maximum portability:
```
OmniformaEditorV2-oneFile.html   ← open this anywhere, no dependencies
```

> **Tip:** For cloud compile and real serial monitor features, use Google Chrome or Edge (browsers that support the Web Serial API).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Block Editor | [Blockly](https://developers.google.com/blockly) |
| Code Editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) v0.44 |
| Hardware Upload | [arduino-web-uploader](https://github.com/dbuezas/arduino-web-uploader) |
| Real Serial | Web Serial API (browser-native) |
| Cloud Storage | Google Drive REST API |
| Compile Backend | [omniforma-deploy2.onrender.com](https://omniforma-deploy2.onrender.com) (real GCC via render server) |
| Frontend | Vanilla HTML, CSS, JavaScript — zero frameworks |

---

## 👥 Made By

**3 idiots** — built with curiosity, caffeine, and a genuine belief that anyone can learn to code if given the right tools.

---

## 📄 License

This project is open source. Feel free to fork, learn from, and contribute — just don't copy-paste without understanding it first. 😄
