-- 1. Criar a tabela de PEDIDOS
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number SERIAL, -- Número incremental automático (Ex: 1, 2, 3...)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered')),
    table_name TEXT, -- Nome da mesa ou cliente
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar a tabela de ITENS DO PEDIDO
CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1
);

-- 3. Habilitar Realtime para ambas as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas simples de acesso (Permitir tudo para fins de teste)
CREATE POLICY "Permitir tudo orders" ON orders FOR ALL USING (true);
CREATE POLICY "Permitir tudo order_items" ON order_items FOR ALL USING (true);

-- 6. Função opcional para zerar o contador diariamente (se necessário no futuro)
-- ALTER SEQUENCE orders_number_seq RESTART WITH 1;
