// ---- Configuración de Supabase (clave pública/publishable: segura en el navegador) ----
const SUPABASE_URL = 'https://kuxfwjhvgbmugxsrtmst.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ecv3dxoyvVBY-bFzbC1h8g_H5_ZpAki';

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

let opportunities = []; // copia de lo que hay en Supabase

const $ = (id) => document.getElementById(id);
const grid = $('grid');
const statusEl = $('status');

// ---- API de Supabase (REST) ----
async function fetchOpportunities() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/opportunities?select=*&order=created_at.desc`, { headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function insertOpportunity(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/opportunities`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ ...data, likes: 0 }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// Incremento atómico en la base de datos (función like_opportunity)
async function likeOpportunity(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/like_opportunity`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ opportunity_id: id }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ---- Carga y render ----
async function loadOpportunities() {
  statusEl.textContent = 'Cargando desde Supabase…';
  try {
    opportunities = await fetchOpportunities();
    statusEl.textContent = '';
    refreshFilterOptions();
    render();
  } catch (err) {
    console.error(err);
    statusEl.textContent = '⚠️ No se pudo cargar desde Supabase. Intenta de nuevo.';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uniqueSorted(key) {
  return [...new Set(opportunities.map((o) => o[key]))].sort((a, b) => a.localeCompare(b, 'es'));
}

function refreshFilterOptions() {
  const fill = (id, key, label) => {
    const sel = $(id);
    const current = sel.value;
    sel.innerHTML = `<option value="">${label}</option>` +
      uniqueSorted(key).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    sel.value = [...sel.options].some((o) => o.value === current) ? current : '';
  };
  fill('flt-country', 'country', '🌎 Todos los países');
  fill('flt-city', 'city', '🏙️ Todas las ciudades');
  fill('flt-category', 'category', '🏷️ Todas las categorías');
}

function render() {
  // Estadísticas globales
  $('stat-total').textContent = opportunities.length;
  $('stat-cities').textContent = new Set(opportunities.map((o) => o.city.toLowerCase())).size;
  $('stat-likes').textContent = opportunities.reduce((s, o) => s + o.likes, 0);

  const country = $('flt-country').value;
  const city = $('flt-city').value;
  const category = $('flt-category').value;

  const list = opportunities
    .filter((o) => (!country || o.country === country) && (!city || o.city === city) && (!category || o.category === category))
    .sort($('flt-sort').value === 'likes' ? (a, b) => b.likes - a.likes : () => 0);

  if (!list.length) {
    grid.innerHTML = '';
    statusEl.textContent = opportunities.length
      ? 'Ninguna oportunidad coincide con los filtros.'
      : 'Aún no hay oportunidades. ¡Publica la primera!';
    return;
  }
  statusEl.textContent = '';

  grid.innerHTML = list.map((o) => `
    <article class="card opp">
      <div>
        <h3>${escapeHtml(o.name)}</h3>
        <div class="place">📍 ${escapeHtml(o.city)}, ${escapeHtml(o.country)}</div>
      </div>
      <div class="tags">
        <span class="tag">${escapeHtml(o.category)}</span>
        <span class="tag ${escapeHtml(o.potential)}">Potencial ${escapeHtml(o.potential)}</span>
      </div>
      <div class="block"><small>Problema</small><p>${escapeHtml(o.problem)}</p></div>
      <div class="block ai"><small>Solución con IA</small><p>${escapeHtml(o.ai_solution)}</p></div>
      <div class="foot">
        <span class="date">${new Date(o.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <button class="like-btn" data-id="${o.id}" aria-label="Dar like a ${escapeHtml(o.name)}">❤️ ${o.likes}</button>
      </div>
    </article>`).join('');
}

// ---- Eventos ----
$('opportunity-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = $('submit-btn');
  const msg = $('form-msg');
  const fd = Object.fromEntries(new FormData(form));
  Object.keys(fd).forEach((k) => (fd[k] = fd[k].trim()));

  btn.disabled = true;
  msg.className = 'msg';
  msg.textContent = 'Publicando…';
  try {
    await insertOpportunity(fd);
    form.reset();
    $('f-potential').value = 'Medio';
    msg.className = 'msg ok';
    msg.textContent = '✅ ¡Publicada! Ya la puede ver todo el mundo.';
    await loadOpportunities(); // recarga la lista desde Supabase
  } catch (err) {
    console.error(err);
    msg.className = 'msg err';
    msg.textContent = '❌ No se pudo publicar. Revisa los datos e intenta de nuevo.';
  } finally {
    btn.disabled = false;
  }
});

grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('.like-btn');
  if (!btn) return;
  btn.disabled = true;
  try {
    await likeOpportunity(Number(btn.dataset.id));
    await loadOpportunities(); // recarga la lista desde Supabase
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    statusEl.textContent = '⚠️ No se pudo registrar el like.';
  }
});

['flt-country', 'flt-city', 'flt-category', 'flt-sort'].forEach((id) => $(id).addEventListener('change', render));
$('refresh-btn').addEventListener('click', loadOpportunities);

loadOpportunities();
