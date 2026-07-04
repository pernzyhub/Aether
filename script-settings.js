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

function showSettingsStatus(message, type) {
  const statusEl = document.getElementById("settings-status");
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-text ${type}`;
}

async function loadUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  const memberSession = getMemberSession();
  
  if (!user && !memberSession) {
    window.location.href = "/";
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
    
    // Pre-fill the IGN input
    const ignInput = document.getElementById("newIgn");
    if (ignInput && clanUser.ign) {
      ignInput.value = clanUser.ign;
    }

    const needsPasswordChange = Boolean(memberSession?.needsPasswordChange) || !clanUser.password || clanUser.password === DEFAULT_MEMBER_PASSWORD;
    if (needsPasswordChange) {
      showSettingsStatus("This is your first login. Please choose a new password before continuing.", "error");
    }
  }
}

async function saveSettings() {
  const newIgn = document.getElementById("newIgn").value.trim();
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  
  if (!newIgn || !newPassword || !confirmPassword) {
    showSettingsStatus("Please fill out all fields!", "error");
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showSettingsStatus("Passwords do not match!", "error");
    return;
  }
  
  showSettingsStatus("Saving settings...", "");
  
  try {
    if (newPassword && currentUser?.id && currentUser?.email) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) {
        showSettingsStatus(`Error updating password: ${passwordError.message}`, "error");
        return;
      }
    }

    const { error: profileError } = await supabase
      .from("clan_users")
      .update({
        ign: newIgn,
        password: newPassword,
        updated_at: new Date().toISOString()
      })
      .eq("id", currentUser.id);
    
    if (profileError) {
      showSettingsStatus(`Error saving settings: ${profileError.message}`, "error");
      return;
    }
    
    const memberSession = getMemberSession();
    if (memberSession) {
      localStorage.setItem("aether_member_session", JSON.stringify({
        ...memberSession,
        needsPasswordChange: false
      }));
    }

    showSettingsStatus("Settings saved successfully! Your IGN and password have been updated.", "success");
    document.getElementById("settings-form").reset();
    await loadUser();
    
  } catch (err) {
    showSettingsStatus(`Error: ${err.message}`, "error");
  }
}

async function logout() {
  await supabase.auth.signOut();
  clearMemberSession();
  window.location.href = "/";
}

// Load user on page load
window.addEventListener("load", () => {
  loadUser();
});

window.logout = logout;
window.saveSettings = saveSettings;