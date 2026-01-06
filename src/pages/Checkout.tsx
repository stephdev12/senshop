import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, totalPrice, formatPrice, clearCart, currency } = useCart();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check if payment was cancelled
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      toast.error('Paiement annulé');
    }
  }, [searchParams]);

  if (items.length === 0) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <ShoppingBag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Votre panier est vide</h1>
          <p className="text-muted-foreground mb-6">
            Ajoutez des produits pour procéder au paiement
          </p>
          <Button onClick={() => navigate('/')}>
            Retour à la boutique
          </Button>
        </div>
      </Layout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Prepare items for order
      const orderItems = items.map(item => ({
        id: item.id,
        name: item.name,
        price_fcfa: item.price_fcfa,
        quantity: item.quantity,
        image_url: item.image_url,
        file_url: item.file_url
      }));

      // Call the create-payment edge function or local API
      // const { data, error } = await supabase.functions.invoke('create-payment', {
      //   body: {
      //     customer_name: formData.name,
      //     customer_phone: formData.phone,
      //     customer_email: formData.email || null,
      //     items: orderItems,
      //     total_amount: totalPrice,
      //     currency: currency
      //   }
      // });

      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_name: formData.name,
          customer_phone: formData.phone,
          customer_email: formData.email || null,
          items: orderItems,
          total_amount: totalPrice,
          currency: currency
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Payment error:', data);
        toast.error(data.error || 'Erreur lors de la création du paiement');
        setIsLoading(false);
        return;
      }

      if (data?.success) {
        toast.success('Commande créée! Redirection vers le paiement...');
        clearCart();
        
        // Redirect to MoneyFusion payment page if URL is provided
        if (data.payment_url) {
          window.location.href = data.payment_url;
        } else {
          // Fallback to confirmation page
          navigate(`/confirmation?token=${data.payment_token}`);
        }
      } else {
        toast.error(data?.error || 'Erreur lors du paiement');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Erreur lors du paiement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout showGrid={false}>
      <div className="container py-8 md:py-12 max-w-3xl">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la boutique
        </button>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Order Summary */}
          <div className="order-2 md:order-1">
            <h2 className="text-lg font-semibold mb-4">Récapitulatif</h2>
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-4">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">Qté: {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">
                    {formatPrice(item.price_fcfa * item.quantity)}
                  </span>
                </div>
              ))}
              <div className="p-4 flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="order-1 md:order-2">
            <h2 className="text-lg font-semibold mb-4">Vos informations</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Nom complet *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Jean Dupont"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Numéro de téléphone *
                </label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+221 77 123 45 67"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="jean@exemple.com"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full mt-6"
                disabled={isLoading}
              >
                {isLoading ? 'Traitement...' : 'Payer maintenant'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Checkout;
