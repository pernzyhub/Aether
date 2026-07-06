import { supabase } from './supabaseClient.js';

const ADMIN_PREVIEW_STORAGE_KEY = 'aether_admin_preview_mode';

export function isAdminPreviewMode() {
  try {
    const urlPreview = new URLSearchParams(window.location.search).get('preview') === 'admin';
    const storedPreview = localStorage.getItem(ADMIN_PREVIEW_STORAGE_KEY) === '1';
    return urlPreview || storedPreview;
  } catch {
    return false;
  }
}

export function setAdminPreviewMode(enabled) {
  try {
    if (enabled) {
      localStorage.setItem(ADMIN_PREVIEW_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(ADMIN_PREVIEW_STORAGE_KEY);
    }
  } catch {}
}

try {
  if (new URLSearchParams(window.location.search).get('preview') === 'admin') {
    setAdminPreviewMode(true);
  }
} catch {}

function applyAdminPreviewToLinks() {
  if (!isAdminPreviewMode()) return;
  try {
    const anchors = document.querySelectorAll('a[href]');
    anchors.forEach((a) => {
      const raw = a.getAttribute('href') || '';
      if (!raw) return;
      if (raw.startsWith('#')) return;
      if (/^(mailto:|tel:|javascript:)/i.test(raw)) return;
      if (/^https?:\/\//i.test(raw)) {
        try {
          const u = new URL(raw);
          if (u.origin !== window.location.origin) return;
          if (u.searchParams.get('preview') === 'admin') return;
          u.searchParams.set('preview', 'admin');
          a.setAttribute('href', u.pathname + u.search + u.hash);
        } catch {}
        return;
      }
      try {
        const u = new URL(raw, window.location.origin);
        if (u.origin !== window.location.origin) return;
        if (u.searchParams.get('preview') === 'admin') return;
        u.searchParams.set('preview', 'admin');
        a.setAttribute('href', u.pathname + u.search + u.hash);
      } catch {}
    });
  } catch {}
}

try {
  if (document?.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(applyAdminPreviewToLinks, 0));
  } else {
    setTimeout(applyAdminPreviewToLinks, 0);
  }
} catch {}

export function getMemberSession() {
  try {
    return JSON.parse(localStorage.getItem('aether_member_session'));
  } catch {
    return null;
  }
}

export function clearMemberSession() {
  localStorage.removeItem('aether_member_session');
}

export async function ensureSupabaseSession() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    return sessionData.session;
  }

  if (isAdminPreviewMode()) {
    return null;
  }

  const memberSession = getMemberSession();
  if (!memberSession) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data?.session) {
      return data.session;
    }
  } catch (err) {
    console.warn('Unable to establish anonymous session:', err);
  }

  return null;
}

// --- Centralized auth handling and utilities ---
const _authListeners = [];
let _suppressAuth = false;
let _overlayEl = null;

export function addAuthListener(fn) {
  if (typeof fn === 'function') _authListeners.push(fn);
}

export function suppressAuthFor(ms = 500) {
  _suppressAuth = true;
  showAuthOverlay(true);
  setTimeout(() => {
    _suppressAuth = false;
    showAuthOverlay(false);
  }, ms);
}

export function showAuthOverlay(show) {
  try {
    if (!document) return;
    if (!_overlayEl) {
      _overlayEl = document.createElement('div');
      _overlayEl.id = 'auth-overlay';
      Object.assign(_overlayEl.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.45)',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        color: '#fff',
        fontSize: '18px',
        pointerEvents: 'auto'
      });
      _overlayEl.innerText = 'Syncing session...';
      document.body.appendChild(_overlayEl);
    }
    _overlayEl.style.display = show ? 'flex' : 'none';
  } catch (e) {
    // ignore
  }
}

// Central onAuthStateChange - only react to SIGNED_OUT by default.
try {
  supabase.auth.onAuthStateChange((event, session) => {
    const isAdminPreview = isAdminPreviewMode();
    if (isAdminPreview) {
      return;
    }

    try { console.debug('[auth] centralized onAuthStateChange', { event, hasSession: !!session?.user }); } catch (e) {}
    if (_suppressAuth) {
      try { console.debug('[auth] event suppressed', event); } catch (e) {}
      return;
    }

    if (event === 'SIGNED_OUT') {
      // notify listeners
      for (const fn of _authListeners) {
        try { fn(event, session); } catch (e) {}
      }

      const isAdminPreview = isAdminPreviewMode();
      if (isAdminPreview) {
        try { console.debug('[auth] skipping sign-out redirect on admin preview page'); } catch (e) {}
        return;
      }

      // default behavior: redirect to public front page if not already there
      try {
        const path = window.location.pathname.toLowerCase();
        if (!(path === '/' || path.endsWith('/index.html'))) {
          window.location.replace('/index.html?view=public');
        }
      } catch (e) {}
    }
  });
} catch (e) {}

export function setActiveNavLink() {
  const currentPath = window.location.pathname.split('/').pop().toLowerCase();
  document.querySelectorAll('.nav-link, .header-menu .nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const normalized = href.split('?')[0].split('/').pop().toLowerCase();
    link.classList.toggle('active', normalized === currentPath);
  });
}

export async function logout() {
  // Debug: record who/what triggered logout and why
  try {
    console.debug('[auth] logout() called', { href: window.location.href, stack: (new Error()).stack });
  } catch (e) {}

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Logout warning:', err);
  }

  setAdminPreviewMode(false);
  clearMemberSession();
  // Redirect to public front page
  window.location.replace('/index.html?view=public');
}

// Expose a global fallback so inline onclick="logout()" handlers work on pages
try {
  window.logout = logout;
} catch (e) {}
