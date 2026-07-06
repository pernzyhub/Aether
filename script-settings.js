import { supabase } from './lib/supabaseClient.js';
import { getMemberSession, ensureSupabaseSession, logout, setActiveNavLink, isAdminPreviewMode } from './lib/memberAuth.js';

let currentUser = null;
let currentClanUser = null;
const DEFAULT_MEMBER_PASSWORD = "123";
const isAdminPreview = isAdminPreviewMode();

function showSettingsStatus(message, type) {
  const statusEl = document.getElementById("settings-status");
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-text ${type}`;
}

async function loadUser() {
  if (isAdminPreview) {
    showSettingsStatus("Preview mode: settings are disabled.", "error");
    const form = document.getElementById("settings-form");
    if (form) {
      form.querySelectorAll("input, button").forEach((el) => {
        el.disabled = true;
      });
    }
    return;
  }

  const supabaseSession = await ensureSupabaseSession();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = supabaseSession?.user || sessionData?.session?.user;
  const memberSession = getMemberSession();
  
  if (!user && !memberSession) {
    window.location.replace("/index.html");
    return;
  }
  
  if (!user && memberSession) {
    currentUser = { id: memberSession.id };
  } else {
    currentUser = user;
  }
  
  // Load clan user data
  const userId = currentUser?.id || memberSession?.id;

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
    
    // For member session users (non-Supabase auth), use RPC to update database
    if (memberSession) {
      const { error: rpcError } = await supabase.rpc('update_member_password', {
        user_id: memberSession.id,
        new_password: newPassword
      });
      
      if (rpcError) {
        showSettingsStatus(`Error updating password: ${rpcError.message}`, "error");
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


// Load user on page load
window.addEventListener("load", () => {
  window.setTimeout(async () => {
    await loadUser();
    setActiveNavLink();
  }, 80);
});

window.logout = logout;
window.saveSettings = saveSettings;
