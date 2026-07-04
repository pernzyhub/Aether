import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function loadUser() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user) {
    const username = user.user_metadata?.full_name || user.user_metadata?.name || user.email;
    const welcomeEl = document.getElementById("welcome-text");
    if (welcomeEl) {
      welcomeEl.textContent = `WELCOME, ${username.toUpperCase()}`;
    }
  } else {
    window.location.href = "/";
  }
}

async function loadAnnouncements() {
  const container = document.getElementById("announcements-list");
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      container.innerHTML = `<p>Error loading announcements: ${error.message}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No announcements yet.</p>";
      return;
    }

    container.innerHTML = data.map(ann => `
      <div class="announcement-item">
        <div class="announcement-title">${escapeHtml(ann.title)}</div>
        <div class="announcement-date">${new Date(ann.created_at).toLocaleDateString()}</div>
        <div class="announcement-content">${escapeHtml(ann.content)}</div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p>Error loading announcements: ${err.message}</p>`;
  }
}

async function loadRules() {
  const container = document.getElementById("rules-list");
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .order("order_num", { ascending: true });

    if (error) {
      container.innerHTML = `<p>Error loading rules: ${error.message}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No rules yet.</p>";
      return;
    }

    container.innerHTML = data.map(rule => `
      <div class="rule-item">
        <div class="rule-number">${rule.order_num}</div>
        <div class="rule-text">
          <strong>${escapeHtml(rule.title)}:</strong> ${escapeHtml(rule.content)}
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p>Error loading rules: ${err.message}</p>`;
  }
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/";
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

window.addEventListener("load", async () => {
  await loadUser();
  loadAnnouncements();
  loadRules();
});

window.logout = logout;
window.goToPage = goToPage;
