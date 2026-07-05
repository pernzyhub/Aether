import { supabase } from './lib/supabaseClient.js';
import { logout, setActiveNavLink } from './lib/memberAuth.js';

// configurable week window (days) - alter by setting `window.WEEK_WINDOW_DAYS` in the console
const WEEK_WINDOW_DAYS = (typeof window !== 'undefined' && window.WEEK_WINDOW_DAYS) ? parseInt(window.WEEK_WINDOW_DAYS, 10) : 14;
    // Build a quick lookup of the latest attendance record per event+user
    const attendanceMap = {};
    (attendance || []).forEach(a => {
      const key = `${a.event_id}::${a.user_id}`;
      const existing = attendanceMap[key];
      const aDate = a.attendance_date ? new Date(a.attendance_date) : (a.created_at ? new Date(a.created_at) : null);
      const existingDate = existing ? (existing.attendance_date ? new Date(existing.attendance_date) : (existing.created_at ? new Date(existing.created_at) : null)) : null;
      if (!existing || (aDate && existingDate && aDate > existingDate) || (aDate && !existingDate)) {
        attendanceMap[key] = a;
      }
    });

    // Compute weekly and monthly progress per user
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6); // 7-day window including today
    const monthlyTarget = month; // 'YYYY-MM'
    const progressMap = {};
    users.forEach(u => progressMap[u.id] = { weekPoints: 0, weekAttended: 0, monthPoints: 0, monthAttended: 0 });
    (attendance || []).forEach(a => {
      const uid = a.user_id;
      if (!progressMap[uid]) return;
      const aDate = a.attendance_date ? new Date(a.attendance_date) : (a.created_at ? new Date(a.created_at) : null);
      if (!aDate) return;
      const my = a.month_year || aDate.toISOString().slice(0,7);
      if (a.attended) {
        if (aDate >= weekAgo) {
          progressMap[uid].weekPoints += a.points_awarded || 0;
          progressMap[uid].weekAttended += 1;
        }
        if (my === monthlyTarget) {
          progressMap[uid].monthPoints += a.points_awarded || 0;
          progressMap[uid].monthAttended += 1;
        }
      }
    });

    // Build table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    
    const thead = document.createElement('thead');
    // Add Member, Weekly, Monthly headers, then event columns
    let head = '<tr style="background:#111;color:#fff;position:sticky;top:0;'><th style="padding:10px; text-align:left; min-width:200px; font-weight:700;">Member</th>';
    head += `<th style="padding:10px; text-align:center; font-size:11px;">Week</th>`;
    head += `<th style="padding:10px; text-align:center; font-size:11px;">Month</th>`;
    events.forEach(ev => {
      const eventDate = ev.event_date ? new Date(ev.event_date).toLocaleDateString() : 'No date';
      head += `<th style="padding:10px; text-align:center; font-size:11px;\"><div style=\"max-width:110px;\">${escapeHtml(ev.name || 'Event')}</div><small>${eventDate}</small></th>`;
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

      events.forEach(ev => {
        const key = `${ev.id}::${u.id}`;
        const match = attendanceMap[key] || null;
        const status = match 
          ? (match.attended === true ? '✔️' : '⏳') 
          : '';
        const cellClass = match
          ? (match.attended === true ? 'attendance-attended' : 'attendance-pending')
          : 'attendance-missing';

        row += `<td class="${cellClass}" style="padding:10px; text-align:center; color:#ccc;">${status}</td>`;
      });
      row += '</tr>';
      tbody.innerHTML += row;
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('user_id, event_id, attended, month_year, created_at')
      .in('event_id', eventIds);

    if (attErr) throw new Error(`Attendance query failed: ${attErr.message}`);

    // Build table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    
    const thead = document.createElement('thead');
    let head = '<tr style="background:#111;color:#fff;position:sticky;top:0;"><th style="padding:10px; text-align:left; min-width:200px; font-weight:700;">Member</th>';
    
    events.forEach(ev => {
      const eventDate = ev.event_date ? new Date(ev.event_date).toLocaleDateString() : 'No date';
      head += `<th style="padding:10px; text-align:center; font-size:11px;"><div style="max-width:110px;">${escapeHtml(ev.name || 'Event')}</div><small>${eventDate}</small></th>`;
    });
    head += '</tr>';
    thead.innerHTML = head;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    users.forEach(u => {
      let row = `<tr style="border-bottom:1px solid #222;"><td style="padding:10px; font-weight:600; color:#00ff88;">${escapeHtml(u.ign || 'Unknown')}</td>`;
      events.forEach(ev => {
        // Find attendance record - handle NULL values
        const match = (attendance || []).find(a => 
          a.user_id === u.id && a.event_id === ev.id
        );
        
        // Display: ✔️ if attended, ⏳ if RSVP'd but not attended, empty if no record
        const status = match 
          ? (match.attended === true ? '✔️' : '⏳') 
          : '';
        const cellClass = match
          ? (match.attended === true ? 'attendance-attended' : 'attendance-pending')
          : 'attendance-missing';
        
        row += `<td class="${cellClass}" style="padding:10px; text-align:center; color:#ccc;">${status}</td>`;
      });
      row += '</tr>';
      tbody.innerHTML += row;
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
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
