var FULL_MIN_MS = 2000;
var FULL_MAX_MS = 4000;
var QUICK_MIN_MS = 250;
var QUICK_MAX_MS = 1500;
var LEAVE_MS = 200;

var root = document.documentElement;
var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var leaving = false;

function hide() {
  root.classList.remove('pt-splash-active', 'pt-splash-leaving');
}

// Arrival: the overlay is already visible (set by the inline script in <head>). Hide it when the page has loaded AND the minimum time has passed, or when the maximum time is reached.
if (root.classList.contains('pt-splash-active')) {
  var full = root.getAttribute('data-splash') === 'full' && !reduce;
  var minMs = full ? FULL_MIN_MS : QUICK_MIN_MS;
  var maxMs = full ? FULL_MAX_MS : QUICK_MAX_MS;
  var loaded = document.readyState === 'complete';
  var minDone = false;
  var done = false;
  var finish = function () {
    if (done) return;
    done = true;
    hide();
  };
  var tryFinish = function () {
    if (loaded && minDone) finish();
  };
  setTimeout(function () { minDone = true; tryFinish(); }, Math.max(0, minMs - performance.now()));
  if (!loaded) {
    window.addEventListener('load', function () { loaded = true; tryFinish(); });
  }
  setTimeout(finish, maxMs);
}

// Leaving: fade the overlay in over the old page, then go to the new page.
document.addEventListener('click', function (e) {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  var a = e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  if (a.target && a.target !== '_self') return;
  if (a.hasAttribute('download')) return;
  var url;
  try { url = new URL(a.href, location.href); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.search === location.search) return;
  if (leaving) { e.preventDefault(); return; }
  e.preventDefault();
  leaving = true;
  root.setAttribute('data-splash', 'quick');
  root.classList.add('pt-splash-active', 'pt-splash-leaving');
  setTimeout(function () { location.href = url.href; }, LEAVE_MS);
  // safety: if the page did not change after 3 s, remove the overlay
  setTimeout(function () { leaving = false; hide(); }, 3000);
});

// Back/forward cache: never leave the overlay stuck.
window.addEventListener('pageshow', function (e) {
  if (e.persisted) { leaving = false; hide(); }
});

