import { supabase } from './lib/supabaseClient.js';
import { getMemberSession, ensureSupabaseSession, logout, setActiveNavLink, isAdminPreviewMode } from './lib/memberAuth.js';

let currentUser = null;
let currentClanUser = null;
let editingRequestId = null;
const isAdminPreview = isAdminPreviewMode();

async function checkAuth() {
  if (isAdminPreview) {
    const welcomeEl = document.getElementById("welcome-text");
    if (welcomeEl) {
      welcomeEl.textContent = "ADMIN PREVIEW MODE";
    }
    const form = document.getElementById("request-form");
    if (form) {
      form.querySelectorAll("input, select, textarea, button").forEach((el) => {
        el.disabled = true;
      });
    }
    const statusEl = document.getElementById("request-status");
    if (statusEl) {
      statusEl.textContent = "Preview mode: request submission is disabled.";
      statusEl.className = "status-text";
    }
    return true;
  }

  const supabaseSession = await ensureSupabaseSession();
  const { data } = await supabase.auth.getSession();
  const user = supabaseSession?.user || data.session?.user;
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

async function persistRequestRequest(payload, isEdit = false) {
  const requestPayload = {
    ...payload,
    ...(payload.requested_quantity !== undefined ? { requested_quantity: payload.requested_quantity } : {})
  };

  try {
    // Determine the currently authenticated Supabase user (if any)
    const { data: authData } = await supabase.auth.getUser();
    const authUserId = authData?.user?.id || null;
    const targetUserId = requestPayload.user_id || currentUser?.id || currentClanUser?.id || null;

    // If the authenticated user matches the target user, use direct table queries
    if (isEdit) {
      if (authUserId && targetUserId && authUserId === targetUserId) {
        return await supabase
          .from("item_requests")
          .update(requestPayload)
          .eq("id", editingRequestId)
          .eq("user_id", targetUserId);
      }

      // Otherwise use the security-definer RPC for updates (members logged in via local session)
      const { data, error } = await supabase.rpc("update_item_request", {
        target_request_id: editingRequestId,
        target_user_id: targetUserId,
        target_item_id: requestPayload.item_id,
        target_quantity: requestPayload.requested_quantity ?? requestPayload.quantity,
        target_notes: requestPayload.notes ?? null
      });

      return { data, error };
    }

    // Create path: prefer direct insert when auth user matches
    if (authUserId && targetUserId && authUserId === targetUserId) {
      return await supabase
        .from("item_requests")
        .insert([requestPayload]);
    }

    // Otherwise call the create_item_request RPC (security-definer)
    const { data, error } = await supabase.rpc("create_item_request", {
      target_user_id: targetUserId,
      target_item_id: requestPayload.item_id,
      target_quantity: requestPayload.requested_quantity ?? requestPayload.quantity,
      target_notes: requestPayload.notes ?? null
    });

    return { data, error };
  } catch (err) {
    return { error: err };
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

      let { error } = await persistRequestRequest({
        item_id: itemId,
        quantity,
        requested_quantity: quantity,
        notes: notes || null,
        proof_image: proofImageUrl || null,
        updated_at: new Date().toISOString()
      }, true);

      if (error && /requested_quantity|column .*does not exist/i.test(error.message)) {
        ({ error } = await persistRequestRequest({
          item_id: itemId,
          quantity,
          notes: notes || null,
          proof_image: proofImageUrl || null,
          updated_at: new Date().toISOString()
        }, true));
      }

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

      let { error } = await persistRequestRequest({
        user_id: requestUserId,
        item_id: itemId,
        quantity,
        requested_quantity: quantity,
        notes: notes || null,
        proof_image: proofImageUrl || null,
        status: "pending"
      });

      if (error && /requested_quantity|column .*does not exist/i.test(error.message)) {
        ({ error } = await persistRequestRequest({
          user_id: requestUserId,
          item_id: itemId,
          quantity,
          notes: notes || null,
          proof_image: proofImageUrl || null,
          status: "pending"
        }));
      }

      if (error) {
        if (/row-level security|permission denied/i.test(error.message)) {
          throw new Error("Your session could not be authorized to create requests. Please log out and sign in again.");
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
  const safeValue = Math.max(0, Number(value) || 0);
  return `${safeValue} ${safeValue === 1 ? "pc" : "pcs"}`;
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
      .select("*, items!inner(name)")
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
      let { data: clanUsers, error: clanError } = await supabase
        .from("clan_users")
        .select("id, ign, is_hidden_from_members")
        .in("id", userIds);

      if (clanError && /is_hidden_from_members|column .* does not exist/i.test(clanError.message)) {
        ({ data: clanUsers, error: clanError } = await supabase
          .from("clan_users")
          .select("id, ign")
          .in("id", userIds));
      }

      if (!clanError && clanUsers) {
        memberNames = new Map(
          clanUsers
            .filter((user) => user.is_hidden_from_members !== true)
            .map(user => [user.id, user.ign || "Unknown Member"])
        );
      }
    }

    const visibleRequests = sortedRequests.filter((req) => memberNames.has(req.user_id));

    if (visibleRequests.length === 0) {
      container.innerHTML = '<p class="empty-state">No visible member requests right now.</p>';
      summaryContainer.innerHTML = '<p class="empty-state">No visible member summary available right now.</p>';
      return;
    }

    container.innerHTML = visibleRequests.map(req => {
      const memberName = memberNames.get(req.user_id) || "Unknown Member";
      const isOwner = req.user_id === currentUser?.id;
      const originalQty = Number(req.requested_quantity ?? req.quantity ?? 1);
      const remainingQty = Math.max(0, Number(req.quantity ?? 0));
      const fulfilledQty = Math.max(0, originalQty - remainingQty);
      const progressText = originalQty > 0 ? `${fulfilledQty}/${originalQty} fulfilled` : "Pending";

      // Display 'approved' when remaining quantity is zero even if stored status is stale
      const storedStatus = (req.status || "pending");
      const displayClass = (storedStatus === 'approved' || remainingQty === 0) ? 'approved' : storedStatus;
      const displayText = displayClass === 'approved' ? 'FULFILLED' : displayClass.toUpperCase();
      const isPendingForOwner = isOwner && displayClass === 'pending';

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
            <div class="request-progress-pill">${progressText}</div>
            ${req.proof_image ? `
              <div class="request-proof">
                <button class="proof-link" onclick="openImageModal('${escapeHtml(req.proof_image)}')">
                  <img src="${escapeHtml(req.proof_image)}" alt="Proof image" class="proof-thumbnail" />
                  <span class="proof-label">View Proof</span>
                </button>
              </div>
            ` : ""}
          </div>
          <div class="request-entry-actions">
            <span class="request-status ${displayClass}">${displayText}</span>
            ${isPendingForOwner ? `
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

    // Build the summary from ALL pending requests (ignore the feed filter)
    let pendingRequests = [];
    try {
      const { data: allPending, error: pendingError } = await supabase
        .from("item_requests")
        .select("*, items!inner(name)")
        .eq("status", "pending");

      if (!pendingError && Array.isArray(allPending)) {
        pendingRequests = allPending.filter((req) => memberNames.has(req.user_id));
      } else {
        // Fallback to using the already-fetched requests if the separate query fails
        pendingRequests = visibleRequests.filter(req => (req.status || "pending") === "pending");
      }
    } catch (e) {
      pendingRequests = visibleRequests.filter(req => (req.status || "pending") === "pending");
    }

    pendingRequests.forEach(req => {
      const itemName = req.items?.name || "Unknown Item";
      const memberName = memberNames.get(req.user_id) || "Unknown Member";
      const originalQty = Number(req.requested_quantity ?? req.quantity ?? 1);
      const remainingQty = Math.max(0, Number(req.quantity ?? 0));
      const fulfilledQty = Math.max(0, originalQty - remainingQty);
      const group = groupedSummary.get(itemName) || { itemName, total: 0, members: [] };
      const existingMember = group.members.find(member => member.name === memberName);

      if (existingMember) {
        existingMember.quantity += remainingQty;
        existingMember.fulfilled += fulfilledQty;
      } else {
        group.members.push({ name: memberName, quantity: remainingQty, fulfilled: fulfilledQty });
      }

      group.total += remainingQty;
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
                <strong><span class="count-up" data-target="${member.quantity}">0</span> / <span class="count-up" data-target="${member.fulfilled + member.quantity}">0</span></strong>
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
      setActiveNavLink();
    }
  }, 80);
});

window.submitRequest = submitRequest;
window.logout = logout;
window.startEditRequest = startEditRequest;
window.cancelRequest = cancelRequest;
window.openImageModal = openImageModal;

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
