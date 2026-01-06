import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/contexts/CartContext';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchProducts = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching products:', fetchError);
          setError('Erreur lors du chargement des produits');
          return;
        }

        const formattedProducts: Product[] = (data || []).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          price_fcfa: p.price_fcfa,
          image_url: p.image_url,
          file_url: p.file_url,
          category: p.category || undefined,
          is_active: p.is_active ?? true,
        }));

        setProducts(formattedProducts);
      } catch (err) {
        console.error('Error:', err);
        setError('Erreur inattendue');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();

    // Realtime subscription for products
    const channel = supabase
      .channel('products-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('Products realtime update:', payload);

          if (payload.eventType === 'INSERT') {
            const newProduct = payload.new as any;
            if (newProduct.is_active) {
              setProducts(prev => [{
                id: newProduct.id,
                name: newProduct.name,
                description: newProduct.description || '',
                price_fcfa: newProduct.price_fcfa,
                image_url: newProduct.image_url,
                file_url: newProduct.file_url,
                category: newProduct.category || undefined,
                is_active: true,
              }, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedProduct = payload.new as any;
            setProducts(prev => {
              // If product is now inactive, remove it
              if (!updatedProduct.is_active) {
                return prev.filter(p => p.id !== updatedProduct.id);
              }
              
              // Check if product exists in list
              const exists = prev.some(p => p.id === updatedProduct.id);
              
              if (exists) {
                // Update existing product
                return prev.map(p => 
                  p.id === updatedProduct.id 
                    ? {
                        id: updatedProduct.id,
                        name: updatedProduct.name,
                        description: updatedProduct.description || '',
                        price_fcfa: updatedProduct.price_fcfa,
                        image_url: updatedProduct.image_url,
                        file_url: updatedProduct.file_url,
                        category: updatedProduct.category || undefined,
                        is_active: updatedProduct.is_active ?? true,
                      }
                    : p
                );
              } else {
                // Product became active, add it
                return [{
                  id: updatedProduct.id,
                  name: updatedProduct.name,
                  description: updatedProduct.description || '',
                  price_fcfa: updatedProduct.price_fcfa,
                  image_url: updatedProduct.image_url,
                  file_url: updatedProduct.file_url,
                  category: updatedProduct.category || undefined,
                  is_active: true,
                }, ...prev];
              }
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedProduct = payload.old as any;
            setProducts(prev => prev.filter(p => p.id !== deletedProduct.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Products realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { products, loading, error };
}
