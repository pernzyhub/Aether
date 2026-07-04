import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;
let currentClanUser = null;
let editingRequestId = null;

function getMemberSession() {
  try {
    return JSON.parse(localStorage.getItem("aether_member_session"));
  } catch {
    return null;
  }
}

async function checkAuth() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  const memberSession = getMemberSession();
  
  if (!user && !memberSession) {
    window.location.href = "/";
    return false;
  }

  const userId = user?.id || memberSession?.id;

  // Load clan user data to check active status and IGN
  let { data: clanUser, error: clanUserError } = await supabase
    .from("clan_users")
    .select("*")
    .eq("id", userId)
    .single();

  // If clan user doesn't exist yet, create it!
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

    if (insertError) {
      console.error("Error creating clan user:", insertError);
      alert("Error loading your account information. Please try again later.");
      return false;
    } else {
      clanUser = newClanUser;
      clanUserError = null;
    }
  } else if (clanUserError) {
    console.error("Error loading clan user:", clanUserError);
    alert("Error loading your account information. Please try again later.");
    return false;
  }

  if (!clanUser.is_active) {
    alert("Your account is inactive. Please contact an admin.");
    return false;
  }

  if (!clanUser.ign) {
    alert("Please set your IGN in the portal first!");
    window.location.href = "/portal.html";
    return false;
  }

  currentUser = user || { id: memberSession?.id };
  currentClanUser = clanUser;
  
  const username = clanUser.ign || user?.user_metadata?.full_name || user?.email || memberSession?.ign || "MEMBER";
  const welcomeEl = document.getElementById("welcome-text");
  if (welcomeEl) {
    welcomeEl.textContent = `WELCOME, ${username.toUpperCase()}`;
  }

  return true;
}

async function loadItems() {
  const selectEl = document.getElementById("item-select");
  
  try {
    const { data, error } = await supabase
      .from("items")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      selectEl.innerHTML = '<option value="">No items available</option>';
      return;
    }

    selectEl.innerHTML = '<option value="">Select an item...</option>';
    data.forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      selectEl.appendChild(option);
    });
  } catch (err) {
    selectEl.innerHTML = '<option value="">Error loading items</option>';
    console.error(err);
  }
}

async function submitRequest(event) {
  event.preventDefault();
  
  const itemId = document.getElementById("item-select").value;
  const quantity = parseInt(document.getElementById("quantity").value);
  const notes = document.getElementById("notes").value;
  const statusEl = document.getElementById("request-status");

  if (!itemId) {
    statusEl.textContent = "Please select an item!";
    statusEl.className = "status-text error";
    return;
  }

  statusEl.textContent = editingRequestId ? "Updating request..." : "Submitting request...";
  statusEl.className = "status-text";

  try {
    if (editingRequestId) {
      const { error } = await supabase
        .from("item_requests")
        .update({
          item_id: itemId,
          quantity,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingRequestId);

      if (error) throw error;

      statusEl.textContent = "Request updated successfully!";
      editingRequestId = null;
    } else {
      const { error } = await supabase
        .from("item_requests")
        .insert([{ 
          user_id: currentUser.id, 
          item_id: itemId, 
          quantity: quantity,
          notes: notes || null,
          status: "pending"
        }]);

      if (error) throw error;

      statusEl.textContent = "Request submitted successfully!";
    }

    statusEl.className = "status-text success";
    document.getElementById("request-form").reset();
    document.getElementById("quantity").value = 1;
    updateRequestButtonLabel();
    loadMyRequests();
  } catch (err) {
    statusEl.textContent = editingRequestId ? "Error updating request: " + err.message : "Error submitting request: " + err.message;
    statusEl.className = "status-text error";
  }
}

function formatRequestTime(value) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function updateRequestButtonLabel() {
  const button = document.querySelector("#request-form button[type='submit']");
  if (button) {
    button.textContent = editingRequestId ? "UPDATE REQUEST" : "SUBMIT REQUEST";
  }
}

async function startEditRequest(requestId) {
  try {
    const { data, error } = await supabase
      .from("item_requests")
      .select("id, item_id, quantity, notes")
      .eq("id", requestId)
      .single();

    if (error) throw error;

    editingRequestId = requestId;
    document.getElementById("item-select").value = data.item_id;
    document.getElementById("quantity").value = data.quantity;
    document.getElementById("notes").value = data.notes || "";
    updateRequestButtonLabel();
    document.getElementById("request-status").textContent = "Editing request...";
    document.getElementById("request-status").className = "status-text";
  } catch (err) {
    alert("Unable to edit request: " + err.message);
  }
}

async function cancelRequest(requestId) {
  if (!confirm("Cancel this request permanently?")) return;

  try {
    const { error } = await supabase
      .from("item_requests")
      .delete()
      .eq("id", requestId);

    if (error) throw error;
    await loadMyRequests();
  } catch (err) {
    alert("Unable to cancel request: " + err.message);
  }
}

function formatQuantity(value) {
  return `${value} ${value === 1 ? "pc" : "pcs"}`;
}

function animateCountUp(elements) {
  elements.forEach((element) => {
    const target = Number(element.dataset.target || 0);
    if (!Number.isFinite(target)) return;

    const duration = 900;
    const startTime = performance.now();

    const tick = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(target * eased);
      element.textContent = currentValue;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        element.textContent = target;
      }
    };

    requestAnimationFrame(tick);
  });
}

function attachRequestSortHandler() {
  const sortEl = document.getElementById("request-sort");
  if (sortEl) {
    sortEl.addEventListener("change", () => loadMyRequests());
  }
}

async function loadMyRequests() {
  const container = document.getElementById("my-requests");
  const summaryContainer = document.getElementById("request-summary");
  container.innerHTML = '<p class="empty-state">Loading request feed...</p>';
  summaryContainer.innerHTML = '<p class="empty-state">Building summary...</p>';

  try {
    const { data, error } = await supabase
      .from("item_requests")
      .select("id, quantity, notes, status, created_at, user_id, items!inner(name)")
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="empty-state">No requests yet. Be the first to submit one.</p>';
      summaryContainer.innerHTML = '<p class="empty-state">No group summary available yet.</p>';
      return;
    }

    const sortEl = document.getElementById("request-sort");
    const selectedSort = sortEl?.value === "oldest" ? "oldest" : "newest";
    const sortedRequests = [...data].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return selectedSort === "oldest" ? timeA - timeB : timeB - timeA;
    });

    const userIds = [...new Set(sortedRequests.map(req => req.user_id).filter(Boolean))];
    let memberNames = new Map();

    if (userIds.length > 0) {
      const { data: clanUsers, error: clanError } = await supabase
        .from("clan_users")
        .select("id, ign")
        .in("id", userIds);

      if (!clanError && clanUsers) {
        memberNames = new Map(clanUsers.map(user => [user.id, user.ign || "Unknown Member"]));
      }
    }

    container.innerHTML = sortedRequests.map(req => {
      const memberName = memberNames.get(req.user_id) || "Unknown Member";
      const isOwner = req.user_id === currentUser?.id;
      return `
        <div class="request-entry" data-id="${req.id}">
          <div class="request-entry-main">
            <div class="request-entry-topline">
              <span class="member-name">${escapeHtml(memberName)}</span>
              <span class="request-time">${formatRequestTime(req.created_at)}</span>
            </div>
            <div class="request-copy">
              Requested ${formatQuantity(req.quantity)} of ${escapeHtml(req.items.name)}
              ${req.notes ? `<span class="request-note">${escapeHtml(req.notes)}</span>` : ""}
            </div>
          </div>
          <div class="request-entry-actions">
            <span class="request-status ${req.status || "pending"}">${(req.status || "pending").toUpperCase()}</span>
            ${isOwner && (req.status || "pending") === "pending" ? `
              <button class="btn btn-secondary" onclick="startEditRequest('${req.id}')">EDIT</button>
              <button class="btn btn-danger" onclick="cancelRequest('${req.id}')">CANCEL</button>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

    const groupedSummary = new Map();

    sortedRequests.forEach(req => {
      const itemName = req.items?.name || "Unknown Item";
      const memberName = memberNames.get(req.user_id) || "Unknown Member";
      const group = groupedSummary.get(itemName) || { itemName, total: 0, members: [] };
      const existingMember = group.members.find(member => member.name === memberName);

      if (existingMember) {
        existingMember.quantity += req.quantity;
      } else {
        group.members.push({ name: memberName, quantity: req.quantity });
      }

      group.total += req.quantity;
      groupedSummary.set(itemName, group);
    });

    const summaryGroups = Array.from(groupedSummary.values()).sort((a, b) => b.total - a.total);
    const topGroup = summaryGroups[0];
    const maxTotal = topGroup?.total || 1;

    const summaryMarkup = summaryGroups.map((group, index) => {
      const sortedMembers = [...group.members].sort((a, b) => b.quantity - a.quantity);
      const meterWidth = Math.max(16, Math.round((group.total / maxTotal) * 100));
      const isFeatured = index === 0 && topGroup;

      return `
        <div class="summary-card${isFeatured ? " summary-card--featured" : ""}">
          <div class="summary-card-top">
            <div>
              <div class="summary-item-name">${isFeatured ? "★ " : ""}${escapeHtml(group.itemName)}</div>
              <div class="summary-item-total"><span class="count-up" data-target="${group.total}">0</span> total requested</div>
            </div>
            <span class="summary-badge">${isFeatured ? "TOP" : `${sortedMembers.length} members`}</span>
          </div>
          <div class="summary-meter">
            <div class="summary-meter-bar" style="width: ${meterWidth}%;"></div>
          </div>
          <div class="summary-member-list">
            ${sortedMembers.map(member => `
              <div class="summary-member">
                <span>${escapeHtml(member.name)}</span>
                <strong><span class="count-up" data-target="${member.quantity}">0</span> ${member.quantity === 1 ? "pc" : "pcs"}</strong>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");

    summaryContainer.innerHTML = summaryMarkup;
    animateCountUp(summaryContainer.querySelectorAll(".count-up"));
  } catch (err) {
    container.innerHTML = `<p class="empty-state error">Error loading requests: ${err.message}</p>`;
    summaryContainer.innerHTML = `<p class="empty-state error">Summary unavailable.</p>`;
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
      attachRequestSortHandler();
      loadItems();
      loadMyRequests();
    }
  }, 80);
});

window.submitRequest = submitRequest;
window.logout = logout;
window.startEditRequest = startEditRequest;
window.cancelRequest = cancelRequest;
