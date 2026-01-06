-- Add allow_multiple column to products table
ALTER TABLE public.products 
ADD COLUMN allow_multiple BOOLEAN DEFAULT true;

-- Update existing products to have allow_multiple = true
UPDATE public.products SET allow_multiple = true;
