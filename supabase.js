// Configuração do Supabase
const SUPABASE_URL = 'https://vmjipefjlgurqsymistj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtamlwZWZqbGd1cnFzeW1pc3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Nzc3NDEsImV4cCI6MjA5MjM1Mzc0MX0.-KiHvPvgRRM65hIx5IWigMXiPZXT7sXqQzkR8I3cxjQ';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- AUTH & PROFILE ---
async function signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    return { data, error };
}

async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

async function getProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    // Tentamos buscar o perfil na tabela
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();
    
    // Se não encontrar o perfil, assume como 'funcionario' (segurança mínima)
    const role = profile ? profile.role : 'funcionario';
    const full_name = profile ? profile.full_name : user.email;
    
    return { ...user, role, full_name };
}

// --- ADMIN FUNCTIONS ---
async function getAllProfiles() {
    const { data } = await supabaseClient.from('profiles').select('*');
    return data || [];
}

async function updateProfileRole(id, role) {
    await supabaseClient.from('profiles').update({ role }).eq('id', id);
}

// --- ORDERS ---
async function getOrders() {
    const { data } = await supabaseClient.from('orders').select('*, order_items (*)').order('created_at', { ascending: false });
    return data || [];
}

async function createOrder(table_name, items, total = 0) {
    const { data: orderData, error: orderError } = await supabaseClient
        .from('orders')
        .insert([{ table_name, total, status: 'pending' }])
        .select().single();

    if (orderError) throw orderError;

    const itemsToInsert = items.map(item => ({
        order_id: orderData.id,
        name: item.name,
        quantity: item.quantity
    }));

    await supabaseClient.from('order_items').insert(itemsToInsert);
    return orderData;
}

async function updateOrderStatus(id, status) {
    await supabaseClient.from('orders').update({ status }).eq('id', id);
}

async function deleteOrder(id) {
    await supabaseClient.from('orders').delete().eq('id', id);
}

// --- STATS ---
async function getDashboardStats() {
    const today = new Date(); today.setHours(0,0,0,0);
    const { count: totalToday } = await supabaseClient.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
    const { data: revenueData } = await supabaseClient.from('orders').select('total');
    const revenue = revenueData ? revenueData.reduce((acc, curr) => acc + (curr.total || 0), 0) : 0;
    return { totalToday, revenue };
}
