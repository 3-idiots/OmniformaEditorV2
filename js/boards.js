const BOARDS = {
  uno: {
    name:"Arduino Uno", mcu:"ATmega328P",
    flash:"32KB", ram:"2KB", freq:"16MHz",
    digital:14, analog:6,
    pwmPins:[3,5,6,9,10,11],
    nonPwmPins:[0,1,2,4,7,8,12,13],   // digital pins that cannot do PWM
    info:"14 digital · 6 analog · 6 PWM · 32KB flash",
    color:"#006BA6",
    svgW:260, svgH:110,
  },
  mega: {
    name:"Arduino Mega 2560", mcu:"ATmega2560",
    flash:"256KB", ram:"8KB", freq:"16MHz",
    digital:54, analog:16,
    pwmPins:[2,3,4,5,6,7,8,9,10,11,12,13,44,45,46],
    nonPwmPins:[0,1,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,
                30,31,32,33,34,35,36,37,38,39,40,41,42,43,47,48,49,50,51,52,53],
    info:"54 digital · 16 analog · 15 PWM · 256KB flash",
    color:"#006BA6",
    svgW:300, svgH:110,
  },
  nano: {
    name:"Arduino Nano", mcu:"ATmega328P",
    flash:"32KB", ram:"2KB", freq:"16MHz",
    digital:14, analog:8,
    pwmPins:[3,5,6,9,10,11],
    nonPwmPins:[0,1,2,4,7,8,12,13],
    info:"14 digital · 8 analog · 6 PWM · 32KB flash",
    color:"#1a6b3c",
    svgW:180, svgH:90,
  },
  esp32: {
    name:"ESP32 DevKit", mcu:"ESP32",
    flash:"4MB", ram:"520KB", freq:"240MHz",
    digital:30, analog:18,
    pwmPins:[0,2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33],
    nonPwmPins:[1,3,6,7,8,9,10,11,20,24,28,29,30,31],  // strapping/flash/input-only
    info:"30 digital · 18 analog · 20 PWM · 4MB flash · WiFi/BT",
    color:"#c0392b",
    svgW:240, svgH:110,
  },
  rp2040: {
    name:"Raspberry Pi Pico", mcu:"RP2040",
    flash:"2MB", ram:"264KB", freq:"133MHz",
    digital:26, analog:3,
    pwmPins:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],
    nonPwmPins:[23,24,25],   // GP23=SMPS, GP24=VBUS sense, GP25=LED (no PWM out)
    info:"26 GPIO · 3 analog · 16 PWM · 2MB flash · Dual-core",
    color:"#4caf50",
    svgW:200, svgH:90,
  },
  leonado: {
    name:"Arduino Leonardo", mcu:"ATmega32U4",
    flash:"32KB", ram:"2.5KB", freq:"16MHz",
    digital:20, analog:12,
    pwmPins:[3,5,6,9,10,11,13],
    nonPwmPins:[0,1,2,4,7,8,12,14,15,16,17,18,19],
    info:"20 digital · 12 analog · 7 PWM · USB HID",
    color:"#006BA6",
    svgW:240, svgH:110,
  },
};

let currentBoard = BOARDS.uno;
let currentBoardKey = "uno";

// ── board SVG renderer ────────────────────────────────────
function renderBoardSVG(boardKey) {
  const b = BOARDS[boardKey];
  const w = b.svgW, h = b.svgH;
  const bcol = b.color;

  // Simple PCB outline + pin headers
  let pins_top = "", pins_bot = "";
  const numD = Math.min(b.digital, 20);
  const pinSpacing = Math.min(12, (w - 20) / numD);
  const startX = 14;

  for (let i = 0; i < numD; i++) {
    const x = startX + i * pinSpacing;
    const isPWM = b.pwmPins.includes(i);
    const col = isPWM ? "#f0883e" : "#79c0ff";
    const pstate = simPins[i] ? (simPins[i].value === "HIGH" ? "#3fb950" : "#30363d") : "#30363d";
    pins_top += `<rect id="bpin-${i}" x="${x}" y="6" width="7" height="12" rx="1" fill="${pstate}" stroke="#444" stroke-width="0.5"/>`;
    if (i < 14) pins_bot += `<rect x="${x}" y="${h-18}" width="7" height="12" rx="1" fill="${i < b.analog ? '#f0883e' : '#30363d'}" stroke="#444" stroke-width="0.5"/>`;
  }

  const svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="${w-4}" height="${h-4}" rx="4" fill="#0d1f0d" stroke="${bcol}" stroke-width="1.5"/>
    <text x="${w/2}" y="${h/2-2}" text-anchor="middle" fill="${bcol}" font-size="9" font-weight="700" font-family="monospace">${b.name}</text>
    <text x="${w/2}" y="${h/2+9}" text-anchor="middle" fill="#555" font-size="7" font-family="monospace">${b.mcu} · ${b.freq}</text>
    <text x="${w/2}" y="${h/2+19}" text-anchor="middle" fill="#444" font-size="7" font-family="monospace">${b.flash} Flash · ${b.ram} RAM</text>
    <rect x="8" y="2" width="${(numD)*pinSpacing + 8}" height="20" rx="2" fill="#161b22" stroke="#30363d" stroke-width="0.5"/>
    ${pins_top}
    <rect x="8" y="${h-22}" width="${Math.min(b.analog+2,8)*pinSpacing + 8}" height="20" rx="2" fill="#161b22" stroke="#30363d" stroke-width="0.5"/>
    ${pins_bot}
    <text x="12" y="${h-24}" fill="#f0883e" font-size="7" font-family="monospace">ANALOG</text>
    <text x="12" y="4" fill="#79c0ff" font-size="7" font-family="monospace">DIGITAL</text>
    <circle cx="${w-14}" cy="14" r="5" fill="${simRunning ? '#3fb950' : '#30363d'}"/>
    <text x="${w-14}" y="17" text-anchor="middle" fill="#fff" font-size="5" font-weight="700">PWR</text>
  </svg>`;
  document.getElementById("board-svg-wrap").innerHTML = svg;
}

function selectBoard(key) {
  currentBoardKey = key;
  currentBoard = BOARDS[key];
  document.getElementById("board-info").textContent = currentBoard.info;
  initSimPins();
  renderPinTable();
  renderAnalogTable();
  renderBoardSVG(key);
}

// ═══════════════════════════════════════════════════════════
//  SIMULATOR STATE
// ═══════════════════════════════════════════════════════════
