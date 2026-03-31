// ── Config ───────────────────────────────────────────────────
// Set your OAuth 2.0 Client ID here.
// In Google Cloud Console → Credentials → OAuth Client ID → Web App
// Authorized JavaScript Origins: https://YOUR-NAME.github.io  +  http://localhost:PORT
const GDRIVE_CLIENT_ID = '337575549549-p9vek22d99eheu9pijhqmpnvn2jjq115.apps.googleusercontent.com';
// drive.file   = only files created by THIS app (causes 403 on existing files)
// drive        = full access — needed to save files opened from Drive
const GDRIVE_SCOPES    = 'https://www.googleapis.com/auth/drive';
const OMNI_FOLDER_NAME = 'omniforma-editor';

// ── Auth state ───────────────────────────────────────────────
let _token       = null;   // access token string
let _tokenExpiry = 0;
let _gisReady    = false;
let _tokenClient = null;
let _gisCallback = null;   // called after token obtained

// ── Restore cached sign-in from localStorage ─────────────────
(function _restoreCachedAuth() {
  try {
    const cached = localStorage.getItem('omni_gdrive_token');
    if (!cached) return;
    const obj = JSON.parse(cached);
    if (obj && obj.token && obj.expiry && Date.now() < obj.expiry) {
      _token       = obj.token;
      _tokenExpiry = obj.expiry;
      // Restore UI
      window.addEventListener('DOMContentLoaded', () => {
        _restoreUserChip(obj.name, obj.picture);
      });
      // Also try immediately if DOM already ready
      if (document.readyState !== 'loading') _restoreUserChip(obj.name, obj.picture);
    } else {
      localStorage.removeItem('omni_gdrive_token');
    }
  } catch(e) {}
})();

function _restoreUserChip(name, picture) {
  const chip = document.getElementById('google-user-chip');
  const btn  = document.getElementById('btn-google-signin');
  if (!chip || !btn) return;
  chip.style.display = 'flex';
  btn.style.display  = 'none';
  document.getElementById('google-user-name').textContent = name || 'Google';
  const av = document.getElementById('google-user-avatar');
  if (picture) { av.src = picture; av.style.display = ''; }
  else av.style.display = 'none';
}

// ── File state ───────────────────────────────────────────────
let _currentFile = {
  name:      'untitled.ino',
  driveId:   null,   // Drive file id if opened/saved from Drive
  saved:     true,   // false = unsaved changes
};
let _omniFolderId = null;  // cached omniforma-editor folder id

// ── Browser state ────────────────────────────────────────────
let _folderStack  = [];    // [{id, name}]  navigation history
let _currentItems = [];    // current listing
let _selectedItem = null;  // {id, name, isFolder}
let _searchTimer  = null;
let _modalMode    = 'open'; // 'open' | 'save'

// ═══════════════════════════════════════════════════════════
//  GIS — load lazily on first use
// ═══════════════════════════════════════════════════════════
function _loadGIS(callback) {
  _gisCallback = callback;
  if (_gisReady) { callback(); return; }
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.onerror = () => showToast('✗ Could not load Google Sign-In', 'error');
  s.onload  = () => {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CLIENT_ID,
      scope:     GDRIVE_SCOPES,
      callback:  _onToken,
    });
    _gisReady = true;
    callback();
  };
  document.head.appendChild(s);
}

function _onToken(resp) {
  if (resp.error) { showToast('✗ Sign-in failed: ' + resp.error, 'error'); return; }
  _token       = resp.access_token;
  _tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
  // Fetch user info
  fetch('https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: 'Bearer ' + _token } })
  .then(r => r.json()).then(u => {
    const chip = document.getElementById('google-user-chip');
    const btn  = document.getElementById('btn-google-signin');
    chip.style.display = 'flex';
    btn.style.display  = 'none';
    document.getElementById('google-user-name').textContent = u.name || u.email || 'Google';
    const av = document.getElementById('google-user-avatar');
    if (u.picture) { av.src = u.picture; av.style.display = ''; } else av.style.display = 'none';
    showToast('✓ Signed in as ' + (u.name || u.email), 'ok');
    // ── Cache token + user info in localStorage ──────────────
    try {
      localStorage.setItem('omni_gdrive_token', JSON.stringify({
        token:   _token,
        expiry:  _tokenExpiry,
        name:    u.name || u.email || 'Google',
        picture: u.picture || '',
      }));
    } catch(e) {}
  }).catch(() => {});
  // Run pending action
  if (_gisCallback) { const cb = _gisCallback; _gisCallback = null; cb(); }
}

function _ensureToken(then) {
  if (GDRIVE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
    showToast('⚙ Not configured', 'warn', 'Replace GDRIVE_CLIENT_ID in the HTML file with your OAuth Client ID.');
    return;
  }
  if (_token && Date.now() < _tokenExpiry) { then(); return; }
  _loadGIS(() => {
    _gisCallback = then;
    _tokenClient.requestAccessToken({ prompt: _token ? '' : 'consent' });
  });
}

// ── Drive API helpers ─────────────────────────────────────────
function _driveGET(path, params = {}) {
  const url = 'https://www.googleapis.com/drive/v3/' + path
    + '?' + Object.entries(params).map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
  return fetch(url, { headers: { Authorization: 'Bearer ' + _token } })
    .then(r => { if (!r.ok) throw new Error('Drive ' + r.status); return r.json(); });
}
function _drivePOST(path, body, params = {}) {
  const url = 'https://www.googleapis.com/drive/v3/' + path
    + '?' + Object.entries(params).map(([k,v]) => k + '=' + encodeURIComponent(v)).join('&');
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + _token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.error?.message || 'Drive POST ' + r.status); });
    return r.json();
  });
}
// ── Create a NEW file (POST multipart upload) ─────────────────
function _driveCreateFile(name, folderId, content) {
  const boundary = 'omni_mp_' + Date.now();
  const meta = JSON.stringify({ name, mimeType: 'text/plain', parents: [folderId] });
  const body = '--' + boundary + '\r\n'
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + meta + '\r\n'
    + '--' + boundary + '\r\n'
    + 'Content-Type: text/plain; charset=UTF-8\r\n\r\n'
    + content + '\r\n'
    + '--' + boundary + '--';
  return fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + _token,
        'Content-Type': 'multipart/related; boundary=' + boundary,
      },
      body,
    }
  ).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.error?.message || 'Create ' + r.status); });
    return r.json();
  });
}

// ── Update an EXISTING file's content (PATCH media upload) ────
// Note: parents cannot be changed via PATCH — name only
function _driveUpdateFile(fileId, name, content) {
  const boundary = 'omni_mp_' + Date.now();
  const meta = JSON.stringify({ name });
  const body = '--' + boundary + '\r\n'
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + meta + '\r\n'
    + '--' + boundary + '\r\n'
    + 'Content-Type: text/plain; charset=UTF-8\r\n\r\n'
    + content + '\r\n'
    + '--' + boundary + '--';
  return fetch(
    'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=multipart&fields=id,name',
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + _token,
        'Content-Type': 'multipart/related; boundary=' + boundary,
      },
      body,
    }
  ).then(r => {
    if (!r.ok) return r.json().then(e => { throw new Error(e.error?.message || 'Update ' + r.status); });
    return r.json();
  });
}

// ═══════════════════════════════════════════════════════════
//  omniforma-editor folder — auto-create on first save/open
// ═══════════════════════════════════════════════════════════
async function _ensureOmniFolder() {
  if (_omniFolderId) return _omniFolderId;
  // Search for existing folder
  const q = "name = '" + OMNI_FOLDER_NAME + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
  const data = await _driveGET('files', {
    q, fields: 'files(id,name)', pageSize: '1'
  });
  if (data.files && data.files.length) {
    _omniFolderId = data.files[0].id;
    return _omniFolderId;
  }
  // Create it
  const folder = await _drivePOST('files', {
    name: OMNI_FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
  }, { fields: 'id' });
  _omniFolderId = folder.id;
  showToast('📁 Created folder: omniforma-editor on Drive', 'ok');
  return _omniFolderId;
}

// ═══════════════════════════════════════════════════════════
//  UNSAVED INDICATOR (VS Code style)
// ═══════════════════════════════════════════════════════════
function _setFilename(name) {
  _currentFile.name = name || 'untitled.ino';
  const el = document.getElementById('current-filename');
  if (el) el.textContent = _currentFile.name;
}
function _markUnsaved() {
  _currentFile.saved = false;
  const dot = document.getElementById('unsaved-dot');
  if (dot) dot.classList.add('visible');
}
function _markSaved() {
  _currentFile.saved = true;
  const dot = document.getElementById('unsaved-dot');
  if (dot) dot.classList.remove('visible');
}

// Hook into Monaco content changes
window.addEventListener('load', () => {
  setTimeout(() => {
    if (window.monacoEditor) {
      window.monacoEditor.onDidChangeModelContent(() => {
        if (_currentFile.saved) _markUnsaved();
      });
    }
  }, 1500);
});

// ═══════════════════════════════════════════════════════════
//  NEW FILE
// ═══════════════════════════════════════════════════════════
function newFile() {
  document.getElementById('new-file-name').value = 'sketch';
  document.getElementById('new-file-modal').classList.add('open');
  setTimeout(() => { const i = document.getElementById('new-file-name'); i.focus(); i.select(); }, 60);
}
function closeNewFileModal() { document.getElementById('new-file-modal').classList.remove('open'); }
function confirmNewFile() {
  let name = (document.getElementById('new-file-name').value || 'sketch').trim().replace(/\.ino$/i, '');
  if (!name) name = 'sketch';
  closeNewFileModal();
  const code =
`#include <Arduino.h>

// ${name}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("${name} ready!");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}`;
  _loadCode(code, name + '.ino', null);
  if (typeof setMode === 'function') setMode('text');
  showToast('✓ New sketch: ' + name, 'ok');
}

// ═══════════════════════════════════════════════════════════
//  OPEN FILE
// ═══════════════════════════════════════════════════════════
function openFileChooser() {
  document.getElementById('open-source-modal').classList.add('open');
}
function closeOpenSourceModal() { document.getElementById('open-source-modal').classList.remove('open'); }

function openFromComputer() {
  closeOpenSourceModal();
  document.getElementById('local-file-input').click();
}
function localFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => { _loadCode(ev.target.result, file.name, null); showToast('✓ Opened: ' + file.name, 'ok'); };
  r.onerror = () => showToast('✗ Could not read file', 'error');
  r.readAsText(file);
  e.target.value = '';
}

function openFromDrive() {
  closeOpenSourceModal();
  _ensureToken(() => {
    _modalMode = 'open';
    _openBrowser();
  });
}

// ═══════════════════════════════════════════════════════════
//  SAVE FILE
// ═══════════════════════════════════════════════════════════
function saveFile() {
  // If not signed in → prompt sign in first
  if (!_token || Date.now() >= _tokenExpiry) {
    _ensureToken(() => _showSaveModal());
    return;
  }
  _showSaveModal();
}
function _showSaveModal() {
  const inp = document.getElementById('save-filename-input');
  inp.value = _currentFile.name || 'sketch.ino';
  document.getElementById('save-modal-overlay').classList.add('open');
  setTimeout(() => { inp.focus(); inp.select(); }, 60);
}
function closeSaveModal() { document.getElementById('save-modal-overlay').classList.remove('open'); }

async function confirmSaveToDrive() {
  let name = (document.getElementById('save-filename-input').value || 'sketch.ino').trim();
  if (!name.includes('.')) name += '.ino';
  closeSaveModal();

  const code = window.monacoEditor
    ? window.monacoEditor.getValue()
    : (document.getElementById('mcu-editor') || {}).value || '';

  showToast('💾 Saving to Drive…', 'ok');
  try {
    const saved = await _saveToDrive(name, code);
    _currentFile.driveId = saved.id;
    _setFilename(name);
    _markSaved();
    showToast('✓ Saved to Drive: ' + name, 'ok');
  } catch(err) {
    showToast('✗ Save failed', 'error', err.message);
  }
}

// Quick Ctrl+S — saves directly if we already have a Drive id, else shows modal
async function _quickSave() {
  if (!_token || Date.now() >= _tokenExpiry) { _ensureToken(_quickSave); return; }
  if (!_currentFile.driveId) { _showSaveModal(); return; }
  const code = window.monacoEditor
    ? window.monacoEditor.getValue()
    : (document.getElementById('mcu-editor') || {}).value || '';
  try {
    const saved = await _saveToDrive(_currentFile.name, code);
    _currentFile.driveId = saved.id;
    _markSaved();
    showToast('✓ Saved: ' + _currentFile.name, 'ok');
  } catch(err) {
    showToast('✗ Save failed', 'error', err.message);
  }
}

// ── Core save logic — update if owned, copy if not ───────────
// Handles "insufficient permissions" by saving as a new file in
// omniforma-editor instead of failing.
async function _saveToDriver_checkOwnership(fileId) {
  try {
    // Check if we can get the file's capabilities
    const data = await _driveGET('files/' + fileId, {
      fields: 'capabilities(canEdit),ownedByMe'
    });
    return data.ownedByMe === true || (data.capabilities && data.capabilities.canEdit === true);
  } catch(e) {
    return false;
  }
}

async function _saveToDrive(name, code) {
  if (_currentFile.driveId) {
    // Check ownership/edit rights before attempting update
    const canEdit = await _saveToDriver_checkOwnership(_currentFile.driveId);
    if (canEdit) {
      try {
        return await _driveUpdateFile(_currentFile.driveId, name, code);
      } catch(err) {
        // If update still fails with permission error, fall through to create copy
        const isPermErr = err.message.toLowerCase().includes('permission')
          || err.message.toLowerCase().includes('403')
          || err.message.toLowerCase().includes('forbidden');
        if (!isPermErr) throw err;
        // Fall through to create a new copy
        showToast('⚠ No write access — saving as new copy', 'warn');
      }
    } else {
      showToast('⚠ File is read-only — saving as new copy in omniforma-editor', 'warn');
    }
    // Clear the old id so we create a fresh file
    _currentFile.driveId = null;
  }
  // Create new file in omniforma-editor folder
  const folderId = await _ensureOmniFolder();
  return await _driveCreateFile(name, folderId, code);
}

// ═══════════════════════════════════════════════════════════
//  DRIVE FILE/FOLDER BROWSER
// ═══════════════════════════════════════════════════════════
function _openBrowser() {
  _folderStack  = [{ id: 'root', name: 'My Drive' }];
  _selectedItem = null;
  document.getElementById('gdrive-open-btn').disabled = true;
  document.getElementById('gdrive-search-input').value = '';
  document.getElementById('gdrive-modal-overlay').classList.add('open');
  _renderBreadcrumb();
  _fetchFolder('root');
}

function gdriveModalClose(e) {
  if (e.target === document.getElementById('gdrive-modal-overlay')) gdriveModalDismiss();
}
function gdriveModalDismiss() {
  document.getElementById('gdrive-modal-overlay').classList.remove('open');
}
function gdriveRefresh() {
  document.getElementById('gdrive-search-input').value = '';
  _fetchFolder(_folderStack[_folderStack.length - 1].id);
}
function gdriveNavUp() {
  if (_folderStack.length <= 1) return;
  _folderStack.pop();
  _renderBreadcrumb();
  _fetchFolder(_folderStack[_folderStack.length - 1].id);
}
function gdriveDebouncedSearch(val) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => gdriveFetchFolder(), 380);
}
function gdriveFetchFolder() {
  _fetchFolder(_folderStack[_folderStack.length - 1].id,
    document.getElementById('gdrive-search-input').value.trim());
}

async function _fetchFolder(folderId, searchQuery = '') {
  const list   = document.getElementById('gdrive-file-list');
  const status = document.getElementById('gdrive-status-bar');
  list.innerHTML = '<div style="padding:32px;text-align:center;color:#6a6a6a;font-size:12px;">🔄 Loading…</div>';
  status.textContent = 'Fetching…';
  _selectedItem = null;
  document.getElementById('gdrive-open-btn').disabled = true;
  document.getElementById('gdrive-btn-up').disabled = _folderStack.length <= 1;

  try {
    let q = "trashed = false and '" + folderId + "' in parents";
    if (searchQuery) {
      q = "trashed = false and name contains '" + searchQuery.replace(/'/g,"\\'") + "'";
    }
    const data = await _driveGET('files', {
      q,
      fields: 'files(id,name,mimeType,modifiedTime,size)',
      orderBy: 'folder,name',
      pageSize: '200',
    });
    _currentItems = data.files || [];
    status.textContent = _currentItems.length + ' item' + (_currentItems.length !== 1 ? 's' : '');
    _renderList(_currentItems);
    // Update footer path
    document.getElementById('gdrive-footer-left').textContent =
      _folderStack.map(f => f.name).join(' › ');
  } catch(err) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:#f44747;font-size:12px;">✗ ' + _esc(err.message) + '</div>';
    status.textContent = 'Error';
  }
}

function _renderList(items) {
  const list = document.getElementById('gdrive-file-list');
  if (!items.length) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:#6a6a6a;font-size:12px;">Empty folder</div>';
    return;
  }
  list.innerHTML = '';
  for (const f of items) {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    const isOmni   = isFolder && f.name === OMNI_FOLDER_NAME;
    const ext = (f.name.match(/\.(\w+)$/) || ['',''])[1].toLowerCase();
    const icon = isFolder ? '📁' : ext === 'ino' ? '⬡' : ext === 'cpp' || ext === 'c' ? '🔷' : ext === 'h' ? '📎' : '📄';
    const date = f.modifiedTime
      ? new Date(f.modifiedTime).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
      : '';
    const isCode = !isFolder && ['ino','cpp','c','h','txt'].includes(ext);

    const div = document.createElement('div');
    div.className = 'gdrive-item' + (isFolder ? ' folder-item' : '') + (isOmni ? ' gdrive-omni-folder' : '');
    div.innerHTML =
      '<span class="gi-icon">' + icon + '</span>' +
      '<span class="gi-name">' + _esc(f.name) + '</span>' +
      (isOmni ? '<span class="gi-badge">omniforma</span>' : '') +
      '<span class="gi-meta">' + date + '</span>';

    div.onclick = () => _selectItem(div, f, isFolder, isCode);
    if (isFolder) {
      div.ondblclick = () => _enterFolder(f);
    } else if (isCode) {
      div.ondblclick = () => { _selectItem(div, f, false, true); gdriveOpenSelected(); };
    }
    list.appendChild(div);
  }
}

function _selectItem(el, f, isFolder, isCode) {
  document.querySelectorAll('.gdrive-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
  _selectedItem = { id: f.id, name: f.name, isFolder };
  const openBtn = document.getElementById('gdrive-open-btn');
  openBtn.disabled = isFolder ? false : !isCode;
  openBtn.textContent = isFolder ? '📂 Open Folder' : 'Open';
  document.getElementById('gdrive-status-bar').textContent = 'Selected: ' + f.name;
}

function _enterFolder(f) {
  _folderStack.push({ id: f.id, name: f.name });
  _renderBreadcrumb();
  document.getElementById('gdrive-search-input').value = '';
  _fetchFolder(f.id);
}

function _renderBreadcrumb() {
  const bc = document.getElementById('gdrive-breadcrumb');
  bc.innerHTML = '';
  _folderStack.forEach((crumb, i) => {
    const span = document.createElement('span');
    const isLast = i === _folderStack.length - 1;
    span.className = 'gdrive-crumb' + (isLast ? ' current' : '');
    span.textContent = crumb.name;
    if (!isLast) {
      span.onclick = () => {
        _folderStack = _folderStack.slice(0, i + 1);
        _renderBreadcrumb();
        _fetchFolder(crumb.id);
      };
    }
    bc.appendChild(span);
    if (!isLast) {
      const sep = document.createElement('span');
      sep.className = 'gdrive-crumb-sep';
      sep.textContent = '›';
      bc.appendChild(sep);
    }
  });
  document.getElementById('gdrive-btn-up').disabled = _folderStack.length <= 1;
}

async function gdriveOpenSelected() {
  if (!_selectedItem) return;
  if (_selectedItem.isFolder) { _enterFolder(_selectedItem); return; }

  const status = document.getElementById('gdrive-status-bar');
  const openBtn = document.getElementById('gdrive-open-btn');
  status.textContent = '⏳ Downloading ' + _selectedItem.name + '…';
  openBtn.disabled = true;

  try {
    const r = await fetch(
      'https://www.googleapis.com/drive/v3/files/' + _selectedItem.id + '?alt=media',
      { headers: { Authorization: 'Bearer ' + _token } }
    );
    if (!r.ok) throw new Error('Download failed ' + r.status);
    const content = await r.text();
    gdriveModalDismiss();
    _loadCode(content, _selectedItem.name, _selectedItem.id);
    showToast('✓ Opened from Drive: ' + _selectedItem.name, 'ok');
  } catch(err) {
    status.textContent = '✗ ' + err.message;
    openBtn.disabled = false;
    showToast('✗ Download failed', 'error', err.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  SHARED HELPERS
// ═══════════════════════════════════════════════════════════
function _loadCode(content, filename, driveId) {
  if (window.monacoEditor) {
    window.monacoEditor.setValue(content);
    window.monacoEditor.setScrollPosition({ scrollTop: 0 });
  } else {
    const ta = document.getElementById('mcu-editor');
    if (ta) ta.value = content;
  }
  _currentFile.driveId = driveId || null;
  _setFilename(filename);
  _markSaved();
  if (typeof setMode === 'function') setMode('text');
  if (typeof setStatus === 'function') setStatus('Opened: ' + filename);
}
function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Sign-in / sign-out buttons
function gdriveSignIn() { _ensureToken(() => showToast('✓ Already signed in', 'ok')); }
function gdriveSignOut() {
  try { localStorage.removeItem('omni_gdrive_token'); } catch(e) {}
  if (!_token) {
    document.getElementById('google-user-chip').style.display = 'none';
    document.getElementById('btn-google-signin').style.display = '';
    return;
  }
  if (window.google && window.google.accounts) {
    google.accounts.oauth2.revoke(_token, () => {});
  }
  _token = null; _tokenExpiry = 0;
  document.getElementById('google-user-chip').style.display = 'none';
  document.getElementById('btn-google-signin').style.display = '';
  showToast('Signed out from Google', 'ok');
}

// ── Keyboard shortcuts ─────────────────────────────────────
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'n') { e.preventDefault(); newFile(); }
  if (mod && e.key === 'o') { e.preventDefault(); openFileChooser(); }
  if (mod && e.key === 's') { e.preventDefault(); _quickSave(); }
  if (e.key === 'Escape') {
    ['new-file-modal','open-source-modal','gdrive-modal-overlay','save-modal-overlay']
      .forEach(id => document.getElementById(id).classList.remove('open'));
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('new-file-name');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') confirmNewFile(); });
  const si = document.getElementById('save-filename-input');
  if (si) si.addEventListener('keydown', e => { if (e.key === 'Enter') confirmSaveToDrive(); });
  _setFilename('untitled.ino');
});
