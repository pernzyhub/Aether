import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;

function isHiddenAdminAccount(user) {
  const ign = typeof user?.ign === 'string' ? user.ign.trim().toLowerCase() : '';
  const id = typeof user?.id === 'string' ? user.id : '';
  return ign === 'adminpernzy' || id === 'fec85282-b333-4625-b482-b398e0506218';
}

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

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formattedDate = formatDate(date);
  const formattedTime = formatTime(date);
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
  return isMidnight ? formattedDate : `${formattedDate} ${formattedTime}`;
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
    window.location.replace("/admin-login.html");
    return false;
  }

  if (!isAdminUser(user)) {
    console.warn("Non-admin session detected on admin dashboard. Redirecting to login without forcing sign-out.");
    window.location.replace("/admin-login.html");
    return false;
  }

  currentUser = user;
  const welcomeEl = document.getElementById("admin-welcome");
  if (welcomeEl) {
    welcomeEl.textContent = `WELCOME, ${user.user_metadata?.full_name || user.email}`;
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("clan_users")
      .select("id, ign, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    if (existing) {
      if (existing.is_active === false) {
        const { error: updateError } = await supabase
          .from("clan_users")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        if (updateError) throw updateError;
      }
    } else {
      const ign = user.user_metadata?.full_name || user.user_metadata?.name || user.email || null;
      const { error: insertError } = await supabase
        .from("clan_users")
        .insert([{
          id: user.id,
          ign,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      if (insertError) throw insertError;
    }
  } catch (err) {
    console.warn("Unable to auto-heal admin clan_users profile:", err?.message || err);
  }

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

    showStatus("announcements-status", editingAnnouncementId ? "Announcement updated successfully!" : "Announcement posted successfully!", "success");
    document.getElementById("announcement-form").reset();
    document.getElementById("announcement-editor").innerHTML = "";
    editingAnnouncementId = null;
    document.querySelector("#announcement-form button[type='submit']").textContent = "POST ANNOUNCEMENT";
    loadAnnouncements();
  } catch (err) {
    showStatus("announcements-status", "Error posting announcement: " + err.message, "error");
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
    showStatus("announcements-status", "Announcement deleted!", "success");
    loadAnnouncements();
  } catch (err) {
    showStatus("announcements-status", "Error deleting: " + err.message, "error");
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

    showStatus("rules-status", editingRuleId ? "Rule updated successfully!" : "Rule added successfully!", "success");
    document.getElementById("rule-form").reset();
    document.getElementById("rule-editor").innerHTML = "";
    editingRuleId = null;
    document.querySelector("#rule-form button[type='submit']").textContent = "ADD RULE";
    loadRules();
  } catch (err) {
    showStatus("rules-status", "Error adding rule: " + err.message, "error");
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
    showStatus("rules-status", "Rule deleted!", "success");
    loadRules();
  } catch (err) {
    showStatus("rules-status", "Error deleting: " + err.message, "error");
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

    showStatus("items-status", editingItemId ? "Item updated successfully!" : "Item added successfully!", "success");
    document.getElementById("item-form").reset();
    editingItemId = null;
    document.querySelector("#item-form button[type='submit']").textContent = "ADD ITEM";
    loadItems();
  } catch (err) {
    showStatus("items-status", "Error adding item: " + err.message, "error");
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

    container.innerHTML = `<ul class="item-list">` + data.map(item => `
      <li class="item-list-item">
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-date">${new Date(item.created_at).toLocaleDateString()}</span>
        <div class="item-actions">
          <button class="btn-xs btn-secondary" onclick="editItem('${item.id}')">EDIT</button>
          <button class="btn-xs btn-danger" onclick="deleteItem('${item.id}')">DEL</button>
        </div>
      </li>
    `).join("") + `</ul>`;
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
    showStatus("items-status", "Item deleted!", "success");
    loadItems();
  } catch (err) {
    showStatus("items-status", "Error deleting item: " + err.message, "error");
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

    const visibleUsers = (data || []).filter((user) => !isHiddenAdminAccount(user) && user.id !== currentUser?.id && user.is_hidden_from_members !== true);

    if (visibleUsers.length === 0) {
      container.innerHTML = "<p>No users yet.</p>";
      return;
    }

    container.innerHTML = visibleUsers.map(user => `
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
          ${user.id === currentUser?.id
            ? `<button class="btn btn-secondary" disabled title="Cannot change your own status">SIGNED IN</button>`
            : `<button class="btn ${user.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleUserStatus('${user.id}', ${!user.is_active})">
                ${user.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
              </button>`
          }
          ${user.id === currentUser?.id ?
            `<button class="btn btn-danger" disabled title="Cannot delete the signed-in admin">DELETE</button>` :
            `<button class="btn btn-danger" onclick="deleteUser('${user.id}')">DELETE</button>`
          }
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

    showStatus("users-status", "User deleted successfully.", "success");
    loadUsers();
  } catch (err) {
    showStatus("users-status", `Error deleting user: ${err.message}`, "error");
  }
}

async function changeUserIgn(userId, currentIgn) {
  const statusEl = document.getElementById("users-status");
  const newIgn = prompt("Enter a new IGN for this user:", currentIgn || "");

  if (!newIgn || newIgn.trim().length === 0) {
    showStatus("users-status", "IGN cannot be empty.", "error");
    return;
  }

  statusEl.textContent = "Updating IGN...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase.rpc("admin_update_clan_user_ign", {
      target_user_id: userId,
      new_ign: newIgn.trim()
    });

    if (error) {
      if (/Could not find the function|function public\.admin_update_clan_user_ign/i.test(error.message)) {
        throw new Error("Supabase is missing the latest account-management migration. Run the newest migration and try again.");
      }
      throw error;
    }

    showStatus("users-status", "IGN updated successfully.", "success");
    loadUsers();
  } catch (err) {
    showStatus("users-status", `Error updating IGN: ${err.message}`, "error");
  }
}

async function toggleUserStatus(userId, isActive) {
  const action = isActive ? "activate" : "deactivate";
  const statusEl = document.getElementById("users-status");
  if (!confirm(`Are you sure you want to ${action} this user?`)) return;

  statusEl.textContent = `Updating user status...`;
  statusEl.className = "status-text";

  try {
    const { error } = await supabase.rpc("admin_toggle_clan_user_status", {
      target_user_id: userId,
      new_status: isActive
    });

    if (error) {
      if (/Could not find the function|function public\.admin_toggle_clan_user_status/i.test(error.message)) {
        throw new Error("Supabase is missing the latest account-management migration. Run the newest migration and try again.");
      }
      throw error;
    }

    showStatus("users-status", `User ${action}d successfully.`, "success");
    loadUsers();
  } catch (err) {
    showStatus("users-status", `Error updating user: ${err.message}`, "error");
  }
}

async function changeUserPassword(userId) {
  const statusEl = document.getElementById("users-status");
  const newPassword = prompt("Enter a new password for this user:");

  if (!newPassword || newPassword.length < 6) {
    showStatus("users-status", "Password must be at least 6 characters.", "error");
    return;
  }

  statusEl.textContent = "Changing password...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase.rpc("admin_update_clan_user_password", {
      target_user_id: userId,
      new_password: newPassword
    });

    if (error) {
      if (/Could not find the function|function public\.admin_update_clan_user_password/i.test(error.message)) {
        throw new Error("Supabase is missing the latest account-management migration. Run the newest migration and try again.");
      }
      throw error;
    }

    showStatus("users-status", "Password updated successfully.", "success");
  } catch (err) {
    showStatus("users-status", `Error updating password: ${err.message}`, "error");
  }
}

async function createUser() {
  const statusEl = document.getElementById("create-user-status");
  const userId = crypto.randomUUID();
  const ign = document.getElementById("new-user-ign").value.trim();
  const role = document.querySelector('input[name="new-user-role"]:checked')?.value || 'member';

  if (!ign) {
    showStatus("create-user-status", "IGN is required.", "error");
    return;
  }

  if (!['member', 'superuser'].includes(role)) {
    showStatus("create-user-status", "Role must be Member or Superuser.", "error");
    return;
  }

  const isActive = document.getElementById("new-user-active")?.checked ?? true;

  statusEl.textContent = "Creating user...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase.rpc("admin_create_clan_user", {
      user_id: userId,
      ign: ign,
      role: role,
      is_active: isActive
    });

    if (error) {
      if (/Could not find the function|function public\.admin_create_clan_user/i.test(error.message)) {
        throw new Error("Supabase is missing the latest account-management migration. Run the newest migration and try again.");
      }
      throw error;
    }

    showStatus("create-user-status", "User created successfully.", "success");
    document.getElementById("create-user-form").reset();
    loadUsers();
  } catch (err) {
    showStatus("create-user-status", `Error creating user: ${err.message}`, "error");
  }
}

/* Request Management */
async function loadRequests() {
  const container = document.getElementById("requests-list");
  container.innerHTML = "<p>Loading requests...</p>";

  try {
    const { data: requests, error } = await supabase
      .from("item_requests")
      .select("*, items!inner(name), proof_image")
      .in("status", ["pending"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      container.innerHTML = "<p>No pending requests.</p>";
    } else {
      renderRequests(requests, container);
    }
    
    loadRequestsHistory();
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading requests: ${err.message}</p>`;
  }
}

async function loadRequestsHistory() {
  const container = document.getElementById("requests-history-list");
  container.innerHTML = "<p>Loading history...</p>";

  try {
    const { data: requests, error } = await supabase
      .from("item_requests")
      .select("*, items!inner(name), proof_image")
      .in("status", ["approved", "denied"])
      .order("updated_at", { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      container.innerHTML = "<p>No history yet.</p>";
    } else {
      renderRequests(requests, container, true);
    }
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading history: ${err.message}</p>`;
  }
}

async function renderRequests(requests, container, isHistory = false) {
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
    const requestedQty = Number(req.requested_quantity ?? req.quantity ?? 1);
    const remainingQty = Math.max(0, Number(req.quantity ?? 0));
    const fulfilledQty = Math.max(0, requestedQty - remainingQty);
    const isDone = remainingQty === 0;
    const stateBadgeClass = isDone ? "approved" : (fulfilledQty > 0 ? "partial" : "pending");
    const stateLabel = isDone ? "FULFILLED" : (fulfilledQty > 0 ? "PARTIAL" : "PENDING");
    const storedStatus = (req.status || 'pending');
    const displayClass = (storedStatus === 'approved' || remainingQty === 0) ? 'approved' : storedStatus;
    const displayText = displayClass === 'approved' ? 'FULFILLED' : displayClass.toUpperCase();
    return `
      <div class="list-item compact ${isDone ? 'completed' : ''}" data-id="${req.id}">
        <div class="list-item-content compact">
          <div class="list-item-title compact">
            ${escapeHtml(ign)} → ${escapeHtml(req.items.name)} <span class="qty-badge">${remainingQty}/${requestedQty}</span>
            <span class="status-badge ${displayClass}">${displayText}</span>
            <span class="request-state-badge ${stateBadgeClass}">${stateLabel}</span>
          </div>
          <div class="request-progress-inline">${fulfilledQty} fulfilled • ${remainingQty} remaining</div>
          ${req.proof_image ? `
            <div class="request-proof">
              <button class="proof-link" onclick="openImageModal('${escapeHtml(req.proof_image)}')">
                <img src="${escapeHtml(req.proof_image)}" alt="Proof image" class="proof-thumbnail" />
                <span class="proof-label">View Proof</span>
              </button>
            </div>
          ` : ''}
        </div>
        ${!isHistory ? `
        <div class="list-item-actions compact">
          <button class="btn-xs btn-secondary" onclick="adjustQuantity('${req.id}', ${req.quantity}, ${requestedQty}, -1)">-1</button>
          <button class="btn-xs btn-secondary" onclick="adjustQuantity('${req.id}', ${req.quantity}, ${requestedQty}, 1)">+1</button>
          <button class="btn-xs btn-success" onclick="markRequestDone('${req.id}')">FULFILL</button>
          <button class="btn-xs btn-danger" onclick="rejectRequest('${req.id}')">REJECT</button>
          <button class="btn-xs btn-danger" onclick="deleteRequest('${req.id}')">DEL</button>
        </div>
        ` : ''}
      </div>
    `}).join("");
}

async function adjustQuantity(requestId, currentQuantity, requestedQty, delta) {
  const curRemaining = Number(currentQuantity || 0);
  const origRequested = Number(requestedQty || 0);
  // Cap increases so admin cannot raise the remaining quantity above the original requested amount
  let newQuantity = curRemaining + delta;
  newQuantity = Math.max(0, newQuantity);
  newQuantity = Math.min(newQuantity, origRequested);
  const nextStatus = newQuantity === 0 ? "approved" : "pending";

  try {
    const { error } = await supabase
      .from("item_requests")
      .update({
        quantity: newQuantity,
        requested_quantity: origRequested,
        status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error) {
      if (/requested_quantity|column .*does not exist/i.test(error.message)) {
        const { error: retryError } = await supabase
          .from("item_requests")
          .update({
            quantity: newQuantity,
            status: nextStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", requestId);

        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }

    loadRequests();
  } catch (err) {
    alert(`Error updating request: ${err.message}`);
  }
}

async function markRequestDone(requestId) {
  if (!confirm("Mark this request as fulfilled?")) return;

  try {
    // Try to fetch requested_quantity, but gracefully handle older schemas
    let requestedQty = 1;
    try {
      const { data: request, error: fetchError } = await supabase
        .from("item_requests")
        .select("requested_quantity, quantity")
        .eq("id", requestId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!request) throw new Error("Request not found.");
      requestedQty = Number(request.requested_quantity ?? request.quantity ?? 1);
    } catch (fetchErr) {
      if (!/requested_quantity|column .*does not exist/i.test(fetchErr.message)) {
        throw fetchErr;
      }
      // fallback: fetch just quantity
      const { data: req2, error: fetchError2 } = await supabase
        .from("item_requests")
        .select("quantity")
        .eq("id", requestId)
        .maybeSingle();
      if (fetchError2) throw fetchError2;
      if (!req2) throw new Error("Request not found.");
      requestedQty = Number(req2.quantity ?? 1);
    }

    // Attempt update; if the column doesn't exist, retry without it
    let { error } = await supabase
      .from("item_requests")
      .update({
        quantity: 0,
        requested_quantity: requestedQty,
        status: "approved",
        updated_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (error && /requested_quantity|column .*does not exist/i.test(error.message)) {
      ({ error } = await supabase
        .from("item_requests")
        .update({
          quantity: 0,
          status: "approved",
          updated_at: new Date().toISOString()
        })
        .eq("id", requestId));
    }

    if (error) throw error;
    loadRequests();
  } catch (err) {
    alert(`Error updating request: ${err.message}`);
  }
}

async function rejectRequest(requestId) {
  if (!confirm("Reject this request?")) return;

  try {
    const { error } = await supabase
      .from("item_requests")
      .update({
        status: "denied",
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

async function adminLogout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout warning:", err);
  }
  localStorage.removeItem("aether_member_session");
  window.location.replace("/index.html?view=public");
}

// Backwards-compatible wrapper: some pages use an inline `logout()` handler.
// Keep this in place so older inline onclick="logout()" calls don't throw.
async function logout() {
  try {
    console.debug('[admin] logout wrapper invoked');
    await adminLogout();
  } catch (err) {
    console.warn('logout wrapper error:', err);
    // Fallback: attempt a minimal sign-out and redirect
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    localStorage.removeItem('aether_member_session');
    window.location.replace('/index.html?view=public');
  }
}
window.logout = logout;

// Debug: watch storage and auth events to diagnose unexpected sign-outs
try {
  window.addEventListener('storage', (e) => {
    if (!e) return;
    if (e.key === 'aether_member_session') {
      console.debug('[admin] storage event: aether_member_session changed', { oldValue: e.oldValue, newValue: e.newValue });
    }
  });
} catch (e) {}

try {
  supabase.auth.onAuthStateChange((event, session) => {
    console.debug('[admin] supabase auth state change', { event, hasSession: !!session?.user, session });
  });
} catch (e) {}

function navigateToFrontPage(event) {
  if (event) {
    event.preventDefault();
  }
  console.debug('[admin] navigateToFrontPage invoked - opening public front page in current tab');
  window.location.href = '/index.html?view=public&preview=admin';
}

function showStatus(elementId, message, type = 'success') {
  const statusEl = document.getElementById(elementId);
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.className = `status-text ${type}`;
  
  // Auto-fade after 2.5 seconds
  setTimeout(() => {
    statusEl.style.opacity = '0';
    statusEl.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.style.opacity = '1';
      statusEl.className = 'status-text';
    }, 500);
  }, 2500);
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
      attachEditorUploadHandlers();
      setAccountsTab('register');
    }
  }, 80);
});

window.setActiveModule = setActiveModule;
window.applyEditorCommand = applyEditorCommand;
window.bulkRegisterMembers = bulkRegisterMembers;
window.adminLogout = adminLogout;
window.navigateToFrontPage = navigateToFrontPage;
window.toggleUserStatus = toggleUserStatus;
window.changeUserIgn = changeUserIgn;
window.changeUserPassword = changeUserPassword;
window.deleteUser = deleteUser;
window.adjustQuantity = adjustQuantity;
window.markRequestDone = markRequestDone;
window.rejectRequest = rejectRequest;
window.editAnnouncement = editAnnouncement;
window.editRule = editRule;
window.toggleAnnouncement = toggleAnnouncement;
window.toggleRule = toggleRule;
window.postAnnouncement = postAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.postRule = postRule;
window.deleteRule = deleteRule;
window.editItem = editItem;
window.deleteItem = deleteItem;
window.logout = logout;
window.setAccountsTab = setAccountsTab;
window.openImageModal = openImageModal;
window.createUser = createUser;

// Create user form handler
document.getElementById("create-user-form").addEventListener("submit", (e) => {
  e.preventDefault();
  createUser();
});

// Image Modal Functions
function openImageModal(imageSrc) {
  const modal = document.getElementById("image-modal");
  const modalImage = document.getElementById("modal-image");
  modalImage.src = imageSrc;
  modal.classList.add("show");
}

// Close modal when clicking the X button
document.querySelector(".modal-close").addEventListener("click", () => {
  document.getElementById("image-modal").classList.remove("show");
});

// Close modal when clicking outside the image
document.getElementById("image-modal").addEventListener("click", (e) => {
  if (e.target.id === "image-modal") {
    document.getElementById("image-modal").classList.remove("show");
  }
});

/* Event Management */
async function loadEvents() {
  const container = document.getElementById("events-list");
  container.innerHTML = "<p>Loading events...</p>";

  try {
    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: false });

    if (error) throw error;

    if (!events || events.length === 0) {
      container.innerHTML = "<p>No events yet.</p>";
      return;
    }

    container.innerHTML = events.map(event => `
      <div class="list-item ${!event.is_active ? 'completed' : ''}" data-id="${event.id}">
        <div class="list-item-content">
          <div class="list-item-title">${escapeHtml(event.name)} <span class="qty-badge">${event.points} pts</span></div>
          <div class="list-item-meta">
            ${event.description ? escapeHtml(event.description) : 'No description'}
            ${event.event_date ? `| Date: ${escapeHtml(formatDateTime(event.event_date))}` : ''}
          </div>
          <div class="list-item-text">
            Status: <strong style="color: ${event.is_active ? '#00ff88' : '#ff4444'};">
              ${event.is_active ? 'Active' : 'Inactive'}
            </strong>
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="editEvent('${event.id}')">EDIT</button>
          <button class="btn ${event.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleEventStatus('${event.id}', ${!event.is_active})">
            ${event.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
          </button>
          <button class="btn btn-danger" onclick="deleteEvent('${event.id}')">DELETE</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading events: ${err.message}</p>`;
  }
}

async function createEvent(e) {
  e.preventDefault();
  const statusEl = document.getElementById("event-status");
  const name = document.getElementById("event-name").value.trim();
  const description = document.getElementById("event-description").value.trim();
  const points = parseInt(document.getElementById("event-points").value);
  const eventDate = document.getElementById("event-date").value;
  const eventMonthYear = eventDate ? eventDate.slice(0, 7) : null;

  if (!name || isNaN(points)) {
    showStatus("event-status", "Event name and points are required.", "error");
    return;
  }

  statusEl.textContent = "Creating event...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("events")
      .insert([{
        name,
        description: description || null,
        points,
        event_date: eventDate || null,
        month_year: eventMonthYear,
        is_active: true
      }]);

    if (error) throw error;

    showStatus("event-status", "Event created successfully.", "success");
    document.getElementById("event-form").reset();
    loadEvents();
  } catch (err) {
    showStatus("event-status", `Error creating event: ${err.message}`, "error");
  }
}

async function editEvent(eventId) {
  const statusEl = document.getElementById("events-status");
  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) {
    showStatus("events-status", `Error loading event: ${error.message}`, "error");
    return;
  }

  const newName = prompt("Enter new event name:", event.name);
  if (!newName) return;

  const newDescription = prompt("Enter new description:", event.description || "");
  const newPoints = prompt("Enter new points:", event.points);
  const newDate = prompt("Enter new event date (YYYY-MM-DD HH:MM):", event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : "");

  statusEl.textContent = "Updating event...";
  statusEl.className = "status-text";

  try {
    const { error: updateError } = await supabase
      .from("events")
      .update({
        name: newName,
        description: newDescription || null,
        points: parseInt(newPoints) || 0,
        event_date: newDate || null,
        month_year: newDate ? newDate.slice(0, 7) : event.month_year || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", eventId);

    if (updateError) throw updateError;

    showStatus("events-status", "Event updated successfully.", "success");
    loadEvents();
  } catch (err) {
    showStatus("events-status", `Error updating event: ${err.message}`, "error");
  }
}

async function toggleEventStatus(eventId, isActive) {
  const action = isActive ? "activate" : "deactivate";
  const statusEl = document.getElementById("events-status");
  if (!confirm(`Are you sure you want to ${action} this event?`)) return;

  statusEl.textContent = `Updating event status...`;
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("events")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", eventId);

    if (error) throw error;
    showStatus("events-status", `Event ${action}d successfully.`, "success");
    loadEvents();
  } catch (err) {
    showStatus("events-status", `Error updating event: ${err.message}`, "error");
  }
}

async function deleteEvent(eventId) {
  if (!confirm("Are you sure you want to delete this event?")) return;
  const statusEl = document.getElementById("events-status");
  statusEl.textContent = "Deleting event...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (error) throw error;
    showStatus("events-status", "Event deleted successfully.", "success");
    loadEvents();
  } catch (err) {
    showStatus("events-status", `Error deleting event: ${err.message}`, "error");
  }
}

async function loadAttendance() {
  const container = document.getElementById("attendance-list");
  container.innerHTML = "<p>Loading attendance...</p>";

  try {
    const { data: attendance, error } = await supabase
      .from("attendance")
      .select("*, events(name, points), clan_users(ign)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!attendance || attendance.length === 0) {
      container.innerHTML = "<p>No attendance records yet.</p>";
      return;
    }

    container.innerHTML = attendance.map(record => `
      <div class="list-item ${record.attended ? '' : 'completed'}" data-id="${record.id}">
        <div class="list-item-content">
          <div class="list-item-title">${escapeHtml(record.clan_users.ign)} → ${escapeHtml(record.events.name)}</div>
          <div class="list-item-meta">
            Points: ${record.points_awarded} / ${record.events.points}
          </div>
          <div class="list-item-text">
            Status: <strong style="color: ${record.attended ? '#00ff88' : '#ff4444'};">
              ${record.attended ? 'Attended' : 'Not Attended'}
            </strong>
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn ${record.attended ? 'btn-danger' : 'btn-success'}" onclick="toggleAttendance('${record.id}', ${!record.attended})">
            ${record.attended ? 'MARK ABSENT' : 'MARK ATTENDED'}
          </button>
          <button class="btn btn-secondary" onclick="editAttendancePoints('${record.id}', ${record.points_awarded})">EDIT POINTS</button>
          <button class="btn btn-danger" onclick="deleteAttendance('${record.id}')">DELETE</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading attendance: ${err.message}</p>`;
  }
}

async function toggleAttendance(attendanceId, attended) {
  const action = attended ? "mark as attended" : "mark as absent";
  const statusEl = document.getElementById("attendance-status");
  statusEl.textContent = `Updating attendance...`;
  statusEl.className = "status-text";

  try {
    const { data: record, error: fetchError } = await supabase
      .from("attendance")
      .select("*, events(points)")
      .eq("id", attendanceId)
      .single();

    if (fetchError) throw fetchError;

    const pointsAwarded = attended ? record.events.points : 0;

    const { error } = await supabase
      .from("attendance")
      .update({
        attended,
        points_awarded: pointsAwarded,
        updated_at: new Date().toISOString()
      })
      .eq("id", attendanceId);

    if (error) throw error;
    showStatus("attendance-status", `Attendance ${action} successfully.`, "success");
    loadAttendance();
  } catch (err) {
    showStatus("attendance-status", `Error updating attendance: ${err.message}`, "error");
  }
}

async function editAttendancePoints(attendanceId, currentPoints) {
  const statusEl = document.getElementById("attendance-status");
  const newPoints = prompt("Enter new points awarded:", currentPoints);

  if (newPoints === null || isNaN(parseInt(newPoints))) {
    showStatus("attendance-status", "Invalid points value.", "error");
    return;
  }

  statusEl.textContent = "Updating points...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("attendance")
      .update({
        points_awarded: parseInt(newPoints),
        updated_at: new Date().toISOString()
      })
      .eq("id", attendanceId);

    if (error) throw error;
    showStatus("attendance-status", "Points updated successfully.", "success");
    loadAttendance();
  } catch (err) {
    showStatus("attendance-status", `Error updating points: ${err.message}`, "error");
  }
}

async function deleteAttendance(attendanceId) {
  if (!confirm("Are you sure you want to delete this attendance record?")) return;
  const statusEl = document.getElementById("attendance-status");
  statusEl.textContent = "Deleting attendance record...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("id", attendanceId);

    if (error) throw error;
    showStatus("attendance-status", "Attendance record deleted successfully.", "success");
    loadAttendance();
  } catch (err) {
    showStatus("attendance-status", `Error deleting attendance: ${err.message}`, "error");
  }
}
