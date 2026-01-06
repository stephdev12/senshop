import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/contexts/CartContext';
import { toast } from 'sonner';

export function useAdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all products (including inactive)
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        toast.error('Erreur lors du chargement des produits');
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    };

    fetchProducts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('admin-products-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => [payload.new as Product, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Product) : p))
            );
          } else if (payload.eventType === 'DELETE') {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createProduct = async (productData: Omit<Product, 'id'>) => {
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      toast.error('Erreur lors de la création du produit');
      return null;
    }

    toast.success('Produit ajouté avec succès');
    return data;
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      toast.error('Erreur lors de la modification du produit');
      return null;
    }

    toast.success('Produit modifié avec succès');
    return data;
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      toast.error('Erreur lors de la suppression du produit');
      return false;
    }

    toast.success('Produit supprimé');
    return true;
  };

  return {
    products,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
