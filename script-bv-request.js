import { supabase } from './lib/supabaseClient.js';
import { getMemberSession, ensureSupabaseSession, logout, setActiveNavLink, isAdminPreviewMode } from './lib/memberAuth.js';

let currentUser = null;
let currentClanUser = null;
const isAdminPreview = isAdminPreviewMode();

// UI state
let bvAllData = [];
let bvCurrentPage = 1;
const bvPageSize = 10;
let bvSort = 'newest';

async function checkAuthLocal() {
  if (isAdminPreview) {
    const welcomeEl = document.getElementById("welcome-text");
    if (welcomeEl) welcomeEl.textContent = "ADMIN PREVIEW MODE";
    return true;
  }

  const supabaseSession = await ensureSupabaseSession();
  const { data } = await supabase.auth.getSession();
  const user = supabaseSession?.user || data.session?.user;
  const memberSession = getMemberSession();
  if (!user && !memberSession) {
    window.location.href = '/';
    return false;
  }
  currentUser = user || { id: memberSession?.id };

  // try to load clan_user to get ign
  try {
    const { data: clanUser } = await supabase.from('clan_users').select('id, ign, is_active').eq('id', currentUser.id).maybeSingle();
    if (clanUser && clanUser.is_active === false) {
      alert('Your account is inactive. Contact an admin.');
      return false;
    }
    currentClanUser = clanUser;
    const username = clanUser?.ign || currentUser?.user_metadata?.full_name || currentUser?.email || 'MEMBER';
    const welcomeEl = document.getElementById('welcome-text'); if (welcomeEl) welcomeEl.textContent = `WELCOME, ${username.toUpperCase()}`;
  } catch (e) {
    // ignore
  }

  return true;
}

async function submitBVRequest(e) {
  e.preventDefault();
  const selection = document.getElementById('bv-select')?.value || null;
  const statusEl = document.getElementById('bv-request-status');

  if (!selection) { statusEl.textContent = 'Please choose a request type.'; statusEl.className = 'status-text error'; return; }

  statusEl.textContent = 'Submitting BV request...'; statusEl.className = 'status-text';
  try {
    const userId = currentUser?.id || null;
    if (!userId) throw new Error('No user session found.');

    const { error } = await supabase.from('bv_requests').insert([{ user_id: userId, amount: 0, reason: selection, status: 'pending' }]);
    if (error) throw error;
    statusEl.textContent = 'BV request submitted!'; statusEl.className = 'status-text success';
    document.getElementById('bv-request-form').reset();
    loadBVRequests();
  } catch (err) {
    statusEl.textContent = 'Error submitting BV request: ' + err.message;
    statusEl.className = 'status-text error';
  }
}

function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

async function loadBVRequests() {
  const container = document.getElementById('bv-requests-table');
  if (!container) return;
  container.innerHTML = '<p class="empty-state">Loading BV requests...</p>';

  const filter = document.getElementById('bv-filter')?.value || 'all';
  try {
    let query = supabase.from('bv_requests').select('*, clan_users(ign)').order('created_at', { ascending: false }).limit(50);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error } = await query;
    if (error) throw error;
    bvAllData = data || [];
    if (!bvAllData || bvAllData.length === 0) { container.innerHTML = '<p class="empty-state">No BV requests found.</p>'; updatePagination(); return; }

    applyBVSortAndRender();
  } catch (err) {
    container.innerHTML = `<p class="empty-state error">Error loading BV requests: ${err.message}</p>`;
  }
}

function applyBVSortAndRender() {
  const container = document.getElementById('bv-requests-table');
  if (!container) return;
  let list = [...bvAllData];
  switch (bvSort) {
    case 'oldest': list.sort((a,b)=> new Date(a.created_at) - new Date(b.created_at)); break;
    case 'amount_desc': list.sort((a,b)=> (b.amount||0)-(a.amount||0)); break;
    case 'amount_asc': list.sort((a,b)=> (a.amount||0)-(b.amount||0)); break;
    default: list.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
  }

  const total = list.length;
  const start = (bvCurrentPage - 1) * bvPageSize;
  const pageItems = list.slice(start, start + bvPageSize);

  const rows = pageItems.map(r => `
    <tr>
      <td>${escapeHtml(r.clan_users?.ign || 'Unknown')}</td>
      <td>${escapeHtml(r.reason || '')}</td>
      <td>${escapeHtml((r.status || 'pending').toUpperCase())}</td>
      <td>${formatDateTime(r.created_at)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="compact-table">
      <thead><tr><th>IGN</th><th>Selection</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  updatePagination(total);
}

function updatePagination(total=0) {
  const indicator = document.getElementById('bv-page-indicator');
  const prev = document.getElementById('bv-prev-page');
  const next = document.getElementById('bv-next-page');
  const pages = Math.max(1, Math.ceil((total || bvAllData.length) / bvPageSize));
  if (indicator) indicator.textContent = `Page ${bvCurrentPage} / ${pages}`;
  if (prev) prev.disabled = bvCurrentPage <= 1;
  if (next) next.disabled = bvCurrentPage >= pages;
}

function exportCurrentBVPageCsv() {
  let list = [...bvAllData];
  switch (bvSort) {
    case 'oldest': list.sort((a,b)=> new Date(a.created_at) - new Date(b.created_at)); break;
    case 'amount_desc': list.sort((a,b)=> (b.amount||0)-(a.amount||0)); break;
    case 'amount_asc': list.sort((a,b)=> (a.amount||0)-(b.amount||0)); break;
    default: list.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
  }
  const start = (bvCurrentPage - 1) * bvPageSize;
  const pageItems = list.slice(start, start + bvPageSize);
  const csv = [ ['IGN','BV','Reason','Proof URL','Status','Created'] ].concat(
    pageItems.map(r => [r.clan_users?.ign || '', r.amount || '', (r.reason||'').replace(/"/g,'""'), r.proof_image||'', r.status||'', r.created_at||''])
  ).map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `bv_requests_page_${bvCurrentPage}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  const d = document.createElement('div'); d.textContent = text; return d.innerHTML;
}

window.submitBVRequest = submitBVRequest;
window.openImageModal = (src) => {
  const modal = document.getElementById('image-modal'); if (!modal) return;
  const modalImage = document.getElementById('modal-image'); modalImage.src = src; modal.classList.add('show');
};

window.addEventListener('load', () => {
  setTimeout(async () => {
    const ok = await checkAuthLocal();
    if (!ok) return;
    document.getElementById('bv-filter')?.addEventListener('change', () => { bvCurrentPage = 1; loadBVRequests(); });
    document.getElementById('bv-sort')?.addEventListener('change', (e) => { bvSort = e.target.value || 'newest'; bvCurrentPage = 1; applyBVSortAndRender(); });
    document.getElementById('bv-prev-page')?.addEventListener('click', () => { bvCurrentPage = Math.max(1, bvCurrentPage - 1); applyBVSortAndRender(); });
    document.getElementById('bv-next-page')?.addEventListener('click', () => { bvCurrentPage = bvCurrentPage + 1; applyBVSortAndRender(); });
    document.getElementById('bv-export-csv')?.addEventListener('click', () => exportCurrentBVPageCsv());
    loadBVRequests();
    setActiveNavLink && setActiveNavLink();

    // modal close handlers
    document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => {
      document.getElementById('image-modal')?.classList.remove('show');
    }));
    document.getElementById('image-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'image-modal') document.getElementById('image-modal')?.classList.remove('show');
    });
  }, 60);
});
