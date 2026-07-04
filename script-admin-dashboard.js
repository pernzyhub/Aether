import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;

function setActiveModule(moduleName) {
  document.querySelectorAll('.module-card').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.module === moduleName);
  });
  document.querySelectorAll('.module-panel').forEach(panel => {
    panel.classList.toggle('is-active', panel.dataset.module === moduleName);
  });
}

function applyEditorCommand(command, value, editorId) {
  const editor = document.getElementById(editorId);
  if (!editor) return;
  editor.focus();
  if (command === 'insertHTML') {
    document.execCommand('insertHTML', false, value);
  } else {
    document.execCommand(command, false, value);
  }
}

function attachEditorUploadHandlers() {
  document.querySelectorAll('.editor-file-input').forEach(input => {
    input.addEventListener('change', function () {
      const file = this.files?.[0];
      const editor = document.getElementById(this.dataset.editor);
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = () => {
        const imgHtml = `<img src="${reader.result}" alt="uploaded" style="max-width:100%; margin:8px 0;" />`;
        document.execCommand('insertHTML', false, imgHtml);
      };
      reader.readAsDataURL(file);
    });
  });
}

async function checkAuth() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  
  if (!user) {
    window.location.href = "/admin-login.html";
    return false;
  }

  const role = user.app_metadata?.role;
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
          <div class="list-item-text">${ann.content || ""}</div>
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

async function postAnnouncement(event) {
  event.preventDefault();
  const title = document.getElementById("announcement-title").value;
  const statusEl = document.getElementById("announcements-status");

  statusEl.textContent = "Posting...";
  statusEl.className = "status-text";

  try {
    const content = document.getElementById("announcement-editor").innerHTML;
    const { error } = await supabase
      .from("announcements")
      .insert([{ title, content, created_by: currentUser.id }]);

    if (error) throw error;

    statusEl.textContent = "Announcement posted successfully!";
    statusEl.className = "status-text success";
    document.getElementById("announcement-form").reset();
    document.getElementById("announcement-editor").innerHTML = "";
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
          <div class="list-item-text">${rule.content || ""}</div>
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

async function postRule(event) {
  event.preventDefault();
  const orderNum = parseInt(document.getElementById("rule-order").value);
  const title = document.getElementById("rule-title").value;
  const statusEl = document.getElementById("rules-status");

  statusEl.textContent = "Adding rule...";
  statusEl.className = "status-text";

  try {
    const content = document.getElementById("rule-editor").innerHTML;
    const { error } = await supabase
      .from("rules")
      .insert([{ order_num: orderNum, title, content, created_by: currentUser.id }]);

    if (error) throw error;

    statusEl.textContent = "Rule added successfully!";
    statusEl.className = "status-text success";
    document.getElementById("rule-form").reset();
    document.getElementById("rule-editor").innerHTML = "";
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

/* Item Management */
async function addItem(event) {
  event.preventDefault();
  const name = document.getElementById("item-name").value;
  const description = document.getElementById("item-description").value;
  const statusEl = document.getElementById("items-status");

  statusEl.textContent = "Adding item...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("items")
      .insert([{ name, description, created_by: currentUser.id }]);

    if (error) throw error;

    statusEl.textContent = "Item added successfully!";
    statusEl.className = "status-text success";
    document.getElementById("item-form").reset();
    loadItems();
  } catch (err) {
    statusEl.textContent = "Error adding item: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function loadItems() {
  const container = document.getElementById("items-list");
  const statusEl = document.getElementById("items-status");
  container.innerHTML = "<p>Loading items...</p>";

  try {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No items yet.</p>";
      return;
    }

    container.innerHTML = data.map(item => `
      <div class="list-item" data-id="${item.id}">
        <div class="list-item-content">
          <div class="list-item-title">${escapeHtml(item.name)}</div>
          <div class="list-item-meta">${new Date(item.created_at).toLocaleString()}</div>
          ${item.description ? `<div class="list-item-text">${escapeHtml(item.description)}</div>` : ''}
        </div>
        <div class="list-item-actions">
          <button class="btn btn-danger" onclick="deleteItem('${item.id}')">DELETE</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "";
    statusEl.textContent = "Error loading items: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function deleteItem(id) {
  if (!confirm("Are you sure you want to delete this item?")) return;
  const statusEl = document.getElementById("items-status");
  
  try {
    const { error } = await supabase
      .from("items")
      .delete()
      .eq("id", id);

    if (error) throw error;
    statusEl.textContent = "Item deleted!";
    statusEl.className = "status-text success";
    loadItems();
  } catch (err) {
    statusEl.textContent = "Error deleting item: " + err.message;
    statusEl.className = "status-text error";
  }
}

/* Clan User Management */
async function bulkRegisterMembers(event) {
  event.preventDefault();
  const rawText = document.getElementById("bulk-accounts").value.trim();
  const statusEl = document.getElementById("bulk-register-status");

  if (!rawText) {
    statusEl.textContent = "Please enter at least one account.";
    statusEl.className = "status-text error";
    return;
  }

  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) {
    statusEl.textContent = "Please enter at least one account.";
    statusEl.className = "status-text error";
    return;
  }

  statusEl.textContent = "Registering accounts...";
  statusEl.className = "status-text";

  const results = [];
  for (const line of lines) {
    const parts = line.split("|").map(part => part.trim());
    const ign = parts[0];
    const password = parts[1] || "123";

    if (!ign) continue;

    try {
      const { data: existingUsers } = await supabase
        .from("clan_users")
        .select("id")
        .eq("ign", ign)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        results.push(`${ign}: already exists`);
        continue;
      }

      const newId = crypto.randomUUID();
      const { error } = await supabase.from("clan_users").insert([{ 
        id: newId,
        ign,
        password,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      if (error) {
        results.push(`${ign}: ${error.message}`);
      } else {
        results.push(`${ign}: created`);
      }
    } catch (err) {
      results.push(`${ign}: ${err.message}`);
    }
  }

  statusEl.textContent = results.join(" | ");
  statusEl.className = "status-text success";
  document.getElementById("bulk-register-form").reset();
  loadUsers();
}

async function loadUsers() {
  const container = document.getElementById("users-list");
  const statusEl = document.getElementById("users-status");
  container.innerHTML = "<p>Loading users...</p>";

  try {
    const { data, error } = await supabase
      .from("clan_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No users yet.</p>";
      return;
    }

    container.innerHTML = data.map(user => `
      <div class="list-item" data-id="${user.id}">
        <div class="list-item-content">
          <div class="list-item-title">${escapeHtml(user.ign || "IGN not set")}</div>
          <div class="list-item-meta">
            Username / IGN: ${escapeHtml(user.ign || "Not set")} | 
            Joined: ${new Date(user.created_at).toLocaleDateString()}
          </div>
          <div class="list-item-text">
            Status: <strong style="color: ${user.is_active ? '#00ff88' : '#ff4444'};">
              ${user.is_active ? 'Active' : 'Inactive'}
            </strong>
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="changeUserPassword('${user.id}')">RESET PASSWORD</button>
          <button class="btn ${user.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUserStatus('${user.id}', ${!user.is_active})">
            ${user.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
          </button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading users: ${err.message}</p>`;
  }
}

async function toggleUserStatus(userId, isActive) {
  const action = isActive ? "activate" : "deactivate";
  const statusEl = document.getElementById("users-status");
  if (!confirm(`Are you sure you want to ${action} this user?`)) return;

  statusEl.textContent = `Updating user status...`;
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("clan_users")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;
    statusEl.textContent = `User ${action}d successfully.`;
    statusEl.className = "status-text success";
    loadUsers();
  } catch (err) {
    statusEl.textContent = `Error updating user: ${err.message}`;
    statusEl.className = "status-text error";
  }
}

async function changeUserPassword(userId) {
  const statusEl = document.getElementById("users-status");
  const newPassword = prompt("Enter a new password for this user:");

  if (!newPassword || newPassword.length < 6) {
    statusEl.textContent = "Password must be at least 6 characters.";
    statusEl.className = "status-text error";
    return;
  }

  statusEl.textContent = "Changing password...";
  statusEl.className = "status-text";

  try {
    let error = null;

    if (supabase.auth.admin && typeof supabase.auth.admin.updateUserById === "function") {
      const result = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
      error = result.error;
    } else {
      error = { message: "Admin password update is not available in the current client setup." };
    }

    if (error) {
      const fallback = await supabase
        .from("clan_users")
        .update({ password: newPassword, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (fallback.error) throw fallback.error;
    }

    statusEl.textContent = "Password updated successfully.";
    statusEl.className = "status-text success";
  } catch (err) {
    statusEl.textContent = `Error updating password: ${err.message}`;
    statusEl.className = "status-text error";
  }
}

/* Request Management */
async function loadRequests() {
  const container = document.getElementById("requests-list");
  container.innerHTML = "<p>Loading requests...</p>";

  try {
    const { data, error } = await supabase
      .from("item_requests")
      .select("*, items!inner(name), clan_users!inner(ign)")
      .neq("status", "done")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No requests yet.</p>";
      return;
    }

    container.innerHTML = data.map(req => `
      <div class="list-item" data-id="${req.id}">
        <div class="list-item-content">
          <div class="list-item-title">
            ${escapeHtml(req.clan_users.ign)} requested ${escapeHtml(req.items.name)} x${req.quantity}
          </div>
          <div class="list-item-meta">
            Requested: ${new Date(req.created_at).toLocaleString()}<br>
            Updated: ${new Date(req.updated_at || req.created_at).toLocaleString()}
          </div>
          <div class="list-item-text">
            Remaining quantity: <strong>${req.quantity}</strong><br>
            Status: <span class="request-status ${req.status}">${req.status.toUpperCase()}</span>
          </div>
        </div>
        <div class="list-item-actions">
          ${req.status === 'pending' ? `
            <button class="btn btn-success" onclick="approveRequest('${req.id}', ${req.quantity})">APPROVE 1</button>
            <button class="btn btn-danger" onclick="updateRequestStatus('${req.id}', 'denied')">DENY</button>
          ` : ''}
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading requests: ${err.message}</p>`;
  }
}

async function approveRequest(requestId, currentQuantity) {
  if (!confirm("Approve 1 unit from this request?")) return;

  const remainingQuantity = Math.max(0, currentQuantity - 1);
  const nextStatus = remainingQuantity === 0 ? "done" : "pending";

  try {
    const { error } = await supabase
      .from("item_requests")
      .update({
        quantity: remainingQuantity,
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) throw error;
    loadRequests();
  } catch (err) {
    alert(`Error updating request: ${err.message}`);
  }
}

async function updateRequestStatus(requestId, status) {
  const action = status === 'approved' ? 'approve' : 'deny';
  if (!confirm(`Are you sure you want to ${action} this request?`)) return;

  try {
    const { error } = await supabase
      .from("item_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (error) throw error;
    loadRequests();
  } catch (err) {
    alert(`Error updating request: ${err.message}`);
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

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    const isAuth = await checkAuth();
    if (isAuth) {
      loadAnnouncements();
      loadRules();
      loadItems();
      loadUsers();
      loadRequests();
    }
  }, 80);
});

window.setActiveModule = setActiveModule;
window.bulkRegisterMembers = bulkRegisterMembers;
window.toggleUserStatus = toggleUserStatus;
window.changeUserPassword = changeUserPassword;
window.approveRequest = approveRequest;
window.updateRequestStatus = updateRequestStatus;

window.postAnnouncement = postAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.postRule = postRule;
window.deleteRule = deleteRule;
window.addItem = addItem;
window.deleteItem = deleteItem;
window.toggleUserStatus = toggleUserStatus;
window.updateRequestStatus = updateRequestStatus;
window.logout = logout;
