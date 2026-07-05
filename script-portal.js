import { supabase } from './lib/supabaseClient.js';
import { getMemberSession, ensureSupabaseSession, logout, setActiveNavLink } from './lib/memberAuth.js';

let currentClanUser = null;
let currentUser = null;

const fallbackAnnouncements = [
  {
    id: "fallback-announcement-1",
    title: "Welcome to Aether Clan",
    content: "Check the portal for updates, upcoming events, and clan announcements.",
    created_at: new Date().toISOString()
  }
];

const fallbackRules = [
  {
    id: "fallback-rule-1",
    order_num: 1,
    title: "Be Respectful",
    content: "Treat every member and guest with respect in and out of game.",
    is_active: true
  },
  {
    id: "fallback-rule-2",
    order_num: 2,
    title: "Show Up",
    content: "Join clan events and stay engaged with the community.",
    is_active: true
  }
];

const fallbackEvents = [
  {
    id: "fallback-event-1",
    name: "Weekly Clan Gathering",
    description: "A casual meetup for updates, socials, and activity planning.",
    points: 10,
    event_date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    is_active: true
  }
];

async function loadUser() {
  const supabaseSession = await ensureSupabaseSession();
  const { data } = await supabase.auth.getSession();
  const user = supabaseSession?.user || data?.session?.user || null;
  const memberSession = getMemberSession();

  if (!user && !memberSession) {
    window.location.replace("/access-gate.html");
    return;
  }

  if (!user && memberSession) {
    currentUser = { id: memberSession.id };
  } else {
    currentUser = user;
  }

  const userId = currentUser?.id || memberSession?.id;

  // Load clan user data
  let { data: clanUser, error } = await supabase
    .from("clan_users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error && (error.code === 'PGRST116' || error.message.includes('No rows found'))) {
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
    } else {
      clanUser = newClanUser;
      error = null;
    }
  } else if (error) {
    console.error("Error loading clan user:", error);
  }

  if (!error && clanUser) {
    currentClanUser = clanUser;
    if (clanUser.is_active === false) {
      await logout();
      return;
    }
  }

  if (memberSession?.needsPasswordChange) {
    window.location.href = "/settings.html";
    return;
  }

  const isAdmin = user?.app_metadata?.role && (user.app_metadata.role === "admin" || user.app_metadata.role === "superuser");

  // Check if user is admin to show admin menu
  const adminMenuItem = document.getElementById("admin-menu-item");
  if (adminMenuItem && isAdmin) {
    adminMenuItem.style.display = "inline-flex";
  }

  // Set welcome text using IGN if available
  const username = currentClanUser?.ign || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || memberSession?.ign || "MEMBER";
  const welcomeEl = document.getElementById("welcome-text");
  if (welcomeEl) {
    welcomeEl.textContent = `WELCOME, ${username.toUpperCase()}`;
  }
}

function getCachedItems(cacheKey) {
  try {
    const cachedValue = localStorage.getItem(cacheKey);
    return cachedValue ? JSON.parse(cachedValue) : null;
  } catch {
    return null;
  }
}

function saveCachedItems(cacheKey, value) {
  localStorage.setItem(cacheKey, JSON.stringify(value));
}

function renderAnnouncements(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = "<p>No announcements yet.</p>";
    return;
  }

  container.innerHTML = items.map(ann => `
    <div class="announcement-item">
      <div class="announcement-title">${escapeHtml(ann.title)}</div>
      <div class="announcement-date">${new Date(ann.created_at).toLocaleDateString()}</div>
      <div class="announcement-content">${ann.content || ''}</div>
    </div>
  `).join("");
}

function renderRules(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = "<p>No rules yet.</p>";
    return;
  }

  container.innerHTML = items.map(rule => `
    <div class="rule-item">
      <div class="rule-number">${rule.order_num}</div>
      <div class="rule-text">
        <strong>${escapeHtml(rule.title)}:</strong> ${rule.content || ''}
      </div>
    </div>
  `).join("");
}

function renderEvents(items, container) {
  if (!items || items.length === 0) {
    container.innerHTML = "<p>No events yet.</p>";
    return;
  }

  container.innerHTML = items.map(event => `
    <div class="event-item ${!event.is_active ? 'event-inactive' : ''}">
      <div class="event-title">${escapeHtml(event.name)} <span class="event-points">${event.points} pts</span></div>
      <div class="event-meta">
        ${event.description ? escapeHtml(event.description) : 'No description'}
        ${event.event_date ? `| ${new Date(event.event_date).toLocaleString()}` : ''}
      </div>
      <div class="event-status">
        Status: <strong style="color: ${event.is_active ? '#00ff88' : '#ff4444'};">
          ${event.is_active ? 'Active' : 'Inactive'}
        </strong>
      </div>
    </div>
  `).join("");
}

async function loadAnnouncements() {
  const container = document.getElementById("announcements-list");
  if (!container) return;

  const cachedAnnouncements = getCachedItems("aether_announcements_cache") || [];
  if (cachedAnnouncements.length > 0) {
    renderAnnouncements(cachedAnnouncements, container);
  } else {
    container.innerHTML = "<p>Loading announcements...</p>";
  }

  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    const items = (data && data.length > 0) ? data : fallbackAnnouncements;

    if (error) {
      saveCachedItems("aether_announcements_cache", fallbackAnnouncements);
      renderAnnouncements(fallbackAnnouncements, container);
      return;
    }

    if (items && items.length > 0) {
      saveCachedItems("aether_announcements_cache", items);
      renderAnnouncements(items, container);
    } else if (cachedAnnouncements.length > 0) {
      renderAnnouncements(cachedAnnouncements, container);
    } else {
      saveCachedItems("aether_announcements_cache", fallbackAnnouncements);
      renderAnnouncements(fallbackAnnouncements, container);
    }
  } catch (err) {
    saveCachedItems("aether_announcements_cache", fallbackAnnouncements);
    renderAnnouncements(fallbackAnnouncements, container);
  }
}

async function loadRules() {
  const container = document.getElementById("rules-list");
  if (!container) return;

  const cachedRules = getCachedItems("aether_rules_cache") || [];
  if (cachedRules.length > 0) {
    renderRules(cachedRules, container);
  } else {
    container.innerHTML = "<p>Loading rules...</p>";
  }

  try {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .order("order_num", { ascending: true });

    const items = (data && data.length > 0) ? data : fallbackRules;

    if (error) {
      saveCachedItems("aether_rules_cache", fallbackRules);
      renderRules(fallbackRules, container);
      return;
    }

    if (items && items.length > 0) {
      saveCachedItems("aether_rules_cache", items);
      renderRules(items, container);
    } else if (cachedRules.length > 0) {
      renderRules(cachedRules, container);
    } else {
      saveCachedItems("aether_rules_cache", fallbackRules);
      renderRules(fallbackRules, container);
    }
  } catch (err) {
    saveCachedItems("aether_rules_cache", fallbackRules);
    renderRules(fallbackRules, container);
  }
}

async function loadEvents() {
  const container = document.getElementById("events-list");
  if (!container) return;

  const cachedEvents = getCachedItems("aether_events_cache") || [];
  if (cachedEvents.length > 0) {
    renderEvents(cachedEvents, container);
  } else {
    container.innerHTML = "<p>Loading events...</p>";
  }

  await ensureSupabaseSession();

  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("event_date", { ascending: false });

    const items = (data && data.length > 0) ? data : fallbackEvents;

    if (error) {
      saveCachedItems("aether_events_cache", fallbackEvents);
      renderEvents(fallbackEvents, container);
      return;
    }

    if (items && items.length > 0) {
      saveCachedItems("aether_events_cache", items);
      renderEvents(items, container);
    } else if (cachedEvents.length > 0) {
      renderEvents(cachedEvents, container);
    } else {
      saveCachedItems("aether_events_cache", fallbackEvents);
      renderEvents(fallbackEvents, container);
    }
  } catch (err) {
    saveCachedItems("aether_events_cache", fallbackEvents);
    renderEvents(fallbackEvents, container);
  }
}

// Compute next occurrence for an event record from DB
function computeNextOccurrenceForEvent(event) {
  try {
    const now = new Date();
    // If explicit event_date and it's in the future, use it
    if (event.event_date) {
      const d = new Date(event.event_date);
      if (d > now) return d;
    }

    // Recurring events: use recurrence_type, recurrence_days (JSON), recurrence_time
    if (event.is_recurring) {
      const type = event.recurrence_type || 'weekly';
      const time = event.recurrence_time || '00:00';
      const [hh, mm] = (time || '00:00').split(':').map(n => parseInt(n || '0', 10));
      const today = new Date();

      if (type === 'weekly' || type === 'biweekly') {
        let days = [];
        try { days = event.recurrence_days ? JSON.parse(event.recurrence_days) : []; } catch { days = []; }
        if (!Array.isArray(days) || days.length === 0) {
          days = [today.getDay()];
        }
        // find nearest day in days array
        let best = null;
        for (const dval of days) {
          const target = parseInt(dval, 10);
          let daysAhead = (target - today.getDay() + 7) % 7;
          const candidate = new Date(today);
          candidate.setDate(today.getDate() + daysAhead);
          candidate.setHours(hh, mm, 0, 0);
          // if candidate is today but time already passed, move to next week's same day
          if (daysAhead === 0 && candidate <= now) candidate.setDate(candidate.getDate() + 7);
          if (!best || candidate < best) best = candidate;
        }
        // if biweekly and best is in past (shouldn't happen), add 14 days
        if (type === 'biweekly' && best && best <= now) {
          best.setDate(best.getDate() + 14);
        }
        return best;
      }

      if (type === 'monthly') {
        const candidate = new Date(today);
        candidate.setMonth(today.getMonth() + 1);
        candidate.setHours(hh, mm, 0, 0);
        return candidate;
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

function formatTimeRemaining(ms) {
  if (ms <= 0) return 'Starting now';
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400); const hrs = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60); const secs = s % 60;
  return `${days}d ${String(hrs).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s`;
}

let upcomingInterval = null;
async function loadUpcomingEvent() {
  const container = document.getElementById('upcoming-info');
  if (!container) return;
  container.innerHTML = '<p style="color:#aaa;">Loading upcoming events...</p>';

  try {
    await ensureSupabaseSession();
    const { data: events, error } = await supabase
      .from('events')
      .select('id, name, description, event_date, is_recurring, recurrence_type, recurrence_days, recurrence_time, points')
      .eq('is_active', true);
    
    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`);
    }
    
    if (!events || events.length === 0) {
      container.innerHTML = '<p style="color:#ccc">No upcoming events scheduled.</p>';
      return;
    }

    // compute next 3 occurrences
    const upcomingOccurrences = [];
    for (const ev of events) {
      const next = computeNextOccurrenceForEvent(ev);
      if (!next) continue;
      upcomingOccurrences.push({ date: next, event: ev });
    }

    if (upcomingOccurrences.length === 0) {
      container.innerHTML = '<p style="color:#ccc">No upcoming occurrences found.</p>';
      return;
    }

    // sort by date and get first 3
    upcomingOccurrences.sort((a, b) => a.date - b.date);
    const top3 = upcomingOccurrences.slice(0, 3);

    // render all 3 events without RSVP buttons
    const eventsHtml = top3.map((item, idx) => {
      const { date, event } = item;
      const isClosest = idx === 0;
      const highlightColor = isClosest ? 'rgba(0, 255, 136, 0.15)' : 'rgba(0, 255, 136, 0.05)';
      const borderColor = isClosest ? '#00ff88' : 'rgba(0, 255, 136, 0.1)';
      
      return `
        <div style="background:${highlightColor}; border:1px solid ${borderColor}; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
          <div style="font-size:12px; color:${isClosest ? '#00ff88' : '#ccc'}; font-weight:600; margin-bottom:2px;">${isClosest ? '⭐ NEXT' : ''} ${escapeHtml(event.name)}</div>
          <div style="font-size:10px; color:#999;">${date.toLocaleString()}</div>
          <div style="font-size:10px; color:#ffaa00; margin-top:2px;">${event.points} pts</div>
          ${event.description ? `<div style="font-size:10px; color:#bbb; margin-top:4px;">${escapeHtml(event.description)}</div>` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = eventsHtml;

  } catch (err) {
    console.error('Error in loadUpcomingEvent:', err);
    container.innerHTML = `<p style="color:#f66;">⚠️ Error: ${escapeHtml(err.message || 'Failed to load events')}</p>`;
  }
}

async function loadMemberAttendance() {
  const container = document.getElementById('my-attendance');
  if (!container) return;
  container.textContent = 'Loading...';
  try {
    await ensureSupabaseSession();
    const userId = currentClanUser?.id || null;
    if (!userId) { container.textContent = 'Please login to see your attendance.'; return; }

    // total points and total attended
    const [{ data: pointsData, error: pErr }, { data: attendedList, error: aErr }] = await Promise.all([
      supabase.from('attendance').select('points_awarded', { count: 'exact' }).eq('user_id', userId),
      supabase.from('attendance').select('*, events(name, event_date)').eq('user_id', userId).order('created_at', { ascending: false }).limit(12)
    ]);
    const totalPoints = (attendedList || []).reduce((s, r) => s + (r.points_awarded || 0), 0);
    const totalAttended = (attendedList || []).filter(r => r.attended).length;

    // Calculate current month stats for better accuracy
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Get all attendance records for the current month
    const { data: monthlyAttendance } = await supabase
      .from('attendance')
      .select('attended, points_awarded')
      .eq('user_id', userId)
      .eq('month_year', currentMonth);
    
    // Calculate monthly stats
    const monthlyAttended = (monthlyAttendance || []).filter(r => r.attended).length;
    const monthlyTotal = monthlyAttendance ? monthlyAttendance.length : 0;
    const monthlyPercent = monthlyTotal > 0 ? Math.round((monthlyAttended / monthlyTotal) * 100) : 0;

    const recentHtml = (attendedList || []).map(r => {
      const ev = r.events || {};
      return `<div style="padding:6px 0; border-bottom:1px solid #222; font-size:13px; color:#ccc">${escapeHtml(ev.name || 'Event')} · ${r.month_year || (ev.event_date ? new Date(ev.event_date).toLocaleDateString() : '')} · ${r.attended ? '<span style="color:#00ff88">Attended</span>' : '<span style="color:#ffcc66">RSVP/Not marked</span>'} · ${r.points_awarded || 0} pts</div>`;
    }).join('');

    container.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
        <div style="font-weight:700; color:#fff; font-size:14px">Total Points: <span style="color:#ffaa00">${totalPoints}</span></div>
        <div style="font-weight:700; color:#fff; font-size:14px">Events: <span style="color:#00ff88">${totalAttended}</span></div>
        <div style="font-weight:700; color:#fff; font-size:14px">This Month: <span style="color:#ffaa00">${monthlyPercent}%</span> <span style="color:#888;">(${monthlyAttended}/${monthlyTotal})</span></div>
      </div>
      <div style="margin-top:8px; max-height:260px; overflow:auto;">${recentHtml || '<div style="color:#888">No recent attendance.</div>'}</div>
    `;
  } catch (err) {
    container.textContent = `Error loading attendance: ${err.message}`;
  }
}


function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener("load", () => {
  window.setTimeout(async () => {
    await loadUser();
    loadAnnouncements();
    loadRules();
    loadEvents();
    loadUpcomingEvent();
    loadMemberAttendance();
    setActiveNavLink();
  }, 80);
});

window.addEventListener("storage", (event) => {
  if (event.key === "aether_announcements_cache") {
    loadAnnouncements();
  }
  if (event.key === "aether_rules_cache") {
    loadRules();
  }
  if (event.key === "aether_events_cache") {
    loadEvents();
  }
});

window.logout = logout;
