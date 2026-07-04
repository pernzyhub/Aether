import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const DEFAULT_MEMBER_PASSWORD = "123";

function getMemberSession() {
  try {
    return JSON.parse(localStorage.getItem("aether_member_session"));
  } catch {
    return null;
  }
}

function saveMemberSession(clanUser, needsPasswordChange) {
  localStorage.setItem("aether_member_session", JSON.stringify({
    id: clanUser.id,
    ign: clanUser.ign,
    needsPasswordChange
  }));
}

function clearMemberSession() {
  localStorage.removeItem("aether_member_session");
}

async function discordLogin() {
  await supabase.auth.signInWithOAuth({ provider: "discord" });
}

async function logout() {
  await supabase.auth.signOut();
  clearMemberSession();
  const userEl = document.getElementById("user");
  if (userEl) userEl.textContent = "Logged out.";
}

function toggleAdminDropdown() {
  const dropdown = document.getElementById("adminDropdown");
  dropdown.classList.toggle("open");
}

function setLoginSide(side) {
  return;
}

async function adminLogin() {
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;
  const statusEl = document.getElementById("adminStatus");

  statusEl.textContent = "";
  statusEl.className = "status-text";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    statusEl.textContent = "Login failed: " + error.message;
    statusEl.className = "status-text error";
  } else {
    const user = data.user;
    const role = user?.app_metadata?.role;
    if (role === "admin" || role === "superuser") {
      statusEl.textContent = "Welcome, Admin!";
      statusEl.className = "status-text success";
      setTimeout(() => {
        window.location.href = "/admin-dashboard.html";
      }, 1000);
    } else {
      statusEl.textContent = "Access denied. Not an admin.";
      statusEl.className = "status-text error";
    }
  }
}

async function memberLogin() {
  const ign = document.getElementById("memberIgn").value.trim();
  const password = document.getElementById("memberPassword").value;
  const statusEl = document.getElementById("memberStatus");

  statusEl.textContent = "";
  statusEl.className = "status-text";

  try {
    const { data: clanUsers, error } = await supabase
      .from("clan_users")
      .select("*")
      .eq("ign", ign)
      .limit(1);

    if (error) throw error;

    const clanUser = clanUsers?.[0];
    if (!clanUser) {
      statusEl.textContent = "No account found for that IGN.";
      statusEl.className = "status-text error";
      return;
    }

    if (!clanUser.is_active) {
      statusEl.textContent = "This account is inactive.";
      statusEl.className = "status-text error";
      return;
    }

    const storedPassword = clanUser.password || DEFAULT_MEMBER_PASSWORD;
    const passwordMatches = password === storedPassword;
    const needsPasswordChange = !clanUser.password || clanUser.password === DEFAULT_MEMBER_PASSWORD || password === DEFAULT_MEMBER_PASSWORD;

    if (!passwordMatches) {
      statusEl.textContent = "Incorrect password.";
      statusEl.className = "status-text error";
      return;
    }

    saveMemberSession(clanUser, needsPasswordChange);
    statusEl.textContent = needsPasswordChange ? "First login detected. Redirecting to change your password..." : "Welcome!";
    statusEl.className = "status-text success";

    setTimeout(() => {
      window.location.href = needsPasswordChange ? "/settings.html" : "/portal.html";
    }, 700);
  } catch (err) {
    statusEl.textContent = "Login failed: " + err.message;
    statusEl.className = "status-text error";
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    window.location.href = "/portal.html";
  }
});

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    const { data } = await supabase.auth.getSession();
    const userEl = document.getElementById("user");
    if (userEl) {
      userEl.textContent = JSON.stringify(data.session?.user || "Not logged in", null, 2);
    }

    const accessGranted = localStorage.getItem("aether_access_granted") === "true";
    if (!accessGranted) {
      window.location.href = "/access-gate.html";
      return;
    }

    setLoginSide('member');
  }, 50);
});

window.discordLogin = discordLogin;
window.logout = logout;
window.toggleAdminDropdown = toggleAdminDropdown;
window.setLoginSide = setLoginSide;
window.adminLogin = adminLogin;
window.memberLogin = memberLogin;
