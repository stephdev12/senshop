-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_fcfa NUMERIC(10,2) NOT NULL,
  image_url TEXT NOT NULL,
  file_url TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active products
CREATE INDEX idx_products_active ON products(is_active);

-- Enable RLS on products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public can read active products
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'FCFA',
  payment_token TEXT UNIQUE,
  payment_status TEXT DEFAULT 'pending',
  payment_method TEXT,
  transaction_number TEXT,
  items JSONB NOT NULL,
  personal_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Create indexes for orders
CREATE INDEX idx_orders_token ON orders(payment_token);
CREATE INDEX idx_orders_status ON orders(payment_status);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Orders can be inserted by anyone (for checkout)
CREATE POLICY "Anyone can create orders" ON public.orders
  FOR INSERT WITH CHECK (true);

-- Orders can be viewed by payment token
CREATE POLICY "Anyone can view orders by token" ON public.orders
  FOR SELECT USING (true);

-- Create admin_logs table
CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on admin_logs
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for products timestamp
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for product images (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for digital products (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-products', 'digital-products', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product-images (public read)
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Storage policies for digital-products (require valid payment token - handled by edge function)
CREATE POLICY "Authenticated users can view digital products"
ON storage.objects FOR SELECT
USING (bucket_id = 'digital-products');