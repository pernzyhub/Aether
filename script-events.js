import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wpilukuwehxphmorjxzd.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaWx1a3V3ZWh4cGhtb3JqeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODgxNDMsImV4cCI6MjA5ODY2NDE0M30.PjBUX8c8ZU8YVYUuwb2ypGyfMtHg-jOPlFDausGDKZY";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let currentUser = null;
let eventTypes = [];
let selectedMembers = [];
let lastBulkInsertedIds = [];

// configurable week window (days) - override by setting `window.WEEK_WINDOW_DAYS` in the browser console
const WEEK_WINDOW_DAYS = (typeof window !== 'undefined' && window.WEEK_WINDOW_DAYS) ? parseInt(window.WEEK_WINDOW_DAYS, 10) : 14;

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
              ${event.event_date ? `| Date: ${escapeHtml(formatDateTime(event.event_date))}` : ''}
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
      // If it's today but time already passed, move to next interval
      if (daysAhead === 0 && next <= new Date()) {
        next.setDate(next.getDate() + (type === 'biweekly' ? 14 : 7));
      }
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
  const eventMonthYear = eventDate ? eventDate.slice(0, 7) : null;
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
        month_year: eventMonthYear
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
    .maybeSingle();

  if (error) {
    showStatus("events-status", `Error loading event: ${error.message}`, "error");
    return;
  }

  if (!event) {
    showStatus("events-status", "Event not found.", "error");
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

function toggleAllBulkMembers(selectAll) {
  const memberIds = allMembers.map(member => member.id);
  selectedMembers = selectAll ? memberIds : [];

  document.querySelectorAll(".bulk-member-checkbox").forEach((checkbox) => {
    checkbox.checked = selectAll && memberIds.includes(checkbox.value);
  });

  showStatus("bulk-status", selectAll ? `Selected ${memberIds.length} members.` : "Cleared member selection.", "success");
}

async function applyBulkAttendance() {
  console.log('applyBulkAttendance() called');
  const eventId = document.getElementById("bulk-event-select").value;
  const customPoints = document.getElementById("bulk-points").value;
  const dateInput = document.getElementById("bulk-attendance-date").value;

  if (!eventId) {
    showStatus("bulk-status", "Please select an event.", "error");
    return;
  }

  if (!dateInput) {
    showStatus("bulk-status", "Please select a date.", "error");
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
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) {
      throw new Error("The selected event could not be found.");
    }

    const pointsToAward = customPoints ? parseInt(customPoints) : event.points;
    const [year, month, day] = dateInput.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const monthYear = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;

    const attendanceRecords = selectedMembers.map(userId => ({
      event_id: eventId,
      user_id: userId,
      attended: true,
      points_awarded: pointsToAward,
      attendance_date: selectedDate.toISOString(),
      month_year: monthYear,
      updated_at: new Date().toISOString()
    }));

    const { data: upsertedRows, error: upsertError } = await supabase
      .from("attendance")
      .upsert(attendanceRecords, { onConflict: "event_id,user_id,attendance_date" })
      .select('id, event_id, user_id, attended, points_awarded, month_year');

    if (upsertError) throw upsertError;

    lastBulkInsertedIds = (upsertedRows || []).map(r => r.id).filter(Boolean);
    showStatus("bulk-status", `✓ Successfully marked ${selectedMembers.length} members attended on ${formatDate(selectedDate)}! Points: ${pointsToAward}`, "success");
    selectedMembers = [];
    document.getElementById("bulk-points").value = "";
    document.getElementById("bulk-event-select").value = "";
    document.getElementById("bulk-attendance-date").value = "";
    document.getElementById("bulk-paste-input").value = "";
    document.querySelectorAll(".bulk-member-checkbox").forEach(cb => cb.checked = false);
    loadBulkMembers();
    loadAttendance();
  } catch (err) {
    showStatus("bulk-status", `Error: ${err.message}`, "error");
  }
}

/* ATTENDANCE MANAGEMENT */
let attendanceLogState = { events: [], attendance: [], users: [], selectedDateByEvent: {}, openEventIds: {} };

function getAttendanceMonthYear(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getAttendanceDateKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  if (!value) return "No date set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date set";

  const formattedDate = formatDate(date);
  const formattedTime = formatTime(date);
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;

  return isMidnight ? formattedDate : `${formattedDate} ${formattedTime}`;
}

function formatAttendanceDateKey(key) {
  if (!key) return "Unknown date";
  const date = new Date(key);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return formatDate(date);
}

function formatEventDateTime(value) {
  if (!value) return "No date set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date set";
  return formatDate(date);
}

function toggleAttendanceCard(eventId) {
  attendanceLogState.openEventIds = attendanceLogState.openEventIds || {};
  attendanceLogState.openEventIds[eventId] = !attendanceLogState.openEventIds[eventId];
  const body = document.getElementById(`attendance-event-body-${eventId}`);
  if (!body) return;
  body.style.display = attendanceLogState.openEventIds[eventId] ? "block" : "none";
}

function selectAttendanceDate(eventId, dateKey) {
  attendanceLogState.selectedDateByEvent = attendanceLogState.selectedDateByEvent || {};
  attendanceLogState.selectedDateByEvent[eventId] = dateKey;
  loadAttendance();
}

async function loadAttendance() {
  console.log('loadAttendance() called');
  const container = document.getElementById("attendance-list");
  if (!container) return;
  container.innerHTML = "<p>Loading attendance...</p>";

  try {
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, name, description, points, event_date, month_year, is_active")
      .eq("is_active", true)
      .order("event_date", { ascending: false });

    if (eventsError) throw eventsError;

    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance")
      .select("id, event_id, user_id, attended, points_awarded, month_year, attendance_date, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (attendanceError) throw attendanceError;

    const { data: users, error: usersError } = await supabase
      .from("clan_users")
      .select("id, ign, is_active")
      .order("ign", { ascending: true });

    if (usersError) throw usersError;

    const selectedDateByEvent = attendanceLogState.selectedDateByEvent || {};
    const openEventIds = attendanceLogState.openEventIds || {};
    attendanceLogState = {
      events: events || [],
      attendance: attendance || [],
      users: users || [],
      selectedDateByEvent,
      openEventIds
    };

    if (!events || events.length === 0) {
      container.innerHTML = "<p>No events yet.</p>";
      return;
    }

    const memberMap = Object.fromEntries((users || []).map(user => [user.id, user]));

    container.innerHTML = events.map(event => {
      const eventRecords = (attendance || []).filter(record => record.event_id === event.id);
      const dateKeys = Array.from(new Set(
        eventRecords
          .map(record => getAttendanceDateKey(record.attendance_date || record.created_at))
          .filter(Boolean)
      )).sort((a, b) => b.localeCompare(a));

      const hasDateTabs = dateKeys.length > 0;
      const selectedDateKey = hasDateTabs
        ? attendanceLogState.selectedDateByEvent[event.id] || dateKeys[0]
        : null;

      if (selectedDateKey) {
        attendanceLogState.selectedDateByEvent[event.id] = selectedDateKey;
      }

      const selectedRecords = selectedDateKey
        ? eventRecords.filter(record => getAttendanceDateKey(record.attendance_date || record.created_at) === selectedDateKey)
        : eventRecords;

      const presentRecords = selectedRecords.filter(record => record.attended);
      const presentUserIds = new Set(presentRecords.map(record => record.user_id));
      const activeUsers = (users || []).filter(user => user.is_active !== false);
      const absentUsers = activeUsers.filter(user => !presentUserIds.has(user.id));
      const presentMembers = presentRecords.map(record => ({
        ...record,
        user: memberMap[record.user_id] || null
      }));
      const hasAttendance = eventRecords.length > 0;

      // compute event-level weekly/monthly summaries
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 6);
      const monthTarget = event.month_year || (event.event_date ? (new Date(event.event_date)).toISOString().slice(0,7) : null);
      const eventWeekPoints = eventRecords.reduce((s, r) => {
        const d = r.attendance_date ? new Date(r.attendance_date) : (r.created_at ? new Date(r.created_at) : null);
        if (!d) return s;
        if (d >= weekAgo && r.attended) return s + (r.points_awarded || 0);
        return s;
      }, 0);
      const eventWeekPresent = eventRecords.reduce((c, r) => {
        const d = r.attendance_date ? new Date(r.attendance_date) : (r.created_at ? new Date(r.created_at) : null);
        if (!d) return c;
        if (d >= weekAgo && r.attended) return c + 1;
        return c;
      }, 0);
      const eventMonthPoints = eventRecords.reduce((s, r) => {
        const my = r.month_year || (r.attendance_date ? new Date(r.attendance_date).toISOString().slice(0,7) : null);
        if (my === monthTarget && r.attended) return s + (r.points_awarded || 0);
        return s;
      }, 0);
      const eventMonthPresent = eventRecords.reduce((c, r) => {
        const my = r.month_year || (r.attendance_date ? new Date(r.attendance_date).toISOString().slice(0,7) : null);
        if (my === monthTarget && r.attended) return c + 1;
        return c;
      }, 0);

      return `
        <div class="attendance-event-card">
          <button type="button" class="attendance-event-header" onclick="toggleAttendanceCard('${event.id}')">
            <div>
              <div class="attendance-event-title">${escapeHtml(event.name || "Unnamed event")}</div>
              <div class="attendance-event-meta">${escapeHtml(formatEventDateTime(event.event_date))}</div>
            </div>
            <div class="attendance-event-badges">
              <span class="attendance-pill present">${presentMembers.length} present</span>
              <span class="attendance-pill absent">${hasAttendance ? absentUsers.length : 0} absent</span>
              <span class="attendance-pill week">W: ${eventWeekPresent}/${eventWeekPoints} pts</span>
              <span class="attendance-pill month">M: ${eventMonthPresent}/${eventMonthPoints} pts</span>
            </div>
          </button>
          <div id="attendance-event-body-${event.id}" class="attendance-event-body" style="display: ${attendanceLogState.openEventIds[event.id] ? 'block' : 'none'};">
            <div class="attendance-event-actions">
              <button type="button" class="btn btn-secondary" onclick="editAttendanceEvent('${event.id}')">EDIT EVENT</button>
              <button type="button" class="btn btn-secondary" onclick="deleteAttendanceForEvent('${event.id}')">CLEAR ATTENDANCE LOG</button>
            </div>

            ${hasDateTabs ? `
              <div class="attendance-date-tabs" style="margin: 12px 0; display:flex; flex-wrap:wrap; gap:8px;">
                ${dateKeys.map(dateKey => `
                  <button type="button" class="btn btn-xs ${selectedDateKey === dateKey ? 'btn-primary' : 'btn-secondary'}" onclick="selectAttendanceDate('${event.id}', '${dateKey}')">
                    ${escapeHtml(formatAttendanceDateKey(dateKey))}
                  </button>
                `).join("")}
              </div>
            ` : ``}

            <div class="attendance-section">
              <div class="attendance-section-title">Present members</div>
              ${presentMembers.length > 0 ? presentMembers.map(record => `
                <div class="attendance-member-row present">
                  <div>
                    <div class="attendance-member-name">${escapeHtml(record.user?.ign || "Unknown member")}</div>
                    <div class="attendance-member-meta">Points: ${record.points_awarded ?? 0}${record.attendance_date ? ` | Date: ${formatDate(record.attendance_date)}` : ''}</div>
                  </div>
                  <div class="attendance-member-actions">
                    <span class="attendance-status-pill present">PRESENT</span>
                    <button type="button" class="btn-xs btn-danger" onclick="toggleAttendanceStatus('${event.id}', '${record.user_id}', true, '${selectedDateKey}', '${record.id}')">MARK ABSENT</button>
                    <button type="button" class="btn-xs btn-secondary" onclick="editAttendancePoints('${record.id}', ${record.points_awarded || 0})">EDIT POINTS</button>
                    <button type="button" class="btn-xs btn-danger" onclick="deleteAttendanceRecord('${record.id}')">DELETE ATTENDANCE RECORD</button>
                  </div>
                </div>
              `).join("") : `<div class="attendance-empty-state">No members marked present yet.</div>`}
            </div>

            <div class="attendance-section">
              <div class="attendance-section-title">Absent members</div>
              ${hasAttendance ? absentUsers.length > 0 ? absentUsers.map(user => `
                <div class="attendance-member-row absent">
                  <div class="attendance-member-name">${escapeHtml(user.ign || "Unknown member")}</div>
                  <div class="attendance-member-actions">
                    <span class="attendance-status-pill absent">ABSENT</span>
                    <button type="button" class="btn-xs btn-success" onclick="toggleAttendanceStatus('${event.id}', '${user.id}', false, '${selectedDateKey}')">MARK PRESENT</button>
                  </div>
                </div>
              `).join("") : `<div class="attendance-empty-state">Everyone is marked present.</div>` : `<div class="attendance-empty-state">No attendance recorded yet for this event.</div>`}
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<p class="status-text error">Error loading attendance: ${err.message}</p>`;
  }
}

async function toggleAttendanceStatus(eventId, userId, currentlyPresent, attendanceDateKey = null, attendanceRecordId = null) {
  const event = attendanceLogState.events.find(item => item.id === eventId);
  let existing = null;

  if (attendanceRecordId) {
    existing = attendanceLogState.attendance.find(record => record.id === attendanceRecordId);
  } else if (attendanceDateKey) {
    existing = attendanceLogState.attendance.find(record =>
      record.event_id === eventId &&
      record.user_id === userId &&
      getAttendanceDateKey(record.attendance_date) === attendanceDateKey
    );
  }

  const nextAttended = !currentlyPresent;

  try {
    if (existing) {
      const { error } = await supabase
        .from("attendance")
        .update({
          attended: nextAttended,
          points_awarded: nextAttended ? (event?.points || 0) : 0,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);

      if (error) throw error;
    } else if (nextAttended) {
      const attendanceDate = attendanceDateKey ? new Date(attendanceDateKey) : new Date();
      const monthYear = getAttendanceMonthYear(attendanceDate.toISOString());

      const { error } = await supabase
        .from("attendance")
        .insert([{
          event_id: eventId,
          user_id: userId,
          attended: true,
          points_awarded: event?.points || 0,
          attendance_date: attendanceDate.toISOString(),
          month_year: monthYear,
          updated_at: new Date().toISOString()
        }]);

      if (error) throw error;
    }

    showStatus("attendance-status", nextAttended ? "Member marked present." : "Member marked absent.", "success");
    await loadAttendance();
  } catch (err) {
    showStatus("attendance-status", `Error updating attendance: ${err.message}`, "error");
  }
}

async function deleteAttendanceRecord(attendanceId) {
  if (!confirm("Delete this attendance record?")) return;

  try {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("id", attendanceId);

    if (error) throw error;
    showStatus("attendance-status", "Attendance record deleted.", "success");
    await loadAttendance();
  } catch (err) {
    showStatus("attendance-status", `Error deleting attendance: ${err.message}`, "error");
  }
}

async function deleteAttendanceForEvent(eventId) {
  if (!confirm("Clear all attendance records for this event?")) return;

  try {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("event_id", eventId);

    if (error) throw error;
    showStatus("attendance-status", "Attendance log cleared for this event.", "success");
    await loadAttendance();
  } catch (err) {
    showStatus("attendance-status", `Error clearing attendance log: ${err.message}`, "error");
  }
}

async function editAttendanceEvent(eventId) {
  const event = attendanceLogState.events.find(item => item.id === eventId);
  if (!event) return;

  const newName = prompt("Enter event name:", event.name || "");
  if (newName === null) return;

  const newDescription = prompt("Enter description:", event.description || "");
  const newPoints = prompt("Enter points:", event.points || 0);
  const newDate = prompt("Enter event date/time (YYYY-MM-DDTHH:mm):", event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : "");

  try {
    const { error } = await supabase
      .from("events")
      .update({
        name: newName.trim() || event.name,
        description: newDescription || null,
        points: parseInt(newPoints, 10) || 0,
        event_date: newDate || null,
        month_year: newDate ? newDate.slice(0, 7) : event.month_year || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", eventId);

    if (error) throw error;
    showStatus("attendance-status", "Event updated successfully.", "success");
    await loadAttendance();
  } catch (err) {
    showStatus("attendance-status", `Error updating event: ${err.message}`, "error");
  }
}


async function undoLastBulk() {
  if (!lastBulkInsertedIds || lastBulkInsertedIds.length === 0) {
    showStatus('bulk-status', 'No recent bulk to undo.', 'error');
    return;
  }
  if (!confirm(`Undo last bulk action and delete ${lastBulkInsertedIds.length} attendance records?`)) return;
  try {
    const { error } = await supabase.from('attendance').delete().in('id', lastBulkInsertedIds);
    if (error) throw error;
    showStatus('bulk-status', `✓ Undone ${lastBulkInsertedIds.length} attendance records.`, 'success');
    lastBulkInsertedIds = [];
    loadBulkMembers();
    loadAttendance();
  } catch (err) {
    showStatus('bulk-status', `Error undoing bulk: ${err.message}`, 'error');
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
      .select("id, event_id, points_awarded")
      .eq("id", attendanceId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!record) {
      throw new Error("Attendance record not found.");
    }

    const pointsAwarded = attended ? (record.points_awarded || 0) : 0;

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
  // bulk search removed per admin request (hidden in UI)

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

      // Set bulk attendance date to today
      const dateInput = document.getElementById("bulk-attendance-date");
      if (dateInput) {
        const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        dateInput.value = dateString;
      }
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
window.parseBulkPaste = parseBulkPaste;
window.applyBulkAttendance = applyBulkAttendance;
window.loadAttendance = loadAttendance;
window.toggleAttendance = toggleAttendance;
window.toggleAttendanceCard = toggleAttendanceCard;
window.selectAttendanceDate = selectAttendanceDate;
window.toggleAttendanceStatus = toggleAttendanceStatus;
window.deleteAttendanceRecord = deleteAttendanceRecord;
window.deleteAttendanceForEvent = deleteAttendanceForEvent;
window.editAttendanceEvent = editAttendanceEvent;
window.editAttendancePoints = editAttendancePoints;
window.deleteAttendance = deleteAttendance;
window.loadMonthlyPoints = loadMonthlyPoints;
window.setEventsTab = setEventsTab;
window.toggleAllBulkMembers = toggleAllBulkMembers;
