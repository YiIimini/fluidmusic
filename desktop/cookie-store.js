// ============================================================
// FluidMusic — Secure Cookie Store (macOS Keychain)
// Encrypts cookies at rest using Electron safeStorage
// Falls back to plaintext if encryption unavailable (headless)
// ============================================================
const path = require('path');
const fs = require('fs');

let _cookieDir = null;
function getCookieDir() {
  if (_cookieDir) return _cookieDir;
  try {
    const { app } = require('electron');
    _cookieDir = app.getPath('userData');
  } catch (_) {
    _cookieDir = path.join(__dirname, '..');
  }
  return _cookieDir;
}

function cookieFilePath(platform) {
  const suffix = platform === 'qq' ? 'qq-cookie.enc' : 'cookie.enc';
  return path.join(getCookieDir(), suffix);
}

function legacyCookieFilePath(platform) {
  const suffix = platform === 'qq' ? '.qq-cookie' : '.cookie';
  return path.join(__dirname, '..', suffix);
}

function isEncryptionAvailable() {
  try {
    const { safeStorage } = require('electron');
    return safeStorage.isEncryptionAvailable();
  } catch (_) { return false; }
}

function encryptString(text) {
  const { safeStorage } = require('electron');
  return safeStorage.encryptString(text);
}

function decryptString(buffer) {
  const { safeStorage } = require('electron');
  return safeStorage.decryptString(buffer);
}

/**
 * Save a cookie securely — encrypts with Keychain if available
 */
function saveCookie(platform, cookieText) {
  if (!cookieText) return;
  try {
    if (isEncryptionAvailable()) {
      const encrypted = encryptString(cookieText);
      fs.writeFileSync(cookieFilePath(platform), encrypted);
      console.log('[SecureCookie] Encrypted ' + platform + ' cookie saved (' + cookieText.length + ' bytes)');
    } else {
      // Fallback: plaintext (headless/CI environments)
      fs.writeFileSync(cookieFilePath(platform), cookieText, 'utf8');
      console.log('[SecureCookie] Plaintext ' + platform + ' cookie saved (encryption unavailable)');
    }
  } catch (e) {
    console.error('[SecureCookie] Failed to save ' + platform + ' cookie:', e.message);
  }
}

/**
 * Load a cookie — decrypts from Keychain if encrypted
 */
function loadCookie(platform) {
  try {
    const filePath = cookieFilePath(platform);

    // Try encrypted file first
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      if (isEncryptionAvailable()) {
        try {
          const decrypted = decryptString(data);
          console.log('[SecureCookie] Decrypted ' + platform + ' cookie loaded (' + decrypted.length + ' bytes)');
          return decrypted;
        } catch (e) {
          // File might be legacy plaintext or corrupted
          console.warn('[SecureCookie] Decrypt failed, trying plaintext:', e.message);
        }
      }
      // Try as plaintext
      try {
        const text = data.toString('utf8').trim();
        if (text) {
          console.log('[SecureCookie] Plaintext ' + platform + ' cookie loaded (' + text.length + ' bytes)');
          return text;
        }
      } catch (_) {}
    }

    // Migrate from legacy plaintext files
    const legacyPath = legacyCookieFilePath(platform);
    if (fs.existsSync(legacyPath)) {
      const legacyData = fs.readFileSync(legacyPath, 'utf8').trim();
      if (legacyData) {
        console.log('[SecureCookie] Migrating legacy ' + platform + ' cookie to encrypted storage');
        saveCookie(platform, legacyData);
        // Remove legacy file after migration
        try { fs.unlinkSync(legacyPath); } catch (_) {}
        return legacyData;
      }
    }

    return '';
  } catch (e) {
    console.error('[SecureCookie] Failed to load ' + platform + ' cookie:', e.message);
    return '';
  }
}

/**
 * Delete a stored cookie
 */
function deleteCookie(platform) {
  try {
    const filePath = cookieFilePath(platform);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[SecureCookie] Deleted ' + platform + ' cookie');
    }
  } catch (e) {
    console.error('[SecureCookie] Failed to delete ' + platform + ' cookie:', e.message);
  }
}

module.exports = { saveCookie, loadCookie, deleteCookie };
