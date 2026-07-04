import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentClanUser = null;
let currentUser = null;

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

async function loadUser() {
  const session = await ensureSupabaseSession();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
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

  const userId = currentUser?.id || user?.id;

  // Load clan user data
  let { data: clanUser, error } = await supabase
    .from("clan_users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && (error.code === 'PGRST116' || error.message.includes('No rows found'))) {
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

    if (insertError) {
      console.error("Error creating clan user:", insertError);
    } else {
      clanUser = newClanUser;
      error = null;
    }
  } else if (error) {
    console.error("Error loading clan user:", error);
  }

  if (!error && clanUser) {
    currentClanUser = clanUser;
  }

  if (memberSession?.needsPasswordChange) {
    window.location.href = "/settings.html";
    return;
  }

  const isAdmin = user?.app_metadata?.role && (user.app_metadata.role === "admin" || user.app_metadata.role === "superuser");

  // Check if user is admin to show admin menu
  const adminMenuItem = document.getElementById("admin-menu-item");
  if (adminMenuItem && isAdmin) {
    adminMenuItem.style.display = "inline-flex";
  }

  // Set welcome text using IGN if available
  const username = currentClanUser?.ign || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || memberSession?.ign || "MEMBER";
  const welcomeEl = document.getElementById("welcome-text");
  if (welcomeEl) {
    welcomeEl.textContent = `WELCOME, ${username.toUpperCase()}`;
  }
}

function setActiveNavLink() {
  const currentPath = window.location.pathname.split("/").pop().toLowerCase();
  document.querySelectorAll('.header-menu .nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const normalized = href.split('/').pop().toLowerCase();
    link.classList.toggle('active', normalized === currentPath);
  });
}

function getCachedItems(cacheKey) {
  try {
    const cachedValue = localStorage.getItem(cacheKey);
    return cachedValue ? JSON.parse(cachedValue) : null;
  } catch {
    return null;
  }
}

function saveCachedItems(cacheKey, value) {
  localStorage.setItem(cacheKey, JSON.stringify(value));
}

function renderAnnouncements(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = "<p>No announcements yet.</p>";
    return;
  }

  container.innerHTML = items.map(ann => `
    <div class="announcement-item">
      <div class="announcement-title">${escapeHtml(ann.title)}</div>
      <div class="announcement-date">${new Date(ann.created_at).toLocaleDateString()}</div>
      <div class="announcement-content">${escapeHtml(ann.content)}</div>
    </div>
  `).join("");
}

function renderRules(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = "<p>No rules yet.</p>";
    return;
  }

  container.innerHTML = items.map(rule => `
    <div class="rule-item">
      <div class="rule-number">${rule.order_num}</div>
      <div class="rule-text">
        <strong>${escapeHtml(rule.title)}:</strong> ${escapeHtml(rule.content)}
      </div>
    </div>
  `).join("");
}

async function loadAnnouncements() {
  const container = document.getElementById("announcements-list");
  if (!container) return;

  const cachedAnnouncements = getCachedItems("aether_announcements_cache") || [];
  if (cachedAnnouncements.length > 0) {
    renderAnnouncements(cachedAnnouncements, container);
  } else {
    container.innerHTML = "<p>Loading announcements...</p>";
  }

  await ensureSupabaseSession();

  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (cachedAnnouncements.length > 0) {
        renderAnnouncements(cachedAnnouncements, container);
      } else {
        container.innerHTML = `<p>Error loading announcements: ${error.message}</p>`;
      }
      return;
    }

    if (data && data.length > 0) {
      saveCachedItems("aether_announcements_cache", data);
      renderAnnouncements(data, container);
    } else if (cachedAnnouncements.length > 0) {
      renderAnnouncements(cachedAnnouncements, container);
    } else {
      container.innerHTML = "<p>No announcements yet.</p>";
    }
  } catch (err) {
    if (cachedAnnouncements.length > 0) {
      renderAnnouncements(cachedAnnouncements, container);
    } else {
      container.innerHTML = `<p>Error loading announcements: ${err.message}</p>`;
    }
  }
}

async function loadRules() {
  const container = document.getElementById("rules-list");
  if (!container) return;

  const cachedRules = getCachedItems("aether_rules_cache") || [];
  if (cachedRules.length > 0) {
    renderRules(cachedRules, container);
  } else {
    container.innerHTML = "<p>Loading rules...</p>";
  }

  await ensureSupabaseSession();

  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .order("order_num", { ascending: true });

    if (error) {
      if (cachedRules.length > 0) {
        renderRules(cachedRules, container);
      } else {
        container.innerHTML = `<p>Error loading rules: ${error.message}</p>`;
      }
      return;
    }

    if (data && data.length > 0) {
      saveCachedItems("aether_rules_cache", data);
      renderRules(data, container);
    } else if (cachedRules.length > 0) {
      renderRules(cachedRules, container);
    } else {
      container.innerHTML = "<p>No rules yet.</p>";
    }
  } catch (err) {
    if (cachedRules.length > 0) {
      renderRules(cachedRules, container);
    } else {
      container.innerHTML = `<p>Error loading rules: ${err.message}</p>`;
    }
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

function goToPage(page) {
  if (page) {
    window.location.href = page;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    await loadUser();
    loadAnnouncements();
    loadRules();
    setActiveNavLink();
  }, 80);
});

window.addEventListener("storage", (event) => {
  if (event.key === "aether_announcements_cache") {
    loadAnnouncements();
  }
  if (event.key === "aether_rules_cache") {
    loadRules();
  }
});

window.logout = logout;
window.goToPage = goToPage;
