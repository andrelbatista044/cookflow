-- 1. Tabela de PEDIDOS
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number SERIAL, 
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered')),
    table_name TEXT,
    total NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de ITENS DO PEDIDO
CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1
);

-- 3. Tabela de PERFIS (RBAC)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'caixa' CHECK (role IN ('admin', 'caixa', 'cozinha'))
);

-- 4. Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders, order_items, profiles;

-- 5. Habilitar RLS e Políticas
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total orders" ON orders FOR ALL USING (true);
CREATE POLICY "Acesso total order_items" ON order_items FOR ALL USING (true);
CREATE POLICY "Perfis visíveis por auth" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins editam perfis" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 6. Trigger para Perfil Automático
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'caixa');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
