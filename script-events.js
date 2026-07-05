import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;
let eventTypes = [];
let selectedMembers = [];

/* AUTH & UTILITIES */
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

/* EVENT TYPES MANAGEMENT */
async function loadEventTypes() {
  console.log('loadEventTypes() called');
  try {
    const { data: types, error } = await supabase
      .from("event_types")
      .select("*")
      .order("name");

    if (error) throw error;
    eventTypes = types || [];

    const selectEl = document.getElementById("event-type-select");
    if (selectEl) {
      selectEl.innerHTML = '<option value="">Select event type...</option>' +
        eventTypes.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
      
      selectEl.addEventListener("change", (e) => {
        const typeId = e.target.value;
        const type = eventTypes.find(t => t.id === typeId);
        if (type) {
          document.getElementById("event-points").value = type.default_points;
        }
      });
    }

    const container = document.getElementById("event-types-list");
    if (container) {
      container.innerHTML = eventTypes.length === 0 ? "<p>No event types yet.</p>" : 
        eventTypes.map(type => `
          <div class="list-item" data-id="${type.id}">
            <div class="list-item-content">
              <div class="list-item-title" style="border-left: 4px solid ${type.color}; padding-left: 10px;">
                ${escapeHtml(type.name)} <span class="qty-badge">${type.default_points} pts</span>
              </div>
              <div class="list-item-meta">${type.description || 'No description'}</div>
              <div class="list-item-text">Status: <strong style="color: ${type.is_active ? '#00ff88' : '#ff4444'};">${type.is_active ? 'Active' : 'Inactive'}</strong></div>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-secondary" onclick="editEventType('${type.id}')">EDIT</button>
              <button class="btn ${type.is_active ? 'btn-danger' : 'btn-success'}" onclick="toggleEventTypeStatus('${type.id}', ${!type.is_active})">
                ${type.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
              </button>
              <button class="btn btn-danger" onclick="deleteEventType('${type.id}')">DELETE</button>
            </div>
          </div>
        `).join("");
    }
  } catch (err) {
    showStatus("event-type-status", `Error loading event types: ${err.message}`, "error");
  }
}

async function createEventType(e) {
  e.preventDefault();
  const name = document.getElementById("event-type-name").value.trim();
  const description = document.getElementById("event-type-description").value.trim();
  const color = document.getElementById("event-type-color").value.trim();

  if (!name) {
    showStatus("event-type-status", "Name is required.", "error");
    return;
  }

  showStatus("event-type-status", "Creating event type...", "");

  try {
    const { error } = await supabase
      .from("event_types")
      .insert([{
        name,
        description: description || null,
        default_points: 10,
        color: color || "#ff6688",
        is_active: true
      }]);

    if (error) throw error;

    showStatus("event-type-status", "Event type created successfully.", "success");
    document.getElementById("event-type-form").reset();
    loadEventTypes();
  } catch (err) {
    showStatus("event-type-status", `Error: ${err.message}`, "error");
  }
}

async function editEventType(typeId) {
  const type = eventTypes.find(t => t.id === typeId);
  if (!type) return;

  const newName = prompt("Enter new name:", type.name);
  if (!newName) return;

  const newDescription = prompt("Enter new description:", type.description || "");
  const newPoints = prompt("Enter new default points:", type.default_points);
  const newColor = prompt("Enter new color (hex):", type.color);

  if (isNaN(parseInt(newPoints))) {
    showStatus("event-type-status", "Points must be a number.", "error");
    return;
  }

  showStatus("event-type-status", "Updating event type...", "");

  try {
    const { error } = await supabase
      .from("event_types")
      .update({
        name: newName,
        description: newDescription || null,
        default_points: parseInt(newPoints),
        color: newColor || type.color,
        updated_at: new Date().toISOString()
      })
      .eq("id", typeId);

    if (error) throw error;
    showStatus("event-type-status", "Event type updated successfully.", "success");
    loadEventTypes();
  } catch (err) {
    showStatus("event-type-status", `Error: ${err.message}`, "error");
  }
}

async function toggleEventTypeStatus(typeId, isActive) {
  try {
    const { error } = await supabase
      .from("event_types")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", typeId);

    if (error) throw error;
    loadEventTypes();
  } catch (err) {
    showStatus("event-type-status", `Error: ${err.message}`, "error");
  }
}

async function deleteEventType(typeId) {
  if (!confirm("Are you sure you want to delete this event type? Events using this type will not be affected.")) return;
  
  try {
    const { error } = await supabase
      .from("event_types")
      .delete()
      .eq("id", typeId);

    if (error) throw error;
    showStatus("event-type-status", "Event type deleted successfully.", "success");
    loadEventTypes();
  } catch (err) {
    showStatus("event-type-status", `Error: ${err.message}`, "error");
  }
}

/* EVENT MANAGEMENT */
async function loadEvents() {
  console.log('loadEvents() called');
  const container = document.getElementById("events-list");
  if (!container) return;
  container.innerHTML = "<p>Loading events...</p>";

  try {
    const { data: events, error } = await supabase
      .from("events")
      .select("*, event_types(name, color)")
      .order("event_date", { ascending: false });

    if (error) throw error;

    if (!events || events.length === 0) {
      container.innerHTML = "<p>No events yet.</p>";
      return;
    }

    container.innerHTML = events.map(event => {
      const typeInfo = event.event_types || {};
      return `
        <div class="list-item ${!event.is_active ? 'completed' : ''}" data-id="${event.id}">
          <div class="list-item-content">
            <div class="list-item-title" style="border-left: 4px solid ${typeInfo.color || '#ff6688'}; padding-left: 10px;">
              ${escapeHtml(event.name)} <span class="qty-badge">${event.points} pts</span>
            </div>
            <div class="list-item-meta">
              ${event.description ? escapeHtml(event.description) : 'No description'}
              ${event.event_date ? `| Date: ${new Date(event.event_date).toLocaleString()}` : ''}
              ${event.is_recurring ? `| Recurring: ${event.recurrence_type}` : ''}
            </div>
            <div class="list-item-text">
              Type: <strong>${escapeHtml(typeInfo.name || 'N/A')}</strong> | 
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
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading events: ${err.message}</p>`;
  }
}

// Helpers to compute next recurrence occurrence (global so other functions can use it)
function formatReadableDate(d) {
  if (!d || !(d instanceof Date)) return '';
  const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString(undefined, opts);
}

// Recurrence state helpers - support old checkbox or new compact button + hidden input
function isRecurringEnabled() {
  const el = document.getElementById('is-recurring');
  if (!el) return false;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return el.checked;
  return String(el.value) === 'true';
}

function setRecurringEnabled(state) {
  const el = document.getElementById('is-recurring');
  if (!el) return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') {
    el.checked = !!state;
  } else {
    el.value = state ? 'true' : 'false';
  }
  const opts = document.getElementById('recurring-options');
  if (opts) opts.style.display = state ? 'block' : 'none';
  const btn = document.getElementById('recurring-toggle-btn');
  if (btn) {
    btn.textContent = state ? 'RECURRING: ON' : 'RECURRING: OFF';
    btn.style.background = state ? '#00ff88' : '#333';
    btn.style.color = state ? '#000' : '#ff6688';
  }
}

function getNextOccurrenceFromUI() {
  try {
    const isRecurring = isRecurringEnabled();
    if (!isRecurring) return null;
    const type = document.getElementById('recurrence-type')?.value;
    const time = document.getElementById('recurrence-time')?.value || '00:00';
    const today = new Date();

    if (type === 'weekly' || type === 'biweekly') {
      const dayVal = document.getElementById('recurrence-day-select')?.value;
      const target = dayVal ? parseInt(dayVal, 10) : today.getDay();
      const todayDow = today.getDay();
      let daysAhead = (target - todayDow + 7) % 7;
      const next = new Date(today);
      next.setDate(today.getDate() + daysAhead);
      const [hh, mm] = time.split(':').map(n => parseInt(n || '0', 10));
      next.setHours(hh, mm, 0, 0);
      return next;
    }

    if (type === 'monthly') {
      const next = new Date(today);
      next.setMonth(today.getMonth() + 1);
      const [hh, mm] = time.split(':').map(n => parseInt(n || '0', 10));
      next.setHours(hh, mm, 0, 0);
      return next;
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function createEvent(e) {
  console.log('createEvent() called');
  e.preventDefault();
  const typeId = document.getElementById("event-type-select").value;
  const name = document.getElementById("event-name").value.trim();
  const description = document.getElementById("event-description").value.trim();
  const points = parseInt(document.getElementById("event-points").value);
  const eventDate = document.getElementById("event-date").value;
  const isRecurring = isRecurringEnabled();
  const recurrenceType = document.getElementById("recurrence-type").value;
  const recurrenceTime = document.getElementById("recurrence-time").value;
  
  let recurrenceDays = null;
  if (isRecurring) {
    if (recurrenceType === 'weekly') {
      const daySelect = document.getElementById('recurrence-day-select');
      if (daySelect && daySelect.value !== '') {
        recurrenceDays = [parseInt(daySelect.value)];
      } else {
        showStatus("event-status", "Select a day for weekly recurrence.", "error");
        return;
      }
    } else {
      recurrenceDays = null;
    }
  }

  if (!name || isNaN(points)) {
    showStatus("event-status", "Event name and points are required.", "error");
    return;
  }

  showStatus("event-status", "Creating event...", "");

  try {
    const { error } = await supabase
      .from("events")
      .insert([{
        event_type_id: typeId || null,
        name,
        description: description || null,
        points,
        event_date: eventDate || null,
        is_active: true,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : null,
        recurrence_days: isRecurring ? JSON.stringify(recurrenceDays) : null,
        recurrence_time: isRecurring ? recurrenceTime : null,
        month_year: new Date().toISOString().slice(0, 7)
      }]);

    if (error) throw error;

    showStatus("event-status", "Event created successfully.", "success");
    document.getElementById("event-form").reset();
    document.getElementById("recurring-options").style.display = "none";
    loadEvents();
    // If recurring, show next occurrence sample in status
    try {
      if (isRecurring) {
        const next = getNextOccurrenceFromUI();
        if (next) {
          showStatus("event-status", `Event created successfully. Next occurrence: ${formatReadableDate(next)}`, "success");
        }
      }
    } catch (e) {
      // ignore
    }
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

  const newPoints = prompt("Enter new points:", event.points);

  showStatus("events-status", "Updating event...", "");

  try {
    const { error: updateError } = await supabase
      .from("events")
      .update({
        name: newName,
        points: parseInt(newPoints) || 0,
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

/* BULK ATTENDANCE */
let allMembers = [];

async function loadBulkEventSelect() {
  console.log('loadBulkEventSelect() called');
  try {
    const { data: events, error } = await supabase
      .from("events")
      .select("id, name, points")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    const selectEl = document.getElementById("bulk-event-select");
    if (selectEl) {
      selectEl.innerHTML = '<option value="">Select event...</option>' +
        (events || []).map(e => `<option value="${e.id}">${escapeHtml(e.name)} (${e.points} pts)</option>`).join("");
    }
  } catch (err) {
    console.error("Error loading bulk event select:", err);
  }
}

async function loadBulkMembers() {
  console.log('loadBulkMembers() called');
  const container = document.getElementById("bulk-members-list");
  if (!container) return;
  container.innerHTML = "<p>Loading members...</p>";

  try {
    const { data: members, error } = await supabase
      .from("clan_users")
      .select("id, ign")
      .eq("is_active", true)
      .order("ign");

    if (error) throw error;

    allMembers = members || [];
    renderBulkMembers(allMembers);
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading members: ${err.message}</p>`;
  }
}

function renderBulkMembers(members) {
  const container = document.getElementById("bulk-members-list");
  const countEl = document.getElementById("member-count");
  
  if (countEl) countEl.textContent = members.length;
  
  // Render members in a compact two-column grid so many names are visible at once
  container.innerHTML = (members || []).map(member => `
    <label style="display: inline-block; width: calc(50% - 8px); box-sizing: border-box; padding: 4px 6px; cursor: pointer; color: #fff; font-size: 12px;">
      <input type="checkbox" value="${member.id}" name="bulk-member" class="bulk-member-checkbox" style="width:14px; height:14px; vertical-align: middle; margin-right: 8px;" />
      <span style="vertical-align: middle;">${escapeHtml(member.ign)}</span>
    </label>
  `).join("");

  // Restore previously selected checkboxes (if any)
  document.querySelectorAll(".bulk-member-checkbox").forEach(checkbox => {
    checkbox.checked = selectedMembers.includes(checkbox.value);
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!selectedMembers.includes(e.target.value)) selectedMembers.push(e.target.value);
      } else {
        selectedMembers = selectedMembers.filter(id => id !== e.target.value);
      }
    });
  });
}

function filterBulkMembers() {
  const searchTerm = document.getElementById("bulk-search").value.trim().toLowerCase();
  
  if (!searchTerm) {
    renderBulkMembers(allMembers);
    return;
  }
  
  const filtered = allMembers.filter(member => 
    member.ign.toLowerCase().includes(searchTerm)
  );
  
  renderBulkMembers(filtered);
}

function parseBulkPaste() {
  const pasteText = document.getElementById("bulk-paste-input").value.trim();
  
  if (!pasteText) {
    showStatus("bulk-status", "Please paste member IGNs.", "error");
    return;
  }
  
  // Split by comma or newline
  const igns = pasteText.split(/[,\n]/).map(ign => ign.trim().toLowerCase()).filter(ign => ign);
  
  if (igns.length === 0) {
    showStatus("bulk-status", "No valid IGNs found.", "error");
    return;
  }
  
  // Find matching members
  const matched = allMembers.filter(member => 
    igns.includes(member.ign.toLowerCase())
  );
  
  if (matched.length === 0) {
    showStatus("bulk-status", `No members found matching the pasted IGNs.`, "error");
    return;
  }
  
  selectedMembers = matched.map(m => m.id);
  
  // Update checkboxes
  document.querySelectorAll(".bulk-member-checkbox").forEach(checkbox => {
    checkbox.checked = selectedMembers.includes(checkbox.value);
  });
  
  showStatus("bulk-status", `Selected ${matched.length} members from paste.`, "success");
}

async function applyBulkAttendance() {
  console.log('applyBulkAttendance() called');
  const eventId = document.getElementById("bulk-event-select").value;
  const customPoints = document.getElementById("bulk-points").value;

  if (!eventId) {
    showStatus("bulk-status", "Please select an event.", "error");
    return;
  }

  if (selectedMembers.length === 0) {
    showStatus("bulk-status", "Please select at least one member.", "error");
    return;
  }

  showStatus("bulk-status", `Applying attendance for ${selectedMembers.length} members...`, "");

  try {
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("points")
      .eq("id", eventId)
      .single();

    if (eventError) throw eventError;

    const pointsToAward = customPoints ? parseInt(customPoints) : event.points;
    const monthYear = new Date().toISOString().slice(0, 7);

    const attendanceRecords = selectedMembers.map(userId => ({
      event_id: eventId,
      user_id: userId,
      attended: true,
      points_awarded: pointsToAward,
      month_year: monthYear
    }));

    const { error: insertError } = await supabase
      .from("attendance")
      .insert(attendanceRecords);

    if (insertError) throw insertError;

    showStatus("bulk-status", `✓ Successfully marked ${selectedMembers.length} members attended! Points: ${pointsToAward}`, "success");
    selectedMembers = [];
    document.getElementById("bulk-points").value = "";
    document.getElementById("bulk-event-select").value = "";
    document.getElementById("bulk-search").value = "";
    document.getElementById("bulk-paste-input").value = "";
    document.querySelectorAll(".bulk-member-checkbox").forEach(cb => cb.checked = false);
    loadBulkMembers();
    loadAttendance();
  } catch (err) {
    showStatus("bulk-status", `Error: ${err.message}`, "error");
  }
}

/* ATTENDANCE MANAGEMENT */
async function loadAttendance() {
  console.log('loadAttendance() called');
  const container = document.getElementById("attendance-list");
  if (!container) return;
  container.innerHTML = "<p>Loading attendance...</p>";

  try {
    const { data: attendance, error } = await supabase
      .from("attendance")
      .select("*, events(name, points), clan_users(ign)")
      .order("created_at", { ascending: false })
      .limit(100);

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
            Points: ${record.points_awarded} / ${record.events.points} | Month: ${record.month_year || 'N/A'}
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

/* MONTHLY POINTS TRACKING */
async function loadMonthlyPoints() {
  console.log('loadMonthlyPoints() called');
  const container = document.getElementById("monthly-points-table");
  const monthFilter = document.getElementById("monthly-points-filter").value;

  if (!monthFilter) {
    showStatus("monthly-status", "Please select a month.", "error");
    return;
  }

  container.innerHTML = "<p>Loading monthly points...</p>";

  try {
    const { data: summary, error } = await supabase
      .from("monthly_points_summary")
      .select("*, clan_users(ign)")
      .eq("month_year", monthFilter)
      .order("total_points", { ascending: false });

    if (error) throw error;

    if (!summary || summary.length === 0) {
      container.innerHTML = "<p>No data for this month.</p>";
      return;
    }

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background: #222; text-align: left;">
            <th style="padding: 10px; border-bottom: 2px solid #ff6688;">Rank</th>
            <th style="padding: 10px; border-bottom: 2px solid #ff6688;">Member</th>
            <th style="padding: 10px; border-bottom: 2px solid #ff6688; text-align: center;">Total Points</th>
            <th style="padding: 10px; border-bottom: 2px solid #ff6688; text-align: center;">Events Attended</th>
          </tr>
        </thead>
        <tbody>
          ${summary.map((record, idx) => `
            <tr style="border-bottom: 1px solid #333; ${idx % 2 === 0 ? 'background: #111;' : 'background: #0a0a0a;'}">
              <td style="padding: 10px;">#${idx + 1}</td>
              <td style="padding: 10px;"><strong>${escapeHtml(record.clan_users.ign)}</strong></td>
              <td style="padding: 10px; text-align: center; color: #ffaa00;"><strong>${record.total_points}</strong></td>
              <td style="padding: 10px; text-align: center;">${record.events_attended}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    container.innerHTML = tableHtml;
    showStatus("monthly-status", `Showing points for ${monthFilter}`, "success");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading points: ${err.message}</p>`;
  }
}

/* TAB SWITCHING */
function setEventsTab(tabName) {
  document.querySelectorAll('.events-tab').forEach(tab => {
    tab.classList.remove('is-active');
  });
  
  document.querySelectorAll('.events-tab-content').forEach(content => {
    content.classList.remove('is-active');
  });
  
  document.querySelector(`.events-tab[data-tab="${tabName}"]`).classList.add('is-active');
  document.getElementById(`events-tab-${tabName}`).classList.add('is-active');

  try {
    console.log('Switching events tab to', tabName);
    if (tabName === "manage") loadEvents();
    if (tabName === "attendance") loadAttendance();
    if (tabName === "bulk-attendance") loadBulkMembers();
    if (tabName === "members") loadMembersSheet();
  } catch (err) {
    console.error('Error switching tab', err);
    const generalStatus = document.getElementById('events-status');
    if (generalStatus) showStatus('events-status', `Tab switch error: ${err.message}`, 'error');
  }
}

/* MEMBERS SHEET */
async function loadMembersSheet() {
  console.log('loadMembersSheet() called');
  const statusEl = document.getElementById('members-status');
  const container = document.getElementById('members-sheet');
  if (!container) return;
  statusEl.textContent = 'Loading members...';

  try {
    const { data: users, error: usersErr } = await supabase
      .from('clan_users')
      .select('id, ign, is_active')
      .order('ign');
    if (usersErr) throw usersErr;
    // Determine months range from UI
    const monthsSelect = document.getElementById('members-months-range');
    const monthsCount = monthsSelect ? parseInt(monthsSelect.value, 10) : 6;
    const months = [];
    const now = new Date();
    for (let i = 0; i < monthsCount; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    // Fetch attendance for those months
    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('user_id, points_awarded, attended, month_year, created_at')
      .in('month_year', months)
      .order('created_at', { ascending: false });
    if (attErr) throw attErr;

    // Aggregate per user and per month
    const map = {};
    users.forEach(u => map[u.id] = { ign: u.ign, is_active: u.is_active, total_points: 0, total_attended: 0, last_attended: null, months: {} });
    (attendance || []).forEach(a => {
      if (!map[a.user_id]) return;
      map[a.user_id].total_points += a.points_awarded || 0;
      if (a.attended) map[a.user_id].total_attended += 1;
      const dt = a.created_at ? new Date(a.created_at) : null;
      if (dt && (!map[a.user_id].last_attended || dt > map[a.user_id].last_attended)) map[a.user_id].last_attended = dt;
      const my = a.month_year || (a.created_at ? a.created_at.slice(0,7) : null);
      if (my) {
        if (!map[a.user_id].months[my]) map[a.user_id].months[my] = { attended: 0, points: 0 };
        if (a.attended) map[a.user_id].months[my].attended += 1;
        map[a.user_id].months[my].points += a.points_awarded || 0;
      }
    });

    // Build table with month columns
    const table = document.createElement('table');
    table.style.width = '100%'; table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    let headerHtml = `<tr style="background:#222;color:#fff"><th style="padding:8px">Member</th><th style="padding:8px;text-align:center">Active</th><th style="padding:8px;text-align:center">Total Attended</th><th style="padding:8px;text-align:center">Total Points</th>`;
    months.forEach(m => {
      const d = new Date(m + '-01');
      const label = d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
      headerHtml += `<th style="padding:8px;text-align:center">${label}</th>`;
    });
    headerHtml += `<th style="padding:8px">Last Attended</th></tr>`;
    thead.innerHTML = headerHtml;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    users.forEach(u => {
      const r = map[u.id];
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #333';
      let rowHtml = `<td style="padding:8px"><strong>${escapeHtml(r.ign)}</strong></td><td style="padding:8px;text-align:center">${r.is_active ? 'Yes' : 'No'}</td><td style="padding:8px;text-align:center">${r.total_attended}</td><td style="padding:8px;text-align:center;color:#ffaa00">${r.total_points}</td>`;
      months.forEach(m => {
        const cell = r.months[m] || { attended: 0, points: 0 };
        rowHtml += `<td style="padding:8px;text-align:center">${cell.attended}/${cell.points}</td>`;
      });
      rowHtml += `<td style="padding:8px">${r.last_attended ? r.last_attended.toLocaleString() : '—'}</td>`;
      tr.innerHTML = rowHtml;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.innerHTML = '';
    container.appendChild(table);
    statusEl.textContent = `Showing ${users.length} members (last ${monthsCount} months)`;

    // Wire refresh button
    const refreshBtn = document.getElementById('members-refresh');
    const monthsSelectEl = document.getElementById('members-months-range');
    if (refreshBtn) refreshBtn.onclick = loadMembersSheet;
    if (monthsSelectEl) monthsSelectEl.onchange = loadMembersSheet;
  } catch (err) {
    statusEl.textContent = `Error loading members: ${err.message}`;
  }
}

async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Logout warning:", err);
  }
  window.location.replace("/access-gate.html");
}

/* INITIALIZATION */
window.addEventListener("load", () => {
  const recurringOptions = document.getElementById("recurring-options");
  const recurrenceTypeSelect = document.getElementById("recurrence-type");
  const weeklyDaysDiv = document.getElementById("weekly-days");
  const bulkPasteToggle = document.getElementById("bulk-paste-toggle");
  const bulkPasteArea = document.getElementById("bulk-paste-area");
  const bulkSearch = document.getElementById("bulk-search");

  const recurringBtn = document.getElementById("recurring-toggle-btn");
  const isRecurringInput = document.getElementById("is-recurring");
  if (recurringBtn && isRecurringInput) {
    recurringBtn.addEventListener("click", () => {
      const newState = !(String(isRecurringInput.value) === 'true');
      setRecurringEnabled(newState);
      updateRecurrenceSample();
    });
    // initialize display based on current state
    setRecurringEnabled(isRecurringEnabled());
  }

  if (recurrenceTypeSelect) {
    recurrenceTypeSelect.addEventListener("change", (e) => {
      weeklyDaysDiv.style.display = e.target.value === "weekly" ? "block" : "none";
    });
  }

  // Update recurrence sample when relevant inputs change
  const recurrenceSampleEl = document.getElementById('recurrence-sample');
  function formatReadable(d) {
    if (!d || !(d instanceof Date)) return '';
    const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return d.toLocaleDateString(undefined, opts);
  }

  function computeNextOccurrence() {
    const isRecurring = isRecurringEnabled();
    if (!isRecurring) return null;
    const type = document.getElementById('recurrence-type')?.value;
    const time = document.getElementById('recurrence-time')?.value || '00:00';
    const today = new Date();

    if (type === 'weekly') {
      const dayVal = document.getElementById('recurrence-day-select')?.value;
      if (!dayVal) return null;
      const target = parseInt(dayVal, 10);
      // JS: 0 = Sunday ... 6 = Saturday
      const todayDow = today.getDay();
      let daysAhead = (target - todayDow + 7) % 7;
      if (daysAhead === 0) daysAhead = 0; // allow today
      const next = new Date(today);
      next.setDate(today.getDate() + daysAhead);
      // apply time
      const [hh, mm] = time.split(':').map(n => parseInt(n || '0', 10));
      next.setHours(hh, mm, 0, 0);
      return next;
    }

    if (type === 'biweekly') {
      // find next occurrence same as weekly, then show two-week interval
      const dayVal = document.getElementById('recurrence-day-select')?.value;
      const target = dayVal ? parseInt(dayVal, 10) : today.getDay();
      const todayDow = today.getDay();
      let daysAhead = (target - todayDow + 7) % 7;
      const next = new Date(today);
      next.setDate(today.getDate() + daysAhead);
      const [hh, mm] = time.split(':').map(n => parseInt(n || '0', 10));
      next.setHours(hh, mm, 0, 0);
      return next;
    }

    if (type === 'monthly') {
      // use today's day in next month
      const next = new Date(today);
      next.setMonth(today.getMonth() + 1);
      const [hh, mm] = time.split(':').map(n => parseInt(n || '0', 10));
      next.setHours(hh, mm, 0, 0);
      return next;
    }

    return null;
  }

  function updateRecurrenceSample() {
    if (!recurrenceSampleEl) return;
    const isRecurring = isRecurringEnabled();
    if (!isRecurring) {
      recurrenceSampleEl.textContent = '';
      return;
    }
    const next = computeNextOccurrence();
    if (next) {
      recurrenceSampleEl.textContent = `Next occurrence: ${formatReadable(next)}`;
    } else {
      recurrenceSampleEl.textContent = 'Configure recurrence options to see a sample date.';
    }
  }

  // Wire controls to update sample (note: recurring toggle calls updateRecurrenceSample directly)
  ['recurrence-type', 'recurrence-day-select', 'recurrence-time'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateRecurrenceSample);
  });

  if (bulkPasteToggle) {
    bulkPasteToggle.addEventListener("change", (e) => {
      bulkPasteArea.style.display = e.target.checked ? "block" : "none";
    });
  }

  if (bulkSearch) {
    bulkSearch.addEventListener("input", () => {
      filterBulkMembers();
    });
  }

  const eventTypeForm = document.getElementById("event-type-form");
  if (eventTypeForm) {
    eventTypeForm.addEventListener("submit", createEventType);
  }

  const eventForm = document.getElementById("event-form");
  if (eventForm) {
    eventForm.addEventListener("submit", createEvent);
  }

  window.setTimeout(async () => {
    const isAuth = await checkAuth();
    if (isAuth) {
      loadEventTypes();
      loadBulkEventSelect();
      loadBulkMembers();
      loadEvents();
      loadAttendance();
      
      const today = new Date();
      const monthString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const monthInput = document.getElementById("monthly-points-filter");
      if (monthInput) monthInput.value = monthString;
    }
  }, 80);
});

/* EXPORT FUNCTIONS TO WINDOW */
window.logout = logout;
window.createEventType = createEventType;
window.editEventType = editEventType;
window.toggleEventTypeStatus = toggleEventTypeStatus;
window.deleteEventType = deleteEventType;
window.loadEventTypes = loadEventTypes;
window.createEvent = createEvent;
window.editEvent = editEvent;
window.toggleEventStatus = toggleEventStatus;
window.deleteEvent = deleteEvent;
window.loadEvents = loadEvents;
window.loadBulkEventSelect = loadBulkEventSelect;
window.loadBulkMembers = loadBulkMembers;
window.filterBulkMembers = filterBulkMembers;
window.parseBulkPaste = parseBulkPaste;
window.applyBulkAttendance = applyBulkAttendance;
window.loadAttendance = loadAttendance;
window.toggleAttendance = toggleAttendance;
window.editAttendancePoints = editAttendancePoints;
window.deleteAttendance = deleteAttendance;
window.loadMonthlyPoints = loadMonthlyPoints;
window.setEventsTab = setEventsTab;
