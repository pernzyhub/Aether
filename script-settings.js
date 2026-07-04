import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;
let currentClanUser = null;
const DEFAULT_MEMBER_PASSWORD = "123";

function getMemberSession() {
  try {
    return JSON.parse(localStorage.getItem("aether_member_session"));
  } catch {
    return null;
  }
}

function clearMemberSession() {
  localStorage.removeItem("aether_member_session");
}

async function ensureSupabaseSession() {
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
    console.warn("Unable to start a temporary member session:", err);
  }

  return null;
}

function showSettingsStatus(message, type) {
  const statusEl = document.getElementById("settings-status");
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-text ${type}`;
}

async function loadUser() {
  await ensureSupabaseSession();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  const memberSession = getMemberSession();
  
  if (!user && !memberSession) {
    window.location.replace("/access-gate.html");
    return;
  }
  
  if (!user && memberSession) {
    currentUser = { id: memberSession.id };
  } else {
    currentUser = user;
  }
  
  // Load clan user data
  const userId = currentUser?.id || user?.id;

  let { data: clanUser, error: clanUserError } = await supabase
    .from("clan_users")
    .select("*")
    .eq("id", userId)
    .single();
  
  if (clanUserError && (clanUserError.code === 'PGRST116' || clanUserError.message.includes('No rows found'))) {
    const { data: newClanUser, insertError } = await supabase
      .from("clan_users")
      .insert([{
        id: userId,
        ign: user?.user_metadata?.full_name || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (!insertError) {
      clanUser = newClanUser;
      clanUserError = null;
    }
  }
  
  if (!clanUserError && clanUser) {
    currentClanUser = clanUser;
    
    // Update welcome text
    const username = clanUser.ign || user?.user_metadata?.full_name || user?.email || memberSession?.ign || "MEMBER";
    const welcomeEl = document.getElementById("welcome-text");
    if (welcomeEl) {
      welcomeEl.textContent = `WELCOME, ${username.toUpperCase()}`;
    }
    
    const needsPasswordChange = Boolean(memberSession?.needsPasswordChange) || !clanUser.password || clanUser.password === DEFAULT_MEMBER_PASSWORD;
    if (needsPasswordChange) {
      showSettingsStatus("This is your first login. Please choose a new password before continuing.", "error");
    }
  }
}

async function saveSettings() {
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  
  if (!newPassword || !confirmPassword) {
    showSettingsStatus("Please fill out all fields!", "error");
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showSettingsStatus("Passwords do not match!", "error");
    return;
  }
  
  showSettingsStatus("Saving settings...", "");
  
  try {
    const memberSession = getMemberSession();
    
    // For member session users (non-Supabase auth), update database
    if (memberSession) {
      const { error: updateError } = await supabase
        .from("clan_users")
        .update({
          password: newPassword,
          updated_at: new Date().toISOString()
        })
        .eq("id", memberSession.id);
      
      if (updateError) {
        showSettingsStatus(`Error updating password: ${updateError.message}`, "error");
        return;
      }
      
      // Update localStorage to remove needsPasswordChange flag
      localStorage.setItem("aether_member_session", JSON.stringify({
        ...memberSession,
        needsPasswordChange: false
      }));
      
      showSettingsStatus("Password updated successfully!", "success");
      document.getElementById("settings-form").reset();
      await loadUser();
      return;
    }
    
    // For Supabase auth users, use auth API
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) {
        showSettingsStatus(`Error updating password: ${updateError.message}`, "error");
        return;
      }
      
      showSettingsStatus("Password updated successfully!", "success");
      document.getElementById("settings-form").reset();
      return;
    }
    
    showSettingsStatus("Your session could not be verified. Please log in again.", "error");
    
  } catch (err) {
    showSettingsStatus(`Error: ${err.message}`, "error");
  }
}

async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout warning:", err);
  }

  clearMemberSession();
  localStorage.removeItem("aether_access_granted");
  window.location.replace("/access-gate.html");
}

function setActiveNavLink() {
  const currentPath = window.location.pathname.split("/").pop().toLowerCase();
  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const normalized = href.split('/').pop().toLowerCase();
    link.classList.toggle('active', normalized === currentPath);
  });
}

// Load user on page load
window.addEventListener("load", () => {
  window.setTimeout(() => {
    loadUser();
    setActiveNavLink();
  }, 80);
});

window.logout = logout;
window.saveSettings = saveSettings;