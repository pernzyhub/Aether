import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;
let currentClanUser = null;

async function loadUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  
  if (!user) {
    window.location.href = "/";
    return;
  }
  
  currentUser = user;
  
  // Load clan user data
  let { data: clanUser, error: clanUserError } = await supabase
    .from("clan_users")
    .select("*")
    .eq("id", user.id)
    .single();
  
  if (clanUserError && (clanUserError.code === 'PGRST116' || clanUserError.message.includes('No rows found'))) {
    const { data: newClanUser, insertError } = await supabase
      .from("clan_users")
      .insert([{
        id: user.id,
        ign: user.user_metadata?.full_name || null,
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
    const username = clanUser.ign || user.user_metadata?.full_name || user.email;
    const welcomeEl = document.getElementById("welcome-text");
    if (welcomeEl) {
      welcomeEl.textContent = `WELCOME, ${username.toUpperCase()}`;
    }
    
    // Pre-fill the IGN input
    const ignInput = document.getElementById("newIgn");
    if (ignInput && clanUser.ign) {
      ignInput.value = clanUser.ign;
    }
  }
}

async function saveSettings() {
  const newIgn = document.getElementById("newIgn").value.trim();
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const statusEl = document.getElementById("settings-status");
  
  if (!newIgn || !newPassword || !confirmPassword) {
    statusEl.textContent = "Please fill out all fields!";
    statusEl.className = "status-text error";
    return;
  }
  
  if (newPassword !== confirmPassword) {
    statusEl.textContent = "Passwords do not match!";
    statusEl.className = "status-text error";
    return;
  }
  
  statusEl.textContent = "Saving settings...";
  statusEl.className = "status-text";
  
  try {
    const { error } = await supabase
      .from("clan_users")
      .update({
        ign: newIgn,
        password: newPassword, // In a real app, use bcrypt to hash!
        updated_at: new Date().toISOString()
      })
      .eq("id", currentUser.id);
    
    if (error) {
      statusEl.textContent = `Error saving settings: ${error.message}`;
      statusEl.className = "status-text error";
      return;
    }
    
    statusEl.textContent = "✅ Settings saved successfully! Your IGN and password have been updated!";
    statusEl.className = "status-text success";
    
    // Reload clan user
    await loadUser();
    
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.className = "status-text error";
  }
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/";
}

// Load user on page load
window.addEventListener("load", loadUser);

window.logout = logout;