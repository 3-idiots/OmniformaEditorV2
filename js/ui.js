function setMode(m){
  if (m === currentMode) return;

  if (m === "text" && currentMode === "blocks") {
    const blocks = workspaceToBlocks();
    if (blocks.length > 0) {
      _openModal("text",
        "Switch to Arduino C++ Text Editor?",
        "Your block workspace will be <strong>converted to Arduino C++</strong> and loaded into the text editor.",
        "⚠️ The block workspace will be cleared. Switching back to Blocks will reset it — your text edits will not be preserved as blocks.",
        "Cancel — Keep Blocks",
        "Yes, Switch to Text Editor"
      );
      return;
    }
  }

  if (m === "blocks" && currentMode === "text") {
    const src = document.getElementById("mcu-editor").value.trim();
    if (src.length > 0) {
      _openModal("blocks",
        "Switch back to Block Editor?",
        "Your <strong>Arduino C++ code will be discarded</strong> and the block workspace will be restored to its default state.",
        "⚠️ Any code written in the text editor cannot be automatically converted back to blocks and will be lost.",
        "Cancel — Keep C++ Code",
        "Yes, Switch to Blocks"
      );
      return;
    }
  }

  _applyMode(m);
}

let _pendingMode = null;
function _openModal(targetMode, title, desc, note, cancelLabel, confirmLabel) {
  _pendingMode = targetMode;
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-desc").innerHTML = desc;
  document.getElementById("modal-note").textContent = note;
  document.getElementById("mode-modal-overlay").querySelector(".modal-btn-cancel").textContent = cancelLabel;
  document.getElementById("modal-confirm-btn").textContent = confirmLabel;
  document.getElementById("mode-modal-overlay").classList.add("open");
}

function _applyMode(m) {
  currentMode = m;
  document.getElementById("btn-blocks").classList.toggle("active", m === "blocks");
  document.getElementById("btn-text").classList.toggle("active", m === "text");
  document.getElementById("blockly-div").style.display = m === "blocks" ? "block" : "none";
  document.getElementById("text-editor-pane").style.display = m === "text" ? "flex" : "none";

  if (m === "text") {
    // Auto-hide the output panel when entering text editor —
    // it just mirrors what you're typing so it's redundant.
    // Record whether WE collapsed it so we can restore it when going back.
    _outputWasCollapsedByModeSwitch = false;
    if (!viewCollapsed) {
      toggleViewPanel();
      _outputWasCollapsedByModeSwitch = true;
    }
    // Expand sim panel for more room when coding
    const sp = document.getElementById('sim-panel');
    if (sp && !simCollapsed) {
      _simWidthBeforeTextMode = sp.offsetWidth;
      sp.style.width = Math.min(420, window.innerWidth * 0.3) + 'px';
    }

    try {
      const blocks = workspaceToBlocks();
      if (blocks.length) {
        const cpp = blocksToCpp(blocks);
        if (cpp.trim()) {
          document.getElementById("mcu-editor").value = cpp;
          editorUpdateLineNumbers();
        }
      }
    } catch(e) {}
    document.getElementById("mcu-editor").focus();
    editorUpdateLineNumbers();
    updateCursor();
    setBadge("idle", "Not compiled");
    setStatus("Arduino C++ editor active — Ctrl+Enter to compile & upload");
  }

  if (m === "blocks") {
    // Only restore output panel if we were the ones who hid it
    if (viewCollapsed && _outputWasCollapsedByModeSwitch) toggleViewPanel();
    _outputWasCollapsedByModeSwitch = false;
    // Restore sim panel width
    const sp = document.getElementById('sim-panel');
    if (sp && !simCollapsed && _simWidthBeforeTextMode) {
      sp.style.width = _simWidthBeforeTextMode + 'px';
      _simWidthBeforeTextMode = 0;
    }
    document.getElementById("mcu-editor").value = "";
    placeStarterBlocks();
    setTimeout(() => { if (typeof Blockly !== "undefined") Blockly.svgResize(workspace); }, 50);
    setStatus("Block editor active");
  }
}

// Modal handlers
function modalCancel(e) {
  if (e && e.target !== document.getElementById("mode-modal-overlay")) return;
  _pendingMode = null;
  document.getElementById("mode-modal-overlay").classList.remove("open");
}
function modalConfirm() {
  document.getElementById("mode-modal-overlay").classList.remove("open");
  const target = _pendingMode;
  _pendingMode = null;

  // If switching back to blocks, close any open Drive/local file
  if (target === "blocks") {
    _currentFile.driveId = null;
    _currentFile.saved   = true;
    _setFilename('untitled.ino');
    _markSaved();
  }

  _applyMode(target);
}

// ── Enhanced text editor ──────────────────────────────────
function editorUpdateLineNumbers() {
  // Monaco handles line numbers natively — no-op
}

function updateCursor() {
  // Monaco cursor position is tracked via onDidChangeCursorPosition — no-op
}

function setBadge(type, msg) {
  const b = document.getElementById("compile-status-badge");
  if (!b) return;
  b.textContent = msg;
  b.className = "compile-status-badge " + (type === "ok" ? "csb-ok" : type === "err" ? "csb-err" : "csb-idle");
}

function editorShowError(msg) {
  const bar = document.getElementById("editor-error-bar");
  if (!bar) return;
  if (msg) { bar.textContent = "⚠ " + msg; bar.style.display = "block"; }
  else { bar.style.display = "none"; }
}

function editorCompileAndRun() {
  editorShowError(null);
  try {
    // In Arduino C++ mode — set editor content as cpp output and compile
    const editorCode = document.getElementById("mcu-editor").value;
    document.getElementById("out-cpp").innerHTML = highlightCPP(editorCode);
    showTab("cpp");
    // Stop sim and rebuild immediately from editor code (no cloud needed for simulation)
    if (simRunning) {
      simRunning = false;
      clearInterval(simTimer);
      const btn = document.getElementById("btn-sim-run");
      if (btn) { btn.textContent = "▶ Run"; btn.classList.remove("running"); }
    }
    simStmtQueue = [];
    initSimPins();
    buildSimProgram(editorCode);
    applyInputPullupDefaults(editorCode);
    renderPinTable();
    renderAnalogTable();
    renderBoardSVG(currentBoardKey);
    setBadge("ok", "✓ Ready to simulate");
    // Also send to cloud compile for real validation
    doCloudCompile();
  } catch(e) {
    setBadge("err", "Error");
    editorShowError(e.message);
  }
}

function editorFormat() {
  const ed = document.getElementById("mcu-editor");
  if (!ed) return;
  const lines = ed.value.split("\n");
  const out = [];
  let indent = 0;
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { out.push(""); continue; }
    // dedent before else/elif/except/finally
    if (/^(else:|elif |except|finally:)/.test(trimmed)) indent = Math.max(0, indent - 1);
    out.push("    ".repeat(indent) + trimmed);
    // indent after : (def/if/else/for/while/with)
    if (trimmed.endsWith(":") && !trimmed.startsWith("#")) indent++;
    // dedent after return/break/continue/pass at current level
    if (/^(return|break|continue|pass)\b/.test(trimmed)) indent = Math.max(0, indent - 1);
  }
  ed.value = out.join("\n");
  editorUpdateLineNumbers();
  updateCursor();
  setStatus("Formatted");
}

function editorToggleComment() {
  const ed = document.getElementById("mcu-editor");
  if (!ed) return;
  const start = ed.selectionStart, end = ed.selectionEnd;
  const val = ed.value;
  // Find line boundaries
  const lineStart = val.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = val.indexOf("\n", end);
  const actualEnd = lineEnd === -1 ? val.length : lineEnd;
  const selectedLines = val.slice(lineStart, actualEnd).split("\n");
  const allCommented = selectedLines.every(l => l.trim().startsWith("#"));
  const toggled = selectedLines.map(l => {
    if (allCommented) return l.replace(/^(\s*)#\s?/, "$1");
    return l.replace(/^(\s*)/, "$1# ");
  });
  ed.value = val.slice(0, lineStart) + toggled.join("\n") + val.slice(actualEnd);
  ed.selectionStart = lineStart;
  ed.selectionEnd = lineStart + toggled.join("\n").length;
  editorUpdateLineNumbers();
}

const SNIPPETS = {
  setup: `def setup():\n    uart = UART(0, baudrate=9600)\n    print("Ready")\n`,
  loop:  `def loop():\n    pass\n`,
  dw:    `led_pin.value(1)   # HIGH\nled_pin.value(0)   # LOW\n`,
  dr:    `state = button_pin.value()  # reads 0 or 1\n`,
  ser:   `print("hello")          # → Serial via REPL\nuart.write("hello\\n")  # → UART TX\n`,
};

function editorInsertSnippet(key) {
  const ed = document.getElementById("mcu-editor");
  if (!ed) return;
  const snip = SNIPPETS[key] || "";
  const s = ed.selectionStart;
  ed.value = ed.value.slice(0, s) + snip + ed.value.slice(ed.selectionEnd);
  ed.selectionStart = ed.selectionEnd = s + snip.length;
  ed.focus();
  editorUpdateLineNumbers();
  updateCursor();
}

// ── C++ specific snippet inserter ──────────────────────────
function cppInsert(type) {
  const ed = document.getElementById('mcu-editor');
  if (!ed) return;
  const pos = ed.selectionStart;
  const snippets = {
    dw:  'digitalWrite(13, HIGH);',
    dr:  'int val = digitalRead(2);',
    ser: 'Serial.println("hello");',
    for: 'for (int i = 0; i < 10; i++) {\n  \n}',
    if:  'if (condition) {\n  \n}',
    var: 'int myVar = 0;',
  };
  const snip = snippets[type] || '';
  const before = ed.value.slice(0, pos);
  const after  = ed.value.slice(pos);
  ed.value = before + snip + after;
  ed.selectionStart = ed.selectionEnd = pos + snip.length;
  ed.focus();
  editorUpdateLineNumbers();
}

function clearAll(){
  document.getElementById("mcu-editor").value="";
  
  document.getElementById("out-cpp").innerHTML="";
  document.getElementById("out-hex").innerHTML="";
  placeStarterBlocks();
  setStatus("Cleared — setup() and loop() blocks restored");
}
function downloadINO() {
  // Generate the Arduino .ino file (same as C++ output)
  let cpp;
  try {
    if (currentMode === "text") {
      const src = document.getElementById("mcu-editor").value;
      cpp = mcuSourceToCpp(src);
    } else {
      const blocks = workspaceToBlocks();
      if (!blocks.length) { setStatus("No blocks to export","error"); return; }
      cpp = blocksToCpp(blocks);
    }
  } catch(e) { setStatus("Export error: "+e.message,"error"); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([cpp], {type:"text/plain"}));
  a.download = "sketch.ino"; a.click();
  setStatus("Downloaded sketch.ino");
}

function downloadPY() {
  // .py = MicroPython source code file
  let mcu;
  try {
    if (currentMode === "text") {
      mcu = document.getElementById("mcu-editor").value;
    } else {
      const blocks = workspaceToBlocks();
      if (!blocks.length) { setStatus("No blocks to export","error"); return; }
      mcu = blocksToMCU(blocks);
    }
    if (!mcu || !mcu.trim()) { setStatus("Nothing to save","error"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([mcu], {type:"text/plain"}));
    a.download = "sketch.py"; a.click();
    setStatus("Downloaded sketch.py (MicroPython source)");
  } catch(e) { setStatus("Export error: "+e.message,"error"); }
}

function downloadHex(){
  if(!window.realHex){ setStatus("Compile first to get real HEX","error"); return; }
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([window.realHex],{type:"text/plain"}));
  a.download="sketch.hex"; a.click();
  setStatus("Downloaded sketch.hex");
}

// ── Text editor event listeners ───────────────────────────
// Legacy textarea reference — Monaco takes over all editor interactions.
// The hidden textarea is kept only for getValue/setValue via the overridden .value property.
// Live compile on Monaco content change (debounced)
let _monacoCompileTimer = null;
document.addEventListener('DOMContentLoaded', () => {
  // Wire live compile once Monaco is ready
  function wireMonacoLiveCompile() {
    if (!window.monacoEditor) { setTimeout(wireMonacoLiveCompile, 300); return; }
    window.monacoEditor.onDidChangeModelContent(() => {
      clearTimeout(_monacoCompileTimer);
      _monacoCompileTimer = setTimeout(() => {
        if (currentMode === "text" && window.monacoEditor.getValue().trim()) {
          try { compile(); setBadge("ok","Compiled OK"); editorShowError(null); }
          catch(err) { setBadge("err","Error"); editorShowError(err.message); }
        }
      }, 999999999); // disabled — use Ctrl+Enter to compile
    });
  }
  wireMonacoLiveCompile();
});

// Escape key closes modal
document.addEventListener("keydown", e=>{
  if(e.key==="Escape") document.getElementById("mode-modal-overlay").classList.remove("open");
});

// ═══════════════════════════════════════════════════════════
//  EXAMPLES
// ═══════════════════════════════════════════════════════════
