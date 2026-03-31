// ═══════════════════════════════════════════════════════════
//  COLOURS
// ═══════════════════════════════════════════════════════════
const C = {
  setup:"#9C27B0", loop:"#2196F3", io:"#4CAF50",
  ctrl:"#FF9800", logic:"#607D8B", serial:"#F44336",
  servo:"#E91E63", lcd:"#009688", dht:"#FF5722", buzz:"#795548",
  ultra:"#1565C0", oled:"#1a1a6e", ir:"#4a1a6a", pir:"#2a4a1a",
  neo:"#1a1a5a", rgb:"#6a2a00", stepper:"#2a1a4a",
  i2c:"#1a3a5c", spi:"#1a2a4a", keypad:"#2a1a4a",
  rtc:"#1a2a1a", tm:"#1a3a2a", ds18:"#6a1f1f",
  relay:"#3a1a00", btn:"#2a3a00", soil:"#1a3a1a",
  sound:"#3a1a3a", ldr:"#4a4a1a",
};

// ═══════════════════════════════════════════════════════════
//  HELPER
// ═══════════════════════════════════════════════════════════
function pinConst(raw) {
  if (raw===null||raw===undefined) return "PIN_PIN";
  const s = String(raw).trim().replace(/_PIN$/i,"").toUpperCase()||"PIN";
  return (/^\d/.test(s)?"P"+s:s)+"_PIN";
}

// ═══════════════════════════════════════════════════════════
//  BLOCK DEFINITIONS
// ═══════════════════════════════════════════════════════════

/* ── SETUP CATEGORY ─────────────────────────────────────── */
