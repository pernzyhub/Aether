import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;

async function checkAuth() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  
  if (!user) {
    window.location.href = "/admin-login.html";
    return false;
  }

  const role = user.user_metadata?.role;
  if (role !== "admin" && role !== "superuser") {
    await supabase.auth.signOut();
    window.location.href = "/admin-login.html";
    return false;
  }

  currentUser = user;
  document.getElementById("admin-welcome").textContent = `WELCOME, ${user.user_metadata?.full_name || user.email}`;
  return true;
}

async function loadAnnouncements() {
  const container = document.getElementById("announcements-list");
  const statusEl = document.getElementById("announcements-status");
  container.innerHTML = "<p>Loading announcements...</p>";

  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No announcements yet.</p>";
      return;
    }

    container.innerHTML = data.map(ann => `
      <div class="list-item" data-id="${ann.id}">
        <div class="list-item-content">
          <div class="list-item-title">${escapeHtml(ann.title)}</div>
          <div class="list-item-meta">${new Date(ann.created_at).toLocaleString()}</div>
          <div class="list-item-text">${escapeHtml(ann.content)}</div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-danger" onclick="deleteAnnouncement('${ann.id}')">DELETE</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "";
    statusEl.textContent = "Error loading announcements: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function postAnnouncement(e) {
  e.preventDefault();
  const title = document.getElementById("announcement-title").value;
  const content = document.getElementById("announcement-content").value;
  const statusEl = document.getElementById("announcements-status");

  statusEl.textContent = "Posting...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("announcements")
      .insert([{ title, content, created_by: currentUser.id }]);

    if (error) throw error;

    statusEl.textContent = "Announcement posted successfully!";
    statusEl.className = "status-text success";
    document.getElementById("announcement-form").reset();
    loadAnnouncements();
  } catch (err) {
    statusEl.textContent = "Error posting announcement: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function deleteAnnouncement(id) {
  if (!confirm("Are you sure you want to delete this announcement?")) return;
  const statusEl = document.getElementById("announcements-status");
  
  try {
    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) throw error;
    statusEl.textContent = "Announcement deleted!";
    statusEl.className = "status-text success";
    loadAnnouncements();
  } catch (err) {
    statusEl.textContent = "Error deleting: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function loadRules() {
  const container = document.getElementById("rules-list");
  const statusEl = document.getElementById("rules-status");
  container.innerHTML = "<p>Loading rules...</p>";

  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .order("order_num", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No rules yet.</p>";
      return;
    }

    container.innerHTML = data.map(rule => `
      <div class="list-item" data-id="${rule.id}">
        <div class="list-item-content">
        <div class="list-item-title">Rule #${rule.order_num}: ${escapeHtml(rule.title)}</div>
          <div class="list-item-text">${escapeHtml(rule.content)}</div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-danger" onclick="deleteRule('${rule.id}')">DELETE</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "";
    statusEl.textContent = "Error loading rules: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function postRule(e) {
  e.preventDefault();
  const orderNum = parseInt(document.getElementById("rule-order").value);
  const title = document.getElementById("rule-title").value;
  const content = document.getElementById("rule-content").value;
  const statusEl = document.getElementById("rules-status");

  statusEl.textContent = "Adding rule...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("rules")
      .insert([{ order_num: orderNum, title, content, created_by: currentUser.id }]);

    if (error) throw error;

    statusEl.textContent = "Rule added successfully!";
    statusEl.className = "status-text success";
    document.getElementById("rule-form").reset();
    loadRules();
  } catch (err) {
    statusEl.textContent = "Error adding rule: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function deleteRule(id) {
  if (!confirm("Are you sure you want to delete this rule?")) return;
  const statusEl = document.getElementById("rules-status");
  
  try {
    const { error } = await supabase
      .from("rules")
      .delete()
      .eq("id", id);

    if (error) throw error;
    statusEl.textContent = "Rule deleted!";
    statusEl.className = "status-text success";
    loadRules();
  } catch (err) {
    statusEl.textContent = "Error deleting: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener("load", async () => {
  const isAuth = await checkAuth();
  if (isAuth) {
    loadAnnouncements();
    loadRules();
  }
});

window.postAnnouncement = postAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.postRule = postRule;
window.deleteRule = deleteRule;
window.logout = logout;
