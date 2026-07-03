// Global renderer error handler — displays error banner at bottom of page
window.onerror = function(msg, url, line) {
  console.error('RENDERER ERROR:', msg, 'at', url, ':', line);
  document.title = 'ERR: ' + msg;
  var dbg = document.createElement('div');
  dbg.id = 'js-error-dump';
  dbg.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:red;color:white;padding:8px;z-index:9999;font-size:11px;';
  dbg.textContent = 'JS ERROR: ' + msg + ' @ ' + url + ':' + line;
  document.body.appendChild(dbg);
};


// Global media error handler — replaces inline onerror attributes for CSP compliance.
// Catches all <img> and <video> load errors via event delegation (capture phase).
document.addEventListener('error', function(e) {
  var el = e.target;
  if (!el) return;
  if (el.tagName === 'IMG') {
    el.style.display = 'none';
  } else if (el.tagName === 'VIDEO') {
    var parent = el.parentElement;
    if (parent) {
      parent.classList.remove('loaded');
      parent.innerHTML = '';
    }
    try { localStorage.removeItem('fluidmusic-has-bg-video'); } catch (_) {}
  }
}, true);
