import { supabase } from './lib/supabaseClient.js';

let adminPending = [];
let adminPast = [];

async function loadAdminBVRequests() {
  const container = document.getElementById('bv-requests-list');
  const historyContainer = document.getElementById('bv-requests-history-list');
  if (container) container.innerHTML = '<p>Loading BV requests...</p>';
  if (historyContainer) historyContainer.innerHTML = '<p>Loading history...</p>';

  try {
    const { data: pending, error: pErr } = await supabase.from('bv_requests').select('*, clan_users(ign)').eq('status','pending').order('created_at',{ascending:false});
    if (pErr) throw pErr;
    adminPending = pending || [];

    const { data: past, error: hErr } = await supabase.from('bv_requests').select('*, clan_users(ign)').in('status',['approved','denied']).order('updated_at',{ascending:false}).limit(200);
    if (hErr) throw hErr;
    adminPast = past || [];

    renderAdminLists();
  } catch (err) {
    if (container) container.innerHTML = `<p class="status-text error">Error loading BV requests: ${err.message}</p>`;
    if (historyContainer) historyContainer.innerHTML = `<p class="status-text error">Error loading history: ${err.message}</p>`;
  }
}

function renderAdminLists() {
  const container = document.getElementById('bv-requests-list');
  const historyContainer = document.getElementById('bv-requests-history-list');
  const searchTerm = (document.getElementById('bv-requests-search')?.value || '').trim().toLowerCase();

  const filteredPending = adminPending.filter(r => {
    const ign = (r.clan_users?.ign || '').toLowerCase();
    const reason = (r.reason || '').toLowerCase();
    return ign.includes(searchTerm) || reason.includes(searchTerm);
  });

  if (container) {
    if (!filteredPending || filteredPending.length === 0) container.innerHTML = '<p>No pending BV requests.</p>';
    else container.innerHTML = filteredPending.map(r => `
      <div class="list-item compact">
        <div class="list-item-content compact">
          <div class="list-item-title compact">${escapeHtml(r.clan_users?.ign||'Unknown')}</div>
          <div class="list-item-meta">${escapeHtml(r.reason||'')}</div>
          <div class="list-item-meta">${escapeHtml((r.status||'').toUpperCase())}</div>
        </div>
        <div class="list-item-actions compact">
          <button class="btn-xs btn-success" onclick="approveBVRequest('${r.id}')">APPROVE</button>
          <button class="btn-xs btn-danger" onclick="denyBVRequest('${r.id}')">DENY</button>
          <button class="btn-xs btn-danger" onclick="deleteBVRequest('${r.id}')">DEL</button>
        </div>
      </div>
    `).join('');
  }

  if (historyContainer) {
    const filteredPast = adminPast.filter(r => {
      const ign = (r.clan_users?.ign || '').toLowerCase();
      const reason = (r.reason || '').toLowerCase();
      return ign.includes(searchTerm) || reason.includes(searchTerm);
    });
    if (!filteredPast || filteredPast.length === 0) historyContainer.innerHTML = '<p>No history yet.</p>';
    else historyContainer.innerHTML = filteredPast.map(r => `
      <div class="list-item compact">
        <div class="list-item-content compact">
          <div class="list-item-title compact">${escapeHtml(r.clan_users?.ign||'Unknown')}</div>
          <div class="list-item-meta">${escapeHtml(r.reason||'')} • ${escapeHtml((r.status||'').toUpperCase())}</div>
        </div>
      </div>
    `).join('');
  }
}

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

async function approveBVRequest(id) {
  if (!confirm('Approve this BV request?')) return;
  try { const { error } = await supabase.from('bv_requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; loadAdminBVRequests(); } catch (e) { alert('Error: '+e.message); }
}

async function denyBVRequest(id) {
  if (!confirm('Deny this BV request?')) return;
  try { const { error } = await supabase.from('bv_requests').update({ status: 'denied', updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; loadAdminBVRequests(); } catch (e) { alert('Error: '+e.message); }
}

async function deleteBVRequest(id) {
  if (!confirm('Delete this BV request?')) return;
  try { const { error } = await supabase.from('bv_requests').delete().eq('id', id); if (error) throw error; loadAdminBVRequests(); } catch (e) { alert('Error: '+e.message); }
}

window.approveBVRequest = approveBVRequest;
window.denyBVRequest = denyBVRequest;
window.deleteBVRequest = deleteBVRequest;

window.addEventListener('load', () => setTimeout(() => { 
  try { 
    loadAdminBVRequests();
    const search = document.getElementById('bv-requests-search');
    if (search) search.addEventListener('input', () => setTimeout(() => renderAdminLists(), 250));
    const refresh = document.getElementById('bv-requests-refresh-btn');
    if (refresh) refresh.addEventListener('click', () => loadAdminBVRequests());
    const exportBtn = document.getElementById('bv-requests-export');
    if (exportBtn) exportBtn.addEventListener('click', () => exportAdminPendingCsv());
  } catch(e){ }
}, 120));

function exportAdminPendingCsv() {
  const rows = adminPending.map(r => [r.clan_users?.ign || '', r.reason || '', r.status || '', r.created_at || '']);
  const csv = [['IGN','Selection','Status','Created']].concat(rows).map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'admin_bv_pending.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
