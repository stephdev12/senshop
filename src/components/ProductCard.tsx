import { ShoppingCart, Check, Ban } from 'lucide-react';
import { Product, useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { addItem, formatPrice, items } = useCart();
  const [added, setAdded] = useState(false);

  // Check if item is already in cart
  const inCart = items.some(item => item.id === product.id);
  
  // Disable adding if product forbids multiples and is already in cart
  // Default allow_multiple to true if undefined
  const canAdd = product.allow_multiple !== false ? true : !inCart;

  const handleAddToCart = () => {
    if (!canAdd) return;
    
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      className={`group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg opacity-0 animate-slide-up`}
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
    >
      <div className="aspect-square overflow-hidden bg-secondary">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
          {product.category && (
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              {product.category}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-lg font-bold text-primary">
            {formatPrice(product.price_fcfa)}
          </span>
          <Button
            size="sm"
            onClick={handleAddToCart}
            disabled={added || !canAdd}
            className={`gap-2 ${!canAdd ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {added ? (
              <>
                <Check className="w-4 h-4" />
                Ajouté
              </>
            ) : !canAdd ? (
              <>
                <Ban className="w-4 h-4" />
                Déjà au panier
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Ajouter
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
