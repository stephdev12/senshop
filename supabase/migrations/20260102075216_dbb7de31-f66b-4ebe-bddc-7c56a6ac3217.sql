-- Allow admin to manage products (using service role or bypassing RLS for admin functions)
-- Since we don't have authenticated admin users, we'll allow full CRUD via service role
-- For now, enable full access policies that can be secured later with proper admin auth

-- Create policy for inserting products (admin only - will use service role)
CREATE POLICY "Allow insert for admin" 
ON public.products 
FOR INSERT 
WITH CHECK (true);

-- Create policy for updating products (admin only - will use service role)
CREATE POLICY "Allow update for admin" 
ON public.products 
FOR UPDATE 
USING (true);

-- Create policy for deleting products (admin only - will use service role)
CREATE POLICY "Allow delete for admin" 
ON public.products 
FOR DELETE 
USING (true);

-- Allow SELECT on all products for admin (not just active ones)
CREATE POLICY "Admin can view all products" 
ON public.products 
FOR SELECT 
USING (true);