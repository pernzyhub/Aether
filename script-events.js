import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;

async function checkAuth() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  
  if (!user) {
    window.location.replace("/index.html");
    return false;
  }
  
  const isAdmin = user?.app_metadata?.role && (user.app_metadata.role === "admin" || user.app_metadata.role === "superuser");
  if (!isAdmin) {
    window.location.replace("/portal.html");
    return false;
  }
  
  currentUser = user;
  
  const welcomeEl = document.getElementById("admin-welcome");
  if (welcomeEl) {
    const username = user?.user_metadata?.full_name || user?.email || "ADMIN";
    welcomeEl.textContent = `WELCOME, ${username.toUpperCase()}`;
  }
  
  return true;
}

function showStatus(elementId, message, type) {
  const statusEl = document.getElementById(elementId);
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-text ${type}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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
            ${event.event_date ? `| Date: ${new Date(event.event_date).toLocaleString()}` : ''}
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

/* Events tab switching */
function setEventsTab(tabName) {
  document.querySelectorAll('.events-tab').forEach(tab => {
    tab.classList.remove('is-active');
  });
  
  document.querySelectorAll('.events-tab-content').forEach(content => {
    content.classList.remove('is-active');
  });
  
  document.querySelector(`.events-tab[data-tab="${tabName}"]`).classList.add('is-active');
  document.getElementById(`events-tab-${tabName}`).classList.add('is-active');
}

async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout warning:", err);
  }
  window.location.replace("/access-gate.html");
}

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    const isAuth = await checkAuth();
    if (isAuth) {
      loadEvents();
      loadAttendance();
    }
  }, 80);
});

window.logout = logout;
window.loadEvents = loadEvents;
window.createEvent = createEvent;
window.editEvent = editEvent;
window.toggleEventStatus = toggleEventStatus;
window.deleteEvent = deleteEvent;
window.loadAttendance = loadAttendance;
window.toggleAttendance = toggleAttendance;
window.editAttendancePoints = editAttendancePoints;
window.deleteAttendance = deleteAttendance;
window.setEventsTab = setEventsTab;

// Event form handler
document.getElementById("event-form").addEventListener("submit", createEvent);
