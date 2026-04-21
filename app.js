// Estado Global
let orders = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    checkConfig();
    
    const path = window.location.pathname;
    if (path.includes('totem.html')) initTotem();
    else if (path.includes('cozinha.html')) initCozinha();
    else if (path.includes('monitor.html')) initMonitor();
    else initLanding(); // index.html ou raiz

    setupRealtime();
});

function checkConfig() {
    const url = localStorage.getItem('CF_URL');
    if (!url && !window.location.pathname.includes('index.html')) {
        console.warn('CookFlow: Supabase não configurado. Vá para a página inicial para configurar.');
    }
}

// --- Lógica da Landing/Config ---
function initLanding() {
    const configBtn = document.getElementById('open-config');
    const configModal = document.getElementById('config-modal');
    const configForm = document.getElementById('config-form');

    if (configBtn) {
        configBtn.onclick = () => configModal.style.display = 'flex';
    }

    if (configForm) {
        configForm.onsubmit = (e) => {
            e.preventDefault();
            const url = document.getElementById('supa-url').value;
            const key = document.getElementById('supa-key').value;
            saveConfig(url, key);
        };
    }
}

// --- Lógica do Totem ---
function initTotem() {
    const orderForm = document.getElementById('order-form');
    if (!orderForm) return;

    orderForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = orderForm.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        const tableName = document.getElementById('table-number').value;
        const rawItems = document.getElementById('order-items').value;

        const items = rawItems.split('\n').filter(l => l.trim()).map(line => {
            const match = line.match(/^(\d+)[xX]\s*(.*)$/);
            return match ? { quantity: parseInt(match[1]), name: match[2].trim() } : { quantity: 1, name: line.trim() };
        });

        try {
            await createOrder(tableName, items);
            showToast();
            orderForm.reset();
        } catch (err) {
            alert('Erro ao enviar pedido. Verifique sua configuração do Supabase.');
        } finally {
            btn.disabled = false;
            btn.textContent = '🔥 Confirmar Pedido';
        }
    };
}

function showToast() {
    const toast = document.getElementById('success-message');
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
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
            cols[order.status].appendChild(createOrderCard(order));
        }
    });

    ['pending', 'preparing', 'ready'].forEach(s => {
        const el = document.querySelector(`#${s} .count`);
        if (el) el.textContent = orders.filter(o => o.status === s).length;
    });
}

function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'order-card fade-in';
    
    const flow = {
        'pending': { label: '👨‍🍳 Preparar', next: 'preparing' },
        'preparing': { label: '✅ Pronto', next: 'ready' },
        'ready': { label: '📦 Entregue', next: 'delivered' }
    };

    const current = flow[order.status];
    const itemsHtml = order.order_items.map(i => `<li>${i.quantity}x ${i.name}</li>`).join('');

    div.innerHTML = `
        <div class="card-header">
            <span>#${order.number} - ${order.table_name}</span>
            <span class="time">${new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <ul class="card-items-list">${itemsHtml}</ul>
        <div class="card-footer">
            ${current ? `<button class="btn-action" onclick="changeStatus('${order.id}', '${current.next}')">${current.label}</button>` : ''}
        </div>
    `;
    return div;
}

// --- Lógica do Monitor ---
function initMonitor() {
    loadOrders(renderMonitor);
}

function renderMonitor() {
    const prepList = document.getElementById('preparing-list');
    const readyList = document.getElementById('ready-list');
    if (!prepList || !readyList) return;

    prepList.innerHTML = '';
    readyList.innerHTML = '';

    orders.forEach(order => {
        if (order.status === 'preparing' || order.status === 'pending') {
            prepList.appendChild(createMonitorItem(order.number));
        } else if (order.status === 'ready') {
            readyList.appendChild(createMonitorItem(order.number, true));
        }
    });
}

function createMonitorItem(number, isReady = false) {
    const div = document.createElement('div');
    div.className = `monitor-item ${isReady ? 'ready-anim' : ''}`;
    div.textContent = number;
    return div;
}

// --- Tempo Real e Sincronia ---
async function loadOrders(callback) {
    orders = await getOrders();
    if (callback) callback();
}

function setupRealtime() {
    if (!supabaseClient) return;

    supabaseClient
        .channel('global')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
            const oldOrdersCount = orders.length;
            orders = await getOrders();
            
            // Alerta sonoro se for novo pedido e estiver na cozinha
            if (payload.eventType === 'INSERT' && window.location.pathname.includes('cozinha.html')) {
                playAlertSound();
            }

            if (window.location.pathname.includes('cozinha.html')) renderCozinha();
            if (window.location.pathname.includes('monitor.html')) renderMonitor();
        })
        .subscribe();
}

function playAlertSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
        console.log('Audio alert blocked by browser policy');
    }
}

async function changeStatus(id, status) {
    try {
        if (status === 'delivered') await deleteOrder(id);
        else await updateOrderStatus(id, status);
    } catch (err) {
        console.error(err);
    }
}

window.changeStatus = changeStatus;
