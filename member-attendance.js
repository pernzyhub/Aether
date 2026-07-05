import { supabase } from './lib/supabaseClient.js';
import { logout, setActiveNavLink } from './lib/memberAuth.js';

// configurable week window (days) - override via `window.WEEK_WINDOW_DAYS`
const WEEK_WINDOW_DAYS = (typeof window !== 'undefined' && window.WEEK_WINDOW_DAYS) ? parseInt(window.WEEK_WINDOW_DAYS, 10) : 14;

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

function formatDate(dateValue) {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatTime(dateValue) {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

window.logout = logout;

async function loadSheet() {
  const input = document.getElementById('sheet-month');
  const container = document.getElementById('attendance-sheet');
  const month = input.value || (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`; })();
  container.innerHTML = '<p style="color:#aaa">Loading...</p>';

  try {
    const { data: events, error: evErr } = await supabase
      .from('events')
      .select('id, name, event_date')
      .or(`month_year.eq.${month},and(event_date.gte.${month}-01,event_date.lt.${month}-31)`)
      .order('event_date', { ascending: true });

    if (evErr) throw new Error(`Events query failed: ${evErr.message}`);

    const { data: users, error: usErr } = await supabase
      .from('clan_users')
      .select('id, ign')
      .eq('is_active', true)
      .order('ign', { ascending: true });

    if (usErr) throw new Error(`Users query failed: ${usErr.message}`);

    if (!events || events.length === 0) {
      container.innerHTML = `<p style="color:#ffaa00">No events found for ${month}</p>`;
      return;
    }

    if (!users || users.length === 0) {
      container.innerHTML = `<p style="color:#ffaa00">No active members found</p>`;
      return;
    }

    const eventIds = events.map(e => e.id);

    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('id, user_id, event_id, attended, points_awarded, month_year, attendance_date, created_at')
      .in('event_id', eventIds);

    if (attErr) throw new Error(`Attendance query failed: ${attErr.message}`);

    // Build a lookup of the latest attendance record per event+user+date (date-keyed)
    const attendanceMap = {}; // key: eventId::userId::YYYY-MM-DD -> record
    (attendance || []).forEach(a => {
      const dt = a.attendance_date ? new Date(a.attendance_date) : (a.created_at ? new Date(a.created_at) : null);
      if (!dt) return;
      const dateKey = dt.toISOString().slice(0,10);
      const key = `${a.event_id}::${a.user_id}::${dateKey}`;
      const existing = attendanceMap[key];
      const aTs = dt.getTime();
      const existingTs = existing ? (existing.attendance_date ? new Date(existing.attendance_date).getTime() : (existing.created_at ? new Date(existing.created_at).getTime() : 0)) : 0;
      if (!existing || aTs > existingTs) attendanceMap[key] = a;
    });

    // Build occurrence list: each event occurrence (event_id + dateKey)
    const occurrenceList = [];
    events.forEach(ev => {
      const dateSet = new Set();

      (attendance || []).forEach(a => {
        if (a.event_id !== ev.id) return;
        const dt = a.attendance_date ? new Date(a.attendance_date) : (a.created_at ? new Date(a.created_at) : null);
        if (!dt || Number.isNaN(dt.getTime())) return;
        dateSet.add(dt.toISOString());
      });

      if (dateSet.size === 0 && ev.event_date) {
        const dt = new Date(ev.event_date);
        if (!Number.isNaN(dt.getTime())) {
          dateSet.add(dt.toISOString());
        }
      }

      const dates = Array.from(dateSet).sort();
      dates.forEach(dtIso => {
        occurrenceList.push({
          eventId: ev.id,
          eventName: ev.name || 'Event',
          dateKey: dtIso.slice(0,10),
          dateTime: dtIso
        });
      });
    });

    occurrenceList.sort((a, b) => {
      if (a.dateTime !== b.dateTime) return a.dateTime.localeCompare(b.dateTime);
      return a.eventName.localeCompare(b.eventName);
    });

    // Compute weekly and monthly progress per user based on unique occurrences
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - (WEEK_WINDOW_DAYS - 1)); // include today
    const monthlyTarget = month; // 'YYYY-MM'
    const progressMap = {};
    users.forEach(u => progressMap[u.id] = { weekPoints: 0, weekAttended: 0, monthPoints: 0, monthAttended: 0 });
    Object.values(attendanceMap).forEach(a => {
      const uid = a.user_id;
      if (!progressMap[uid]) return;
      const dt = a.attendance_date ? new Date(a.attendance_date) : (a.created_at ? new Date(a.created_at) : null);
      if (!dt) return;
      const my = a.month_year || dt.toISOString().slice(0,7);
      if (a.attended) {
        if (dt >= weekAgo) {
          progressMap[uid].weekPoints += a.points_awarded || 0;
          progressMap[uid].weekAttended += 1;
        }
        if (my === monthlyTarget) {
          progressMap[uid].monthPoints += a.points_awarded || 0;
          progressMap[uid].monthAttended += 1;
        }
      }
    });

    // Build table with Week and Month progress columns
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const thead = document.createElement('thead');
    let head = '<tr style="background:#111;color:#fff;position:sticky;top:0;">';
    head += '<th style="padding:10px; text-align:left; min-width:200px; font-weight:700;">Member</th>';
    head += '<th style="padding:10px; text-align:center; font-size:11px;">Week</th>';
    head += '<th style="padding:10px; text-align:center; font-size:11px;">Month</th>';
    occurrenceList.forEach(o => {
      const displayDate = formatDate(o.dateTime);
      const displayTime = formatTime(o.dateTime);
      head += `<th style="padding:10px; text-align:center; font-size:11px;"><div style="max-width:140px;">${escapeHtml(o.eventName)}<br/><small style=\"color:#999\">${escapeHtml(displayTime)} ${escapeHtml(displayDate)}</small></div></th>`;
    });
    head += '</tr>';
    thead.innerHTML = head;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    users.forEach(u => {
      let row = `<tr style="border-bottom:1px solid #222;"><td style="padding:10px; font-weight:600; color:#00ff88;">${escapeHtml(u.ign || 'Unknown')}</td>`;
      const prog = progressMap[u.id] || { weekPoints: 0, weekAttended: 0, monthPoints: 0, monthAttended: 0 };
      row += `<td style="padding:10px; text-align:center; color:#b8ffb8;">${prog.weekAttended}/${prog.weekPoints}</td>`;
      row += `<td style="padding:10px; text-align:center; color:#ffaa00;">${prog.monthAttended}/${prog.monthPoints}</td>`;

      occurrenceList.forEach(o => {
        const key = `${o.eventId}::${u.id}::${o.dateKey}`;
        const match = attendanceMap[key] || null;
        const status = match ? (match.attended === true ? '✔️' : '⏳') : '';
        const cellClass = match ? (match.attended === true ? 'attendance-attended' : 'attendance-pending') : 'attendance-missing';
        row += `<td class="${cellClass}" style="padding:10px; text-align:center; color:#ccc;">${status}</td>`;
      });

      row += '</tr>';
      tbody.innerHTML += row;
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);

    // Diagnostic: toggle raw attendance rows for debugging
    (function addDiagnosticView() {
      let diagContainer = document.getElementById('attendance-diagnostic-container');
      if (!diagContainer) {
        diagContainer = document.createElement('div');
        diagContainer.id = 'attendance-diagnostic-container';
        diagContainer.style.marginTop = '12px';

        const btn = document.createElement('button');
        btn.textContent = 'Toggle Raw Attendance Data';
        btn.className = 'btn btn-secondary';
        btn.style.marginBottom = '8px';
        btn.onclick = () => {
          const pre = diagContainer.querySelector('pre');
          if (pre) pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
        };

        const pre = document.createElement('pre');
        pre.style.display = 'none';
        pre.style.maxHeight = '300px';
        pre.style.overflow = 'auto';
        pre.style.background = '#07110a';
        pre.style.color = '#b8ffb8';
        pre.style.padding = '10px';
        pre.style.border = '1px solid #113';
        pre.style.borderRadius = '6px';
        pre.textContent = JSON.stringify(attendance || [], null, 2);

        diagContainer.appendChild(btn);
        diagContainer.appendChild(pre);
        container.appendChild(diagContainer);
      } else {
        const pre = diagContainer.querySelector('pre');
        if (pre) pre.textContent = JSON.stringify(attendance || [], null, 2);
      }
    })();
  } catch (err) {
    console.error('Load sheet error:', err);
    container.innerHTML = `<p style="color:#f66">⚠️ Error: ${escapeHtml(err.message)}</p>`;
  }
}

window.addEventListener('load', () => {
  const input = document.getElementById('sheet-month');
  const today = new Date();
  input.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('sheet-load').addEventListener('click', loadSheet);
  setActiveNavLink();
  loadSheet();
});
