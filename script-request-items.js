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

async function checkAuth() {
  await ensureSupabaseSession();
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

  // IGN is optional now, fall back to available profile values.
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
  selectEl.innerHTML = '<option value="">Loading items...</option>';
  
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
  const proofImageInput = document.getElementById("proof-image");
  const statusEl = document.getElementById("request-status");

  if (!itemId) {
    statusEl.textContent = "Please select an item!";
    statusEl.className = "status-text error";
    return;
  }

  let proofImageUrl = null;
  if (proofImageInput.files && proofImageInput.files[0]) {
    const file = proofImageInput.files[0];
    const reader = new FileReader();
    
    await new Promise((resolve, reject) => {
      reader.onload = () => {
        proofImageUrl = reader.result;
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  statusEl.textContent = editingRequestId ? "Updating request..." : "Submitting request...";
  statusEl.className = "status-text";

  try {
    if (editingRequestId) {
      const requestUserId = currentUser?.id || currentClanUser?.id || null;
      if (!requestUserId) {
        statusEl.textContent = "Your account session could not be verified. Please log in again.";
        statusEl.className = "status-text error";
        return;
      }

      const { error } = await supabase.rpc("update_item_request", {
        target_request_id: editingRequestId,
        target_user_id: requestUserId,
        target_item_id: itemId,
        target_quantity: quantity,
        target_notes: notes || null
      });

      if (error) throw error;

      statusEl.textContent = "Request updated successfully!";
      editingRequestId = null;
      document.getElementById("request-form").reset();
      document.getElementById("quantity").value = 1;
    } else {
      const requestUserId = currentUser?.id || currentClanUser?.id || null;
      if (!requestUserId) {
        statusEl.textContent = "Your account session could not be verified. Please log in again.";
        statusEl.className = "status-text error";
        return;
      }

      let { error } = await supabase.rpc("create_item_request", {
        target_user_id: requestUserId,
        target_item_id: itemId,
        target_quantity: quantity,
        target_notes: notes || null
      });

      if (error && /Could not find the function|function public\.create_item_request/i.test(error.message)) {
        const fallback = await supabase.functions.invoke("create-request", {
          body: {
            user_id: requestUserId,
            item_id: itemId,
            quantity,
            notes: notes || null,
            status: "pending"
          }
        });

        error = fallback.error;

        if (!error && fallback.data?.error) {
          error = new Error(fallback.data.error);
        }
      }

      if (error) {
        if (/row-level security|permission denied/i.test(error.message)) {
          throw new Error("Your session could not be authorized to create requests. Please log out and sign in again.");
        }
        if (/Failed to send a request to the Edge Function|non-2xx status code/i.test(error.message)) {
          throw new Error("The request service is unavailable right now. Deploy the Supabase create-request function or restore the latest request RPC.");
        }
        throw error;
      }

      statusEl.textContent = "Request submitted successfully!";
      document.getElementById("request-form").reset();
      document.getElementById("quantity").value = 1;
    }

    statusEl.className = "status-text success";
    updateRequestButtonLabel();
    await loadMyRequests();
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
    document.getElementById("request-status").textContent = "Editing request. Update the fields, then save your changes.";
    document.getElementById("request-status").className = "status-text";
  } catch (err) {
    alert("Unable to edit request: " + err.message);
  }
}

async function cancelRequest(requestId) {
  if (!confirm("Cancel this request permanently?")) return;
  const statusEl = document.getElementById("request-status");
  statusEl.textContent = "Canceling request...";
  statusEl.className = "status-text";

  try {
    const requestUserId = currentUser?.id || currentClanUser?.id || null;
    if (!requestUserId) {
      throw new Error("Your account session could not be verified. Please log in again.");
    }

    const { error } = await supabase.rpc("cancel_item_request", {
      target_request_id: requestId,
      target_user_id: requestUserId
    });

    if (error) throw error;
    if (editingRequestId === requestId) {
      editingRequestId = null;
      document.getElementById("request-form").reset();
      document.getElementById("quantity").value = 1;
      updateRequestButtonLabel();
    }
    statusEl.textContent = "Request canceled successfully.";
    statusEl.className = "status-text success";
    await loadMyRequests();
  } catch (err) {
    statusEl.textContent = "Unable to cancel request: " + err.message;
    statusEl.className = "status-text error";
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
  const filterEl = document.getElementById("request-filter");
  const summarySelect = document.getElementById("summary-select");
  
  if (sortEl) {
    sortEl.addEventListener("change", () => loadMyRequests());
  }
  if (filterEl) {
    filterEl.addEventListener("change", () => loadMyRequests());
  }
  if (summarySelect) {
    summarySelect.addEventListener("change", () => loadMyRequests());
  }
}

async function loadMyRequests() {
  const container = document.getElementById("my-requests");
  const summaryContainer = document.getElementById("request-summary");
  container.innerHTML = '<p class="empty-state">Loading request feed...</p>';
  summaryContainer.innerHTML = '<p class="empty-state">Building summary...</p>';

  const filterEl = document.getElementById("request-filter");
  const selectedFilter = filterEl?.value || "all";

  try {
    let query = supabase
      .from("item_requests")
      .select("id, quantity, notes, status, created_at, user_id, items!inner(name)")
      .order("created_at", { ascending: false })
      .limit(12);

    if (selectedFilter !== "all") {
      query = query.eq("status", selectedFilter);
    }

    const { data, error } = await query;

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
              <div class="request-action-row">
                <button class="btn request-action request-action-edit" onclick="startEditRequest('${req.id}')">Edit</button>
                <button class="btn request-action request-action-cancel" onclick="cancelRequest('${req.id}')">Cancel</button>
              </div>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

    const groupedSummary = new Map();

    // Only include pending requests in summary (live counts)
    const pendingRequests = sortedRequests.filter(req => (req.status || "pending") === "pending");

    pendingRequests.forEach(req => {
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

    // Populate summary dropdown with item names
    const summarySelect = document.getElementById("summary-select");
    if (summarySelect) {
      // Save current selection
      const currentSelection = summarySelect.value || "all";
      
      summarySelect.innerHTML = '<option value="all">All Items</option>';
      summaryGroups.forEach(group => {
        const option = document.createElement("option");
        option.value = group.itemName;
        option.textContent = group.itemName;
        summarySelect.appendChild(option);
      });
      
      // Restore selection if it still exists, otherwise default to "all"
      if (summaryGroups.some(g => g.itemName === currentSelection)) {
        summarySelect.value = currentSelection;
      } else {
        summarySelect.value = "all";
      }
    }

    // Get selected item from dropdown
    const selectedItem = summarySelect?.value || "all";
    const filteredGroups = selectedItem === "all" ? summaryGroups : summaryGroups.filter(g => g.itemName === selectedItem);

    const summaryMarkup = filteredGroups.map((group, index) => {
      const sortedMembers = [...group.members].filter(m => m.quantity > 0).sort((a, b) => b.quantity - a.quantity);
      
      // Skip if no members with positive quantity
      if (sortedMembers.length === 0) return "";
      
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

    summaryContainer.innerHTML = summaryMarkup || '<p class="empty-state">No active requests for this item.</p>';
    animateCountUp(summaryContainer.querySelectorAll(".count-up"));
  } catch (err) {
    container.innerHTML = `<p class="empty-state error">Error loading requests: ${err.message}</p>`;
    summaryContainer.innerHTML = `<p class="empty-state error">Summary unavailable.</p>`;
  }
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

function setActiveNavLink() {
  const currentPath = window.location.pathname.split("/").pop().toLowerCase();
  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const normalized = href.split('/').pop().toLowerCase();
    link.classList.toggle('active', normalized === currentPath);
  });
}

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    const isAuth = await checkAuth();
    if (isAuth) {
      attachRequestSortHandler();
      loadItems();
      loadMyRequests();
      setActiveNavLink();
    }
  }, 80);
});

window.submitRequest = submitRequest;
window.logout = logout;
window.startEditRequest = startEditRequest;
window.cancelRequest = cancelRequest;
