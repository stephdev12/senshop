import { ShoppingBag, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { useCart, Currency } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const currencies: Currency[] = ['FCFA', 'EUR', 'USD'];

export function CartDropdown() {
  const {
    items,
    isOpen,
    setIsOpen,
    totalItems,
    totalPrice,
    formatPrice,
    currency,
    setCurrency,
    updateQuantity,
    removeItem,
  } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    setIsOpen(false);
    navigate('/checkout');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        <ShoppingBag className="w-5 h-5" />
        <span>Panier: {totalItems}</span>
        <span className="text-muted-foreground">•</span>
        <span>{formatPrice(totalPrice)}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-lg shadow-lg z-50 animate-scale-in origin-top-right">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Votre Panier</h3>
                <div className="flex items-center gap-1 bg-secondary rounded-md p-1">
                  {currencies.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        currency === c
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Votre panier est vide
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className="p-4 flex gap-3">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-foreground truncate">
                          {item.name}
                        </h4>
                        <p className="text-sm text-primary font-medium mt-1">
                          {formatPrice(item.price_fcfa)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1 rounded hover:bg-secondary transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-1 rounded hover:bg-secondary transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 rounded hover:bg-secondary transition-colors self-start"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="font-semibold text-lg text-primary">
                    {formatPrice(totalPrice)}
                  </span>
                </div>
                <Button
                  onClick={handleCheckout}
                  className="w-full"
                  size="lg"
                >
                  Procéder au paiement
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
