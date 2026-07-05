import { supabase } from './lib/supabaseClient.js';

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

async function loadSheet() {
  const input = document.getElementById('sheet-month');
  const container = document.getElementById('attendance-sheet');
  const month = input.value || (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`; })();
  container.innerHTML = '<p style="color:#aaa">Loading...</p>';

  try {
    const { data: events } = await supabase
      .from('events')
      .select('id, name, event_date')
      .or(`month_year.eq.${month},event_date.gte.${month}-01,event_date.lt.${month}-31`)
      .order('event_date', { ascending: true });

    const { data: users } = await supabase
      .from('clan_users')
      .select('id, ign')
      .order('ign');

    const eventIds = (events || []).map(e => e.id);
    const { data: attendance } = await supabase
      .from('attendance')
      .select('user_id, event_id, attended, month_year, created_at')
      .in('event_id', eventIds || []);

    // Build table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    let head = '<tr style="background:#111;color:#fff"><th style="padding:8px; min-width:200px">Member</th>';
    events.forEach(ev => head += `<th style="padding:8px; text-align:center">${escapeHtml(ev.name)}<br/><small style=\"color:#999\">${ev.event_date ? new Date(ev.event_date).toLocaleDateString() : ''}</small></th>`);
    head += '</tr>';
    thead.innerHTML = head;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    users.forEach(u => {
      let row = `<tr style="border-bottom:1px solid #222"><td style="padding:8px; font-weight:700">${escapeHtml(u.ign)}</td>`;
      events.forEach(ev => {
        const match = (attendance || []).find(a => a.user_id === u.id && a.event_id === ev.id);
        row += `<td style="padding:8px; text-align:center">${match ? (match.attended ? '✔️' : '⏳') : ''}</td>`;
      });
      row += '</tr>';
      tbody.innerHTML += row;
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
  } catch (err) {
    container.innerHTML = `<p style="color:#f66">Error: ${err.message}</p>`;
  }
}

window.addEventListener('load', () => {
  const input = document.getElementById('sheet-month');
  const today = new Date();
  input.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  document.getElementById('sheet-load').addEventListener('click', loadSheet);
  loadSheet();
});
