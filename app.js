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
    else if (path.includes('login.html')) {} // Ignora login
    else initLanding();

    setupRealtime();
});

// Proteção de Rotas (RBAC)
async function checkAccess() {
    const path = window.location.pathname;
    if (path.includes('login.html') || path.includes('index.html') || path.includes('monitor.html')) return;

    currentUser = await getProfile();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Regras de Acesso
    if (path.includes('admin.html') && currentUser.role !== 'admin') {
        alert('Acesso restrito para administradores.');
        window.location.href = 'index.html';
    }
    if (path.includes('caixa.html') && !['admin', 'caixa'].includes(currentUser.role)) {
        alert('Acesso restrito para o Caixa.');
        window.location.href = 'index.html';
    }
    if (path.includes('cozinha.html') && !['admin', 'cozinha'].includes(currentUser.role)) {
        alert('Acesso restrito para a Cozinha.');
        window.location.href = 'index.html';
    }
}

// --- Lógica do Caixa ---
function initCaixa() {
    loadOrders(renderCaixa);
}

function renderCaixa() {
    const list = document.getElementById('caixa-orders-list');
    if (!list) return;

    list.innerHTML = '';
    orders.forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-card';
        const items = order.order_items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('');
        
        div.innerHTML = `
            <div class="card-header">
                <span>#${order.number} - ${order.table_name}</span>
                <span class="status-badge ${order.status}">${order.status}</span>
            </div>
            <ul class="card-items-list">${items}</ul>
            <div class="card-footer">
                <strong>Total: R$ ${order.total.toFixed(2)}</strong>
                <button class="btn-action" onclick="changeStatus('${order.id}', 'delivered')">💰 Fechar Conta</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- Lógica do Totem (Simplificada) ---
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

// --- Lógica da Cozinha ---
function initCozinha() {
    loadOrders(renderCozinha);
}

function renderCozinha() {
    const cols = {
        pending: document.querySelector('#pending .order-list'),
        preparing: document.querySelector('#preparing .order-list'),
        ready: document.querySelector('#ready .order-list')
    };
    if (!cols.pending) return;
    Object.values(cols).forEach(c => c.innerHTML = '');

    orders.forEach(order => {
        if (cols[order.status]) {
            const card = createOrderCard(order);
            cols[order.status].appendChild(card);
        }
    });
}

function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'order-card fade-in';
    const flow = { 'pending': { label: '👨‍🍳 Preparar', next: 'preparing' }, 'preparing': { label: '✅ Pronto', next: 'ready' }, 'ready': { label: '💰 Finalizar', next: 'delivered' } };
    const current = flow[order.status];
    const items = order.order_items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('');

    div.innerHTML = `
        <div class="card-header"><span>#${order.number} - ${order.table_name}</span></div>
        <ul class="card-items-list">${items}</ul>
        <div class="card-footer">
            ${current ? `<button class="btn-action" onclick="changeStatus('${order.id}', '${current.next}')">${current.label}</button>` : ''}
        </div>
    `;
    return div;
}

// --- Sincronia Realtime ---
async function loadOrders(callback) {
    orders = await getOrders();
    if (callback) callback();
}

function setupRealtime() {
    if (!supabaseClient) return;
    supabaseClient.channel('global').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
        orders = await getOrders();
        updateAllViews();
    }).subscribe();
}

function updateAllViews() {
    if (window.location.pathname.includes('cozinha.html')) renderCozinha();
    if (window.location.pathname.includes('caixa.html')) renderCaixa();
    if (window.location.pathname.includes('monitor.html')) renderMonitor();
}

async function changeStatus(id, status) {
    await updateOrderStatus(id, status);
}

function showToast() {
    const t = document.getElementById('success-message');
    if (t) { t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 3000); }
}

window.changeStatus = changeStatus;
window.signOut = signOut;
