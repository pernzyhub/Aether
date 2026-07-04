import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const DEFAULT_MEMBER_PASSWORD = "123";

function isAdminUser(user) {
  const appMeta = user?.app_metadata || {};
  const userMeta = user?.user_metadata || {};
  const roleValue = appMeta.role || userMeta.role || appMeta.roles || userMeta.roles;
  const roleText = typeof roleValue === "string"
    ? roleValue
    : Array.isArray(roleValue)
      ? roleValue.join(",")
      : "";
  const superFlag = appMeta.is_superuser ?? userMeta.is_superuser ?? false;
  return superFlag || /superuser|admin/i.test(roleText);
}

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
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout warning:", err);
  }
  clearMemberSession();
  localStorage.removeItem("aether_access_granted");
  const userEl = document.getElementById("user");
  if (userEl) userEl.textContent = "Logged out.";
  window.location.replace("/");
}

function toggleLoginMode() {
  const memberPanel = document.getElementById("memberFormPanel");
  const adminPanel = document.getElementById("adminFormPanel");
  const toggleBtn = document.getElementById("loginToggleBtn");
  const title = document.getElementById("loginModeTitle");
  const text = document.getElementById("loginModeText");

  if (!memberPanel || !adminPanel || !toggleBtn || !title || !text) {
    return;
  }

  const adminActive = !adminPanel.classList.contains("form-panel-hidden");
  if (adminActive) {
    adminPanel.classList.add("form-panel-hidden");
    memberPanel.classList.remove("form-panel-hidden");
    toggleBtn.textContent = "SWITCH TO ADMIN";
    title.textContent = "MEMBER LOGIN";
    text.textContent = "Enter your username and password to access the clan portal.";
  } else {
    adminPanel.classList.remove("form-panel-hidden");
    memberPanel.classList.add("form-panel-hidden");
    toggleBtn.textContent = "SWITCH TO MEMBER";
    title.textContent = "ADMIN LOGIN";
    text.textContent = "Use your admin credentials to manage the clan dashboard.";
  }
}

function setLoginSide(side) {
  const memberPanel = document.getElementById("memberFormPanel");
  const adminPanel = document.getElementById("adminFormPanel");
  const toggleBtn = document.getElementById("loginToggleBtn");
  const title = document.getElementById("loginModeTitle");
  const text = document.getElementById("loginModeText");

  if (side === 'admin') {
    memberPanel.classList.add("form-panel-hidden");
    adminPanel.classList.remove("form-panel-hidden");
    toggleBtn.textContent = "SWITCH TO MEMBER";
    title.textContent = "ADMIN LOGIN";
    text.textContent = "Use your admin credentials to manage the clan dashboard.";
  } else {
    memberPanel.classList.remove("form-panel-hidden");
    adminPanel.classList.add("form-panel-hidden");
    toggleBtn.textContent = "SWITCH TO ADMIN";
    title.textContent = "MEMBER LOGIN";
    text.textContent = "Enter your IGN and password to access the clan portal.";
  }
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
    if (isAdminUser(user)) {
      statusEl.textContent = "Welcome, Admin!";
      statusEl.className = "status-text success";
      setTimeout(() => {
        window.location.replace("/admin-dashboard.html");
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
  if (!session?.user) return;
  if (isAdminUser(session.user)) {
    window.location.replace("/admin-dashboard.html");
  } else {
    window.location.replace("/portal.html");
  }
});

function hasAccessGate() {
  return localStorage.getItem("aether_access_granted") === "true";
}

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    const { data } = await supabase.auth.getSession();
    const userEl = document.getElementById("user");
    if (userEl) {
      userEl.textContent = JSON.stringify(data.session?.user || "Not logged in", null, 2);
    }

    if (!hasAccessGate()) {
      window.location.replace("/access-gate.html");
      return;
    }

    if (data.session?.user && isAdminUser(data.session.user)) {
      window.location.replace("/admin-dashboard.html");
      return;
    }

    setLoginSide('member');
  }, 50);
});

window.discordLogin = discordLogin;
window.logout = logout;
window.toggleLoginMode = toggleLoginMode;
window.setLoginSide = setLoginSide;
window.adminLogin = adminLogin;
window.memberLogin = memberLogin;
