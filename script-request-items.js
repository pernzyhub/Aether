import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;
let currentClanUser = null;

async function checkAuth() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  
  if (!user) {
    window.location.href = "/";
    return false;
  }

  // Load clan user data to check active status and IGN
  const { data: clanUser, error: clanUserError } = await supabase
    .from("clan_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (clanUserError) {
    console.error("Error loading clan user:", clanUserError);
    alert("Error loading your account information. Please try again later.");
    // Don't log out on error
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

  currentUser = user;
  currentClanUser = clanUser;
  
  const username = clanUser.ign || user.user_metadata?.full_name || user.email;
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

  statusEl.textContent = "Submitting request...";
  statusEl.className = "status-text";

  try {
    const { error } = await supabase
      .from("item_requests")
      .insert([{ 
        user_id: currentUser.id, 
        item_id: itemId, 
        quantity: quantity,
        notes: notes || null
      }]);

    if (error) throw error;

    statusEl.textContent = "Request submitted successfully!";
    statusEl.className = "status-text success";
    document.getElementById("request-form").reset();
    document.getElementById("quantity").value = 1;
    loadMyRequests();
  } catch (err) {
    statusEl.textContent = "Error submitting request: " + err.message;
    statusEl.className = "status-text error";
  }
}

async function loadMyRequests() {
  const container = document.getElementById("my-requests");
  container.innerHTML = "<p>Loading requests...</p>";

  try {
    const { data, error } = await supabase
      .from("item_requests")
      .select("*, items!inner(name)")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = "<p>No requests yet.</p>";
      return;
    }

    container.innerHTML = data.map(req => `
      <div class="list-item" data-id="${req.id}">
        <div class="list-item-content">
          <div class="list-item-title">${escapeHtml(req.items.name)} x${req.quantity}</div>
          <div class="list-item-meta">${new Date(req.created_at).toLocaleString()}</div>
          <div class="list-item-text">
            Status: <span class="request-status ${req.status}">${req.status.toUpperCase()}</span>
          </div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading requests: ${err.message}</p>`;
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
    loadItems();
    loadMyRequests();
  }
});

window.submitRequest = submitRequest;
window.logout = logout;
