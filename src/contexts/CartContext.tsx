import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Product {
  id: string;
  name: string;
  description: string;
  price_fcfa: number;
  image_url: string;
  file_url: string;
  category?: string;
  is_active: boolean;
  allow_multiple?: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export type Currency = 'FCFA' | 'EUR' | 'USD';

interface CartContextType {
  items: CartItem[];
  currency: Currency;
  isOpen: boolean;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setCurrency: (currency: Currency) => void;
  setIsOpen: (open: boolean) => void;
  totalItems: number;
  totalPrice: number;
  convertPrice: (priceFcfa: number) => number;
  formatPrice: (price: number) => string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Exchange rates (approximate)
const EXCHANGE_RATES: Record<Currency, number> = {
  FCFA: 1,
  EUR: 0.0015,
  USD: 0.0016,
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  FCFA: 'FCFA',
  EUR: '€',
  USD: '$',
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [currency, setCurrency] = useState<Currency>('FCFA');
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      
      // If item exists and allow_multiple is false (or undefined, defaulting to true if we wanted, but let's be strict if explicitly false)
      // Actually, if allow_multiple is explicitly false, we block.
      // If it's undefined, we assume true (backward compatibility).
      if (existing) {
        if (product.allow_multiple === false) {
          // Cannot add more
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsOpen(true); // Open cart when adding item
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price_fcfa * item.quantity,
    0
  );

  const convertPrice = useCallback(
    (priceFcfa: number) => {
      return Math.round(priceFcfa * EXCHANGE_RATES[currency] * 100) / 100;
    },
    [currency]
  );

  const formatPrice = useCallback(
    (priceFcfa: number) => {
      const converted = convertPrice(priceFcfa);
      if (currency === 'FCFA') {
        return `${converted.toLocaleString('fr-FR')} ${CURRENCY_SYMBOLS[currency]}`;
      }
      return `${CURRENCY_SYMBOLS[currency]}${converted.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
    },
    [currency, convertPrice]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        currency,
        isOpen,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        setCurrency,
        setIsOpen,
        totalItems,
        totalPrice,
        convertPrice,
        formatPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
