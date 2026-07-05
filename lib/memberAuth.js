import { supabase } from './supabaseClient.js';

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

export function setActiveNavLink() {
  const currentPath = window.location.pathname.split('/').pop().toLowerCase();
  document.querySelectorAll('.nav-link, .header-menu .nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const normalized = href.split('/').pop().toLowerCase();
    link.classList.toggle('active', normalized === currentPath);
  });
}

export async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Logout warning:', err);
  }

  clearMemberSession();
  localStorage.removeItem('aether_access_granted');
  window.location.replace('/access-gate.html');
}
