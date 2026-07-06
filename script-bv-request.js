import { supabase } from './lib/supabaseClient.js';
import { getMemberSession, ensureSupabaseSession, logout, setActiveNavLink, isAdminPreviewMode } from './lib/memberAuth.js';

let currentUser = null;
let currentClanUser = null;
const isAdminPreview = isAdminPreviewMode();

// UI state
let bvAllData = [];
let requestedBVTypes = new Set();
let bvCurrentPage = 1;
const bvPageSize = 10;
let bvSort = 'newest';
let bvTypeMap = new Map();

async function checkAuthLocal() {
  const welcomeEl = document.getElementById("welcome-text");
  const statusEl = document.getElementById('bv-request-status');
  const badge = document.getElementById('adminPreviewBadge');
  const adminBtn = document.getElementById('return-to-admin-panel-btn');

  if (isAdminPreview) {
    if (badge) badge.style.display = 'block';
    if (adminBtn) adminBtn.style.display = 'inline-flex';

    const form = document.getElementById('bv-request-form');
    if (form) {
      form.querySelectorAll('input, select, textarea, button').forEach((el) => {
        el.disabled = true;
      });
    }
    if (statusEl) {
      statusEl.textContent = 'Preview mode: request submission is disabled.';
      statusEl.className = 'status-text';
    }
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

  currentUser = memberSession ? { id: memberSession.id, ign: memberSession.ign } : user;

  // try to load clan_user to get ign
  try {
    const { data: clanUser } = await supabase.from('clan_users').select('id, ign, is_active').eq('id', currentUser.id).maybeSingle();
    if (!clanUser) {
      alert('No member profile was found. Contact an admin to complete your account.');
      return false;
    }
    if (clanUser.is_active === false) {
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
    if (requestedBVTypes.has(selection)) {
      throw new Error('You have already requested this BV reason. You cannot request it again.');
    }
    const userId = currentUser?.id || null;
    if (!userId) throw new Error('No user session found.');

    const { data, error } = await supabase.rpc('create_bv_request', { target_user_id: userId, request_reason: selection, request_amount: 0, request_status: 'pending' });
    if (error) throw error;
    statusEl.textContent = 'BV request submitted!'; statusEl.className = 'status-text success';
    document.getElementById('bv-request-form').reset();
    loadBVRequests();
  } catch (err) {
    statusEl.textContent = 'Error submitting BV request: ' + err.message;
    statusEl.className = 'status-text error';
  }
}

const BV_TYPE_FALLBACKS = [
  { key: 'standard', label: 'Standard' },
  { key: 'event', label: 'Event' },
  { key: 'other', label: 'Other' }
];

async function loadBVTypes() {
  const select = document.getElementById('bv-select');
  if (!select) return;
  select.disabled = true;
  select.innerHTML = '<option value="">Loading types...</option>';

  bvTypeMap = new Map(BV_TYPE_FALLBACKS.map((t) => [t.key, t.label]));

  try {
    const { data, error } = await supabase.from('bv_request_types').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    const types = (!error && Array.isArray(data) && data.length > 0) ? data : BV_TYPE_FALLBACKS;

    select.innerHTML = '<option value="">Choose...</option>';
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = t.label;
      select.appendChild(opt);
    });

    bvTypeMap = new Map(types.map((t) => [t.key, t.label]));
    updateBVTypeOptions();
  } catch (e) {
    console.warn('Could not load BV types:', e.message);
    select.innerHTML = '<option value="">Choose...</option>' + BV_TYPE_FALLBACKS.map(t => `<option value="${t.key}">${t.label}</option>`).join('');
  } finally {
    if (!isAdminPreview) {
      select.disabled = false;
    }
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

  const memberSession = getMemberSession();
  const userId = currentUser?.id || memberSession?.id;
  if (!userId) {
    container.innerHTML = '<p class="empty-state error">Unable to determine member identity.</p>';
    return;
  }

  const filter = document.getElementById('bv-filter')?.value || 'all';
  try {
    const { data, error } = await supabase.rpc('get_bv_requests_for_user', { target_user_id: userId });
    if (error) throw error;
    bvAllData = Array.isArray(data) ? data : (data ? [data] : []);

    if (bvAllData.length === 0) {
      // Fallback: try direct query when supabase auth is present
      const { data: directData, error: directError } = await supabase
        .from('bv_requests')
        .select('*, clan_users(ign)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!directError && Array.isArray(directData) && directData.length > 0) {
        bvAllData = directData;
      }
    }

    requestedBVTypes = new Set(bvAllData.map((r) => r.reason));
    updateBVTypeOptions();

    if (filter !== 'all') {
      bvAllData = bvAllData.filter((r) => r.status === filter);
    }

    if (!bvAllData || bvAllData.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No BV requests found</div>
          <p>Submit a BV request above to see it listed here for review.</p>
        </div>
      `;
      updatePagination(0);
      return;
    }

    renderBVSummary(bvAllData);
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

  const rows = pageItems.map(r => {
    const rawReason = bvTypeMap.get(r.reason) || r.reason || 'Unknown';
    const reasonLabel = String(rawReason).replace(/-/g, ' ');
    const amount = Number(r.amount ?? r.request_amount ?? 0);
    const summaryText = amount > 0 ? `${amount} BV requested` : 'Review pending';
    const statusLabel = (r.status || 'pending').toUpperCase();

    return `
      <div class="bv-request-row">
        <div class="bv-request-cell bv-request-person">
          <div class="bv-request-member">${escapeHtml(currentUser?.ign || 'You')}</div>
          <div class="bv-request-created">${formatDateTime(r.created_at)}</div>
        </div>
        <div class="bv-request-cell bv-request-reason">${escapeHtml(reasonLabel)}</div>
        <div class="bv-request-cell bv-request-summary">
          <div class="bv-summary-card">
            <div class="bv-summary-title">BV SUMMARY</div>
            <div class="bv-summary-main">${escapeHtml(summaryText)}</div>
            <div class="bv-summary-meta">${escapeHtml(statusLabel)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="bv-request-grid">
      <div class="bv-request-header">
        <div>IGN</div>
        <div>Reason</div>
        <div>BV SUMMARY</div>
      </div>
      ${rows}
    </div>
  `;

  renderBVSummary(bvAllData);
  updatePagination(total);
}

function renderBVSummary(list) {
  const container = document.getElementById('bv-summary-container');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<p class="empty-state">No requests yet. Submit a BV request to create one.</p>';
    return;
  }

  const items = list.map(r => {
    const rawReason = bvTypeMap.get(r.reason) || r.reason || 'Unknown';
    const reasonLabel = String(rawReason).replace(/-/g, ' ');
    const amount = Number(r.amount ?? r.request_amount ?? 0);
    const summaryText = amount > 0 ? `${amount} BV requested` : 'Review pending';
    const statusLabel = (r.status || 'pending').toUpperCase();
    const isPending = statusLabel === 'PENDING';

    return `
      <div class="bv-summary-row">
        <div class="bv-summary-top">
          <div class="bv-summary-reason">${escapeHtml(reasonLabel)}</div>
          <div class="bv-summary-status">${escapeHtml(statusLabel)}</div>
        </div>
        <div class="bv-summary-meta">${escapeHtml(summaryText)}</div>
        <div class="bv-summary-actions">
          <button type="button" class="btn btn-small btn-success" ${isPending ? '' : 'disabled'} onclick="handleBVAction('${r.id}','approved')">DONE</button>
          <button type="button" class="btn btn-small btn-danger" ${isPending ? '' : 'disabled'} onclick="handleBVAction('${r.id}','denied')">CANCEL</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = items;
}

async function updateBVRequestStatus(requestId, newStatus) {
  const memberSession = getMemberSession();
  const userId = currentUser?.id || memberSession?.id;
  if (!userId || !requestId) {
    throw new Error('Unable to identify request owner.');
  }

  const { error } = await supabase.rpc('update_bv_request_status', {
    target_request_id: requestId,
    target_user_id: userId,
    target_status: newStatus
  });

  if (error) {
    throw error;
  }
}

async function handleBVAction(requestId, newStatus) {
  const statusEl = document.getElementById('bv-request-status');
  if (statusEl) {
    statusEl.textContent = `Setting request ${newStatus === 'approved' ? 'DONE' : 'CANCEL'}...`;
    statusEl.className = 'status-text';
  }

  try {
    await updateBVRequestStatus(requestId, newStatus);
    if (statusEl) {
      statusEl.textContent = 'Request updated.';
      statusEl.className = 'status-text success';
    }
    loadBVRequests();
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `Unable to update request: ${err.message}`;
      statusEl.className = 'status-text error';
    }
  }
}

function updateBVTypeOptions() {
  const select = document.getElementById('bv-select');
  if (!select) return;

  Array.from(select.options).forEach(option => {
    if (!option.value) return;
    option.disabled = requestedBVTypes.has(option.value);
    option.textContent = bvTypeMap.get(option.value) || option.textContent.replace(/-/g, ' ');
    if (option.disabled) {
      option.textContent = `${option.textContent} (requested)`;
    }
  });
}

function updatePagination(total=0) {
  const indicator = document.getElementById('bv-page-indicator');
  const prev = document.getElementById('bv-prev-page');
  const next = document.getElementById('bv-next-page');
  const hasResults = total > 0;

  if (indicator) indicator.style.display = hasResults ? '' : 'none';
  if (prev) prev.style.display = hasResults ? '' : 'none';
  if (next) next.style.display = hasResults ? '' : 'none';

  if (!hasResults) {
    return;
  }

  const pages = Math.max(1, Math.ceil((total || bvAllData.length) / bvPageSize));
  if (indicator) indicator.textContent = `Page ${bvCurrentPage} / ${pages}`;
  if (prev) prev.disabled = bvCurrentPage <= 1;
  if (next) next.disabled = bvCurrentPage >= pages;
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
    loadBVTypes();
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
