import { supabase } from './lib/supabaseClient.js';

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

async function loadSheet() {
  const input = document.getElementById('sheet-month');
  const container = document.getElementById('attendance-sheet');
  const month = input.value || (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`; })();
  container.innerHTML = '<p style="color:#aaa">Loading...</p>';

  try {
    // Fetch events for the month - handle NULL values properly
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
    
    // Fetch attendance - handle NULLS with COALESCE in the logic, not in query
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
    let head = '<tr style="background:#111;color:#fff;position:sticky;top:0;"><th style="padding:10px; text-align:left; min-width:180px; font-weight:700;">Member</th>';
    
    events.forEach(ev => {
      const eventDate = ev.event_date ? new Date(ev.event_date).toLocaleDateString() : 'No date';
      head += `<th style="padding:10px; text-align:center; font-size:11px;"><div style="max-width:80px;">${escapeHtml(ev.name || 'Event')}</div><small style="color:#999">${eventDate}</small></th>`;
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
        
        row += `<td style="padding:10px; text-align:center; color:#ccc;">${status}</td>`;
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
  loadSheet();
});
