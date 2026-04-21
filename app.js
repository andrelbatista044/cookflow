// Estado Global
let orders = [];
let currentUser = null;

// Inicialização Global
document.addEventListener('DOMContentLoaded', async () => {
    await checkAccess();
    
    const path = window.location.pathname;
    if (path.includes('totem.html')) initTotem();
    else if (path.includes('cozinha.html')) initCozinha();
    else if (path.includes('monitor.html')) initMonitor();
    else if (path.includes('caixa.html')) initCaixa();
    else if (path.includes('admin.html')) initAdmin();
    
    setupRealtime();
});

// Proteção de Rotas Simplificada
async function checkAccess() {
    const path = window.location.pathname;
    // Páginas que não precisam de login (só o login em si)
    if (path.includes('login.html')) return;

    // Monitor é liberado para todos logados
    currentUser = await getProfile();
    
    if (!currentUser && !path.includes('login.html')) {
        window.location.href = 'login.html';
        return;
    }

    const role = (currentUser.role || 'funcionario').toLowerCase();

    // Bloqueio do Admin Center para quem não é admin
    if (path.includes('admin') && role !== 'admin') {
        alert('Acesso negado. Esta área é restrita para Administradores.');
        window.location.href = 'index.html';
    }
}

// --- Funções de Interface ---
function initTotem() {
    const form = document.getElementById('order-form');
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const tableName = document.getElementById('table-number').value;
        const total = parseFloat(document.getElementById('order-total').value || 0);
        const rawItems = document.getElementById('order-items').value;
        const items = rawItems.split('\n').filter(l => l.trim()).map(line => ({ quantity: 1, name: line.trim() }));
        await createOrder(tableName, items, total);
        showToast();
        form.reset();
    };
}

function initCozinha() { loadOrders(renderCozinha); }
function initCaixa() { loadOrders(renderCaixa); }
function initMonitor() { loadOrders(renderMonitor); }

// --- Renderizadores ---
function renderCozinha() {
    const cols = { pending: document.querySelector('#pending .order-list'), preparing: document.querySelector('#preparing .order-list'), ready: document.querySelector('#ready .order-list') };
    if (!cols.pending) return;
    Object.values(cols).forEach(c => c.innerHTML = '');
    orders.forEach(order => {
        if (cols[order.status]) cols[order.status].appendChild(createOrderCard(order, true));
    });
}

function renderCaixa() {
    const list = document.getElementById('caixa-orders-list');
    if (!list) return;
    list.innerHTML = '';
    orders.forEach(order => {
        if (order.status !== 'delivered') {
            const card = createOrderCard(order, false);
            list.appendChild(card);
        }
    });
}

function createOrderCard(order, isKitchen = true) {
    const div = document.createElement('div');
    div.className = 'order-card';
    const items = order.order_items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('');
    
    const flow = { 'pending': 'preparing', 'preparing': 'ready', 'ready': 'delivered' };
    const labels = { 'pending': '👨‍🍳 Preparar', 'preparing': '✅ Pronto', 'ready': '💰 Finalizar' };
    
    div.innerHTML = `
        <div class="card-header">
            <span>#${order.number} - ${order.table_name}</span>
            <span class="status-badge ${order.status}">${order.status}</span>
        </div>
        <ul class="card-items-list">${items}</ul>
        <div class="card-footer">
            ${isKitchen ? `<strong>R$ ${order.total.toFixed(2)}</strong>` : ''}
            <button class="btn-action" onclick="changeStatus('${order.id}', '${flow[order.status]}')">${labels[order.status]}</button>
        </div>
    `;
    return div;
}

function renderMonitor() {
    const p = document.getElementById('preparing-list'), r = document.getElementById('ready-list');
    if (!p || !r) return;
    p.innerHTML = ''; r.innerHTML = '';
    orders.forEach(o => {
        const div = document.createElement('div'); div.className = 'monitor-item'; div.textContent = o.number;
        if (o.status === 'ready') r.appendChild(div);
        else if (o.status !== 'delivered') p.appendChild(div);
    });
}

// --- Global ---
async function loadOrders(callback) { orders = await getOrders(); if (callback) callback(); }
function setupRealtime() {
    if (!supabaseClient) return;
    supabaseClient.channel('global').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        orders = await getOrders();
        updateAllViews();
    }).subscribe();
}
function updateAllViews() {
    if (window.location.pathname.includes('cozinha')) renderCozinha();
    if (window.location.pathname.includes('caixa')) renderCaixa();
    if (window.location.pathname.includes('monitor')) renderMonitor();
}
async function changeStatus(id, status) { await updateOrderStatus(id, status); }
function showToast() { const t = document.getElementById('success-message'); if (t) { t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 3000); } }

window.changeStatus = changeStatus;
window.signOut = signOut;
