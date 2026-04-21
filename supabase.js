// Configuração do Supabase
// Prioriza localStorage para facilitar o setup sem mexer no código
const SUPABASE_URL = localStorage.getItem('CF_URL') || 'SUA_SUPABASE_URL_AQUI';
const SUPABASE_ANON_KEY = localStorage.getItem('CF_KEY') || 'SUA_SUPABASE_ANON_KEY_AQUI';

let supabaseClient = null;

if (SUPABASE_URL !== 'SUA_SUPABASE_URL_AQUI') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Buscar todos os pedidos com seus itens
async function getOrders() {
    if (!supabaseClient) return [];
    const { data, error } = await supabaseClient
        .from('orders')
        .select('*, order_items (*)')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Erro ao buscar pedidos:', error);
        return [];
    }
    return data;
}

// Criar um pedido
async function createOrder(table_name, items) {
    if (!supabaseClient) throw new Error('Supabase não configurado');
    
    const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .insert([{ table_name: table_name }])
        .select()
        .single();

    if (orderError) throw orderError;

    const itemsToInsert = items.map(item => ({
        order_id: orderData.id,
        name: item.name,
        quantity: item.quantity
    }));

    const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    return orderData;
}

async function updateOrderStatus(orderId, newStatus) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

    if (error) throw error;
}

async function deleteOrder(orderId) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
        .from('orders')
        .delete()
        .eq('id', orderId);

    if (error) throw error;
}

// Função para salvar chaves e reiniciar
function saveConfig(url, key) {
    localStorage.setItem('CF_URL', url);
    localStorage.setItem('CF_KEY', key);
    window.location.reload();
}
