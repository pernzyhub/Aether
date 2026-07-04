import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;

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

  if (!isAdminUser(user)) {
    await supabase.auth.signOut();
    window.location.href = "/admin-login.html";
    return false;
  }

  currentUser = user;
  document.getElementById("admin-welcome").textContent = `WELCOME, ${user.user_metadata?.full_name || user.email}`;
  return true;
}

function saveAnnouncementCache(items) {
  localStorage.setItem("aether_announcements_cache", JSON.stringify(items));
}

function saveRulesCache(items) {
  localStorage.setItem("aether_rules_cache", JSON.stringify(items));
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
      saveAnnouncementCache([]);
      container.innerHTML = "<p>No announcements yet.</p>";
      return;
    }

    saveAnnouncementCache(data);
    container.innerHTML = data.map(ann => `
      <div class="list-item compact" data-id="${ann.id}">
        <div class="list-item-content compact">
          <div class="list-item-title compact">
            ${escapeHtml(ann.title)}
            <span class="toggle-badge ${ann.is_active ? 'active' : 'inactive'}">${ann.is_active ? 'ON' : 'OFF'}</span>
          </div>
          <div class="list-item-meta">${new Date(ann.created_at).toLocaleString()}</div>
        </div>
        <div class="list-item-actions compact">
          <button class="btn-xs btn-secondary" onclick="editAnnouncement('${ann.id}')">EDIT</button>
          <button class="btn-xs btn-secondary" onclick="toggleAnnouncement('${ann.id}', ${!ann.is_active})">${ann.is_active ? 'HIDE' : 'SHOW'}</button>
          <button class="btn-xs btn-danger" onclick="deleteAnnouncement('${ann.id}')">DEL</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "";
    statusEl.textContent = "Error loading announcements: " + err.message;
    statusEl.className = "status-text error";
  }
}

let editingAnnouncementId = null;

async function postAnnouncement(event) {
  event.preventDefault();
  const title = document.getElementById("announcement-title").value;
  const statusEl = document.getElementById("announcements-status");

  statusEl.textContent = editingAnnouncementId ? "Updating announcement..." : "Posting announcement...";
  statusEl.className = "status-text";

  try {
    const content = document.getElementById("announcement-editor").innerHTML;
    let error;
    
    if (editingAnnouncementId) {
      const { error: updateError } = await supabase
        .from("announcements")
        .update({ title, content })
        .eq("id", editingAnnouncementId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("announcements")
        .insert([{ title, content, created_by: currentUser.id }]);
      error = insertError;
    }

    if (error) throw error;

    statusEl.textContent = editingAnnouncementId ? "Announcement updated successfully!" : "Announcement posted successfully!";
    statusEl.className = "status-text success";
    document.getElementById("announcement-form").reset();
    document.getElementById("announcement-editor").innerHTML = "";
    editingAnnouncementId = null;
    document.querySelector("#announcement-form button[type='submit']").textContent = "POST ANNOUNCEMENT";
    loadAnnouncements();
  } catch (err) {
    statusEl.textContent = "Error posting announcement: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function editAnnouncement(id) {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    document.getElementById("announcement-title").value = data.title;
    document.getElementById("announcement-editor").innerHTML = data.content || "";
    editingAnnouncementId = id;
    document.querySelector("#announcement-form button[type='submit']").textContent = "UPDATE ANNOUNCEMENT";
    
    // Scroll to form
    document.getElementById("announcement-form").scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert(`Error loading announcement: ${err.message}`);
  }
}

async function toggleAnnouncement(id, isActive) {
  const statusEl = document.getElementById("announcements-status");
  
  try {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) throw error;
    loadAnnouncements();
  } catch (err) {
    statusEl.textContent = "Error toggling: " + err.message;
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
      saveRulesCache([]);
      container.innerHTML = "<p>No rules yet.</p>";
      return;
    }

    saveRulesCache(data);
    container.innerHTML = data.map(rule => `
      <div class="list-item compact" data-id="${rule.id}">
        <div class="list-item-content compact">
          <div class="list-item-title compact">
            #${rule.order_num}: ${escapeHtml(rule.title)}
            <span class="toggle-badge ${rule.is_active ? 'active' : 'inactive'}">${rule.is_active ? 'ON' : 'OFF'}</span>
          </div>
        </div>
        <div class="list-item-actions compact">
          <button class="btn-xs btn-secondary" onclick="editRule('${rule.id}')">EDIT</button>
          <button class="btn-xs btn-secondary" onclick="toggleRule('${rule.id}', ${!rule.is_active})">${rule.is_active ? 'HIDE' : 'SHOW'}</button>
          <button class="btn-xs btn-danger" onclick="deleteRule('${rule.id}')">DEL</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "";
    statusEl.textContent = "Error loading rules: " + err.message;
    statusEl.className = "status-text error";
  }
}

let editingRuleId = null;

async function postRule(event) {
  event.preventDefault();
  const orderNum = parseInt(document.getElementById("rule-order").value);
  const title = document.getElementById("rule-title").value;
  const statusEl = document.getElementById("rules-status");

  statusEl.textContent = editingRuleId ? "Updating rule..." : "Adding rule...";
  statusEl.className = "status-text";

  try {
    const content = document.getElementById("rule-editor").innerHTML;
    let error;
    
    if (editingRuleId) {
      const { error: updateError } = await supabase
        .from("rules")
        .update({ order_num: orderNum, title, content })
        .eq("id", editingRuleId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("rules")
        .insert([{ order_num: orderNum, title, content, created_by: currentUser.id }]);
      error = insertError;
    }

    if (error) throw error;

    statusEl.textContent = editingRuleId ? "Rule updated successfully!" : "Rule added successfully!";
    statusEl.className = "status-text success";
    document.getElementById("rule-form").reset();
    document.getElementById("rule-editor").innerHTML = "";
    editingRuleId = null;
    document.querySelector("#rule-form button[type='submit']").textContent = "ADD RULE";
    loadRules();
  } catch (err) {
    statusEl.textContent = "Error adding rule: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function editRule(id) {
  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    document.getElementById("rule-order").value = data.order_num;
    document.getElementById("rule-title").value = data.title;
    document.getElementById("rule-editor").innerHTML = data.content || "";
    editingRuleId = id;
    document.querySelector("#rule-form button[type='submit']").textContent = "UPDATE RULE";
    
    // Scroll to form
    document.getElementById("rule-form").scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert(`Error loading rule: ${err.message}`);
  }
}

async function toggleRule(id, isActive) {
  const statusEl = document.getElementById("rules-status");
  
  try {
    const { error } = await supabase
      .from("rules")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) throw error;
    loadRules();
  } catch (err) {
    statusEl.textContent = "Error toggling: " + err.message;
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
let editingItemId = null;

async function addItem(event) {
  event.preventDefault();
  const name = document.getElementById("item-name").value;
  const description = document.getElementById("item-description").value;
  const statusEl = document.getElementById("items-status");

  statusEl.textContent = editingItemId ? "Updating item..." : "Adding item...";
  statusEl.className = "status-text";

  try {
    let error;
    if (editingItemId) {
      const { error: updateError } = await supabase
        .from("items")
        .update({ name, description })
        .eq("id", editingItemId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("items")
        .insert([{ name, description, created_by: currentUser.id }]);
      error = insertError;
    }

    if (error) throw error;

    statusEl.textContent = editingItemId ? "Item updated successfully!" : "Item added successfully!";
    statusEl.className = "status-text success";
    document.getElementById("item-form").reset();
    editingItemId = null;
    document.querySelector("#item-form button[type='submit']").textContent = "ADD ITEM";
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
      <div class="list-item compact" data-id="${item.id}">
        <div class="list-item-content compact">
          <div class="list-item-title compact">${escapeHtml(item.name)}</div>
          <div class="list-item-meta">${new Date(item.created_at).toLocaleString()}</div>
        </div>
        <div class="list-item-actions compact">
          <button class="btn-xs btn-secondary" onclick="editItem('${item.id}')">EDIT</button>
          <button class="btn-xs btn-danger" onclick="deleteItem('${item.id}')">DEL</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = "";
    statusEl.textContent = "Error loading items: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function editItem(id) {
  try {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    document.getElementById("item-name").value = data.name;
    document.getElementById("item-description").value = data.description || "";
    editingItemId = id;
    document.querySelector("#item-form button[type='submit']").textContent = "UPDATE ITEM";
    
    // Scroll to form
    document.getElementById("item-form").scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert(`Error loading item: ${err.message}`);
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
function createAuthEmailForIgn(ign) {
  const normalized = ign.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  const unique = crypto.randomUUID().slice(0, 8);
  return `${normalized || 'member'}_${unique}@aether.local`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  for (const [index, line] of lines.entries()) {
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

      const email = createAuthEmailForIgn(ign);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: ign }
        }
      });

      if (signUpError) {
        if (/rate limit|too many requests/i.test(signUpError.message)) {
          results.push(`${ign}: auth rate limit reached — slowing down and retrying later is recommended.`);
          break;
        }
        results.push(`${ign}: ${signUpError.message}`);
        continue;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        results.push(`${ign}: failed to create auth user`);
        continue;
      }

      const { error: updateError } = await supabase
        .from("clan_users")
        .update({ password, is_active: true, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (updateError) {
        results.push(`${ign}: ${updateError.message}`);
      } else {
        results.push(`${ign}: created`);
      }
    } catch (err) {
      results.push(`${ign}: ${err.message}`);
    }

    if (index < lines.length - 1) {
      await delay(900);
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
          <button class="btn btn-secondary" onclick="changeUserPassword('${user.id}')">CHANGE PASSWORD</button>
          <button class="btn btn-secondary" onclick="changeUserIgn('${user.id}', '${escapeHtml(user.ign || '')}')">CHANGE IGN</button>
          <button class="btn ${user.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUserStatus('${user.id}', ${!user.is_active})">
            ${user.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
          </button>
          <button class="btn btn-danger" onclick="deleteUser('${user.id}')">DELETE</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading users: ${err.message}</p>`;
  }
}

async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;
  const statusEl = document.getElementById("users-status");
  statusEl.textContent = "Deleting user...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase.rpc("admin_delete_clan_user", {
      target_user_id: userId
    });

    if (error) {
      if (/Could not find the function|function public\.admin_delete_clan_user/i.test(error.message)) {
        throw new Error("Supabase is missing the latest account-management migration. Run the newest migration and try again.");
      }
      throw error;
    }

    statusEl.textContent = "User deleted successfully.";
    statusEl.className = "status-text success";
    loadUsers();
  } catch (err) {
    statusEl.textContent = `Error deleting user: ${err.message}`;
    statusEl.className = "status-text error";
  }
}

async function changeUserIgn(userId, currentIgn) {
  const statusEl = document.getElementById("users-status");
  const newIgn = prompt("Enter a new IGN for this user:", currentIgn || "");

  if (!newIgn || newIgn.trim().length === 0) {
    statusEl.textContent = "IGN cannot be empty.";
    statusEl.className = "status-text error";
    return;
  }

  statusEl.textContent = "Updating IGN...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("clan_users")
      .update({ ign: newIgn.trim(), updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;
    statusEl.textContent = "IGN updated successfully.";
    statusEl.className = "status-text success";
    loadUsers();
  } catch (err) {
    statusEl.textContent = `Error updating IGN: ${err.message}`;
    statusEl.className = "status-text error";
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
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
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
    const { error } = await supabase
      .from("clan_users")
      .update({ password: newPassword, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;

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
    const { data: requests, error } = await supabase
      .from("item_requests")
      .select("*, items!inner(name)")
      .neq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      container.innerHTML = "<p>No requests yet.</p>";
      return;
    }

    // Fetch clan_users for all user_ids in the requests
    const userIds = [...new Set(requests.map(r => r.user_id))];
    const { data: users, error: usersError } = await supabase
      .from("clan_users")
      .select("id, ign")
      .in("id", userIds);

    if (usersError) throw usersError;

    // Create a map of user_id -> ign
    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = u.ign;
    });

    container.innerHTML = requests.map(req => {
      const ign = userMap[req.user_id] || "Unknown User";
      return `
      <div class="list-item compact" data-id="${req.id}">
        <div class="list-item-content compact">
          <div class="list-item-title compact">
            ${escapeHtml(ign)} → ${escapeHtml(req.items.name)} <span class="qty-badge">x${req.quantity}</span>
            <span class="status-badge ${req.status}">${req.status.toUpperCase()}</span>
          </div>
        </div>
        <div class="list-item-actions compact">
          <button class="btn-xs btn-secondary" onclick="adjustQuantity('${req.id}', ${req.quantity}, -1)">-1</button>
          <button class="btn-xs btn-secondary" onclick="adjustQuantity('${req.id}', ${req.quantity}, 1)">+1</button>
          <button class="btn-xs btn-success" onclick="markRequestDone('${req.id}')">APPROVE</button>
          <button class="btn-xs btn-danger" onclick="deleteRequest('${req.id}')">DEL</button>
        </div>
      </div>
    `}).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading requests: ${err.message}</p>`;
  }
}

async function adjustQuantity(requestId, currentQuantity, delta) {
  const newQuantity = Math.max(0, currentQuantity + delta);
  const nextStatus = newQuantity === 0 ? "approved" : "pending";

  try {
    const { error } = await supabase
      .from("item_requests")
      .update({
        quantity: newQuantity,
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

async function markRequestDone(requestId) {
  if (!confirm("Mark this request as approved?")) return;

  try {
    const { error } = await supabase
      .from("item_requests")
      .update({
        status: "approved",
        updated_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) throw error;
    loadRequests();
  } catch (err) {
    alert(`Error updating request: ${err.message}`);
  }
}

async function deleteRequest(requestId) {
  if (!confirm("Delete this request?")) return;

  try {
    const { error } = await supabase
      .from("item_requests")
      .delete()
      .eq("id", requestId);

    if (error) throw error;
    loadRequests();
  } catch (err) {
    alert(`Error deleting request: ${err.message}`);
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

function getAccessCode() {
  return localStorage.getItem("aether_access_code") || "AETHER2026";
}

function loadAccessCode() {
  const input = document.getElementById("current-access-code");
  if (input) input.value = getAccessCode();
}

async function updateAccessCode(event) {
  event.preventDefault();
  const statusEl = document.getElementById("access-code-status");
  const newCode = document.getElementById("new-access-code")?.value.trim();

  if (!newCode) {
    statusEl.textContent = "Please enter a valid access code.";
    statusEl.className = "status-text error";
    return;
  }

  localStorage.setItem("aether_access_code", newCode);
  loadAccessCode();
  document.getElementById("new-access-code").value = "";
  statusEl.textContent = "Access code updated.";
  statusEl.className = "status-text success";
}

function setAccountsTab(tabName) {
  const tabs = document.querySelectorAll('.account-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.accountTab === tabName);
  });

  const panels = document.querySelectorAll('.account-panel');
  panels.forEach(panel => {
    panel.classList.toggle('account-panel-active', panel.id === `account${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Panel`);
  });
}

async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout warning:", err);
  }
  localStorage.removeItem("aether_member_session");
  localStorage.removeItem("aether_access_granted");
  window.location.replace("/access-gate.html");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener("load", () => {
  setActiveModule("announcements");
  window.setTimeout(async () => {
    const isAuth = await checkAuth();
    if (isAuth) {
      loadAnnouncements();
      loadRules();
      loadItems();
      loadUsers();
      loadRequests();
      loadAccessCode();
      setAccountsTab('register');
    }
  }, 80);
});

window.setActiveModule = setActiveModule;
window.bulkRegisterMembers = bulkRegisterMembers;
window.toggleUserStatus = toggleUserStatus;
window.changeUserIgn = changeUserIgn;
window.changeUserPassword = changeUserPassword;
window.deleteUser = deleteUser;
window.adjustQuantity = adjustQuantity;
window.markRequestDone = markRequestDone;
window.deleteRequest = deleteRequest;
window.editAnnouncement = editAnnouncement;
window.editRule = editRule;
window.toggleAnnouncement = toggleAnnouncement;
window.toggleRule = toggleRule;
window.updateAccessCode = updateAccessCode;
window.loadAccessCode = loadAccessCode;
window.postAnnouncement = postAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.postRule = postRule;
window.deleteRule = deleteRule;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.logout = logout;
window.setAccountsTab = setAccountsTab;
