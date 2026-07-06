import { supabase } from './lib/supabaseClient.js';

let adminPending = [];
let adminPast = [];
let adminBVTypes = [];

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
    loadAdminBVTypes();
  } catch (err) {
    if (container) container.innerHTML = `<p class="status-text error">Error loading BV requests: ${err.message}</p>`;
    if (historyContainer) historyContainer.innerHTML = `<p class="status-text error">Error loading history: ${err.message}</p>`;
  }
}

async function loadAdminBVTypes() {
  try {
    const { data, error } = await supabase.from('bv_request_types').select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    adminBVTypes = data || [];
    renderAdminBVTypes();
  } catch (e) {
    const el = document.getElementById('bv-types-admin-list');
    if (el) el.innerHTML = `<p class="status-text error">Error loading BV types: ${e.message}</p>`;
  }
}

function renderAdminBVTypes() {
  const el = document.getElementById('bv-types-admin-list');
  if (!el) return;
  if (!adminBVTypes || adminBVTypes.length === 0) { el.innerHTML = '<p class="empty-state">No BV types defined.</p>'; return; }
  el.innerHTML = adminBVTypes.map(t => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 4px; border-bottom:1px solid #111;">
      <div style="display:flex; gap:8px; align-items:center;">
        <strong style="min-width:100px;">${escapeHtml(t.key)}</strong>
        <span>${escapeHtml(t.label)}</span>
      </div>
      <div style="display:flex; gap:6px; align-items:center;">
        <label style="display:flex; align-items:center; gap:6px;">
          <input type="checkbox" ${t.is_active ? 'checked' : ''} onchange="toggleBVTypeActive('${t.id}', this.checked)" /> Active
        </label>
        <button class="btn-xs btn-danger" onclick="deleteBVType('${t.id}')">DEL</button>
      </div>
    </div>
  `).join('');
}

async function addBVType(e) {
  e && e.preventDefault && e.preventDefault();
  const key = document.getElementById('bv-type-key')?.value?.trim();
  const label = document.getElementById('bv-type-label')?.value?.trim();
  if (!key || !label) return alert('Provide key and label');
  try {
    const { error } = await supabase.from('bv_request_types').insert([{ key, label, is_active: true }]);
    if (error) throw error;
    document.getElementById('bv-type-form')?.reset();
    loadAdminBVTypes();
  } catch (err) { alert('Error adding type: '+err.message); }
}

async function toggleBVTypeActive(id, isActive) {
  try { const { error } = await supabase.from('bv_request_types').update({ is_active: isActive }).eq('id', id); if (error) throw error; loadAdminBVTypes(); } catch (e) { alert('Error: '+e.message); }
}

async function deleteBVType(id) {
  if (!confirm('Delete this BV type?')) return;
  try { const { error } = await supabase.from('bv_request_types').delete().eq('id', id); if (error) throw error; loadAdminBVTypes(); } catch (e) { alert('Error: '+e.message); }
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
window.addBVType = addBVType;
window.toggleBVTypeActive = toggleBVTypeActive;
window.deleteBVType = deleteBVType;

window.addEventListener('load', () => setTimeout(() => { 
  try { 
    loadAdminBVRequests();
    const search = document.getElementById('bv-requests-search');
    if (search) search.addEventListener('input', () => setTimeout(() => renderAdminLists(), 250));
    const refresh = document.getElementById('bv-requests-refresh-btn');
    if (refresh) refresh.addEventListener('click', () => loadAdminBVRequests());
    const exportBtn = document.getElementById('bv-requests-export');
    if (exportBtn) exportBtn.addEventListener('click', () => exportAdminPendingCsv());
    const typeForm = document.getElementById('bv-type-form'); if (typeForm) typeForm.addEventListener('submit', addBVType);
  } catch(e){ }
}, 120));

function exportAdminPendingCsv() {
  const rows = adminPending.map(r => [r.clan_users?.ign || '', r.reason || '', r.status || '', r.created_at || '']);
  const csv = [['IGN','Selection','Status','Created']].concat(rows).map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'admin_bv_pending.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
