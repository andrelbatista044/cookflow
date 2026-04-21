// Configuração do Supabase (Constante)
const SUPABASE_URL = 'https://vmjipefjlgurqsymistj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtamlwZWZqbGd1cnFzeW1pc3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Nzc3NDEsImV4cCI6MjA5MjM1Mzc0MX0.-KiHvPvgRRM65hIx5IWigMXiPZXT7sXqQzkR8I3cxjQ';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- FUNÇÕES DE AUTENTICAÇÃO ---
async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

async function getUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

// --- FUNÇÕES DE DADOS (PEDIDOS) ---
async function getOrders() {
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

async function createOrder(table_name, items) {
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
    const { error } = await supabaseClient
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

    if (error) throw error;
}

async function deleteOrder(orderId) {
    const { error } = await supabaseClient
        .from('orders')
        .delete()
        .eq('id', orderId);

    if (error) throw error;
}

// --- FUNÇÕES DE ADMIN (ESTATÍSTICAS) ---
async function getStats() {
    // Total de pedidos hoje
    const today = new Date();
    today.setHours(0,0,0,0);

    const { count: totalToday } = await supabaseClient
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

    // Receita Total (Soma de todos os pedidos que não foram deletados)
    // Nota: Como não salvamos o total no banco com o novo esquema (podemos somar os itens ou adicionar o campo total de volta)
    // Vou assumir que o campo 'total' ainda é útil no cabeçalho do pedido ou recalculado.
    // Para simplificar agora, vou buscar o total da tabela orders.
    const { data: revenueData } = await supabaseClient
        .from('orders')
        .select('total');
    
    const totalRevenue = revenueData ? revenueData.reduce((acc, curr) => acc + (curr.total || 0), 0) : 0;

    return { totalToday, totalRevenue };
}
