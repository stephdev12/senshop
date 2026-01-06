import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, ArrowRight, Loader2, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  name: string;
  file_url: string;
}

interface Order {
  id: string;
  order_number: string;
  payment_status: string;
  items: OrderItem[];
}

const Confirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!token) {
      setError('Token de paiement manquant');
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, order_number, payment_status, items')
        .eq('payment_token', token)
        .single();

      if (fetchError || !data) {
        setError('Commande non trouvée');
        setLoading(false);
        return;
      }

      setOrder({
        id: data.id,
        order_number: data.order_number,
        payment_status: data.payment_status || 'pending',
        items: (data.items as unknown as OrderItem[]) || []
      });
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Erreur lors du chargement de la commande');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Realtime subscription for order updates
  useEffect(() => {
    if (!token || !order?.id) return;

    console.log('Setting up realtime subscription for order:', order.id);

    const channel = supabase
      .channel(`order-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          const newData = payload.new as { payment_status: string; items: OrderItem[] };
          
          setOrder(prev => prev ? {
            ...prev,
            payment_status: newData.payment_status || prev.payment_status,
            items: (newData.items as unknown as OrderItem[]) || prev.items
          } : null);

          if (newData.payment_status === 'paid') {
            toast.success('Paiement confirmé !');
          } else if (newData.payment_status === 'failed') {
            toast.error('Paiement échoué');
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [token, order?.id]);

  const checkPaymentStatus = async () => {
    if (!token) return;
    
    setChecking(true);
    try {
      // const { data, error } = await supabase.functions.invoke('check-payment-status', {
      //   body: { payment_token: token }
      // });

      const response = await fetch('/api/check-payment-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payment_token: token }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error checking status:', data);
        toast.error(data.error || 'Erreur lors de la vérification');
        return;
      }

      console.log('Payment status check result:', data);

      if (data.payment_status !== order?.payment_status) {
        setOrder(prev => prev ? { ...prev, payment_status: data.payment_status } : null);
        
        if (data.payment_status === 'paid') {
          toast.success('Paiement confirmé !');
        } else if (data.payment_status === 'failed') {
          toast.error('Paiement échoué');
        } else {
          toast.info('Statut mis à jour: ' + data.payment_status);
        }
      } else {
        toast.info('Statut inchangé: ' + data.payment_status);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erreur de vérification');
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async (item: OrderItem) => {
    // If it's a Supabase storage URL, create a signed URL
    if (item.file_url.includes('supabase')) {
      const path = item.file_url.split('/digital-products/')[1];
      if (path) {
        const { data } = await supabase.storage
          .from('digital-products')
          .createSignedUrl(path, 3600);
        
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
          return;
        }
      }
    }
    // Otherwise open the URL directly
    window.open(item.file_url, '_blank');
  };

  if (loading) {
    return (
      <Layout showGrid={false}>
        <div className="container py-16 max-w-lg text-center">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Chargement de votre commande...</p>
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout showGrid={false}>
        <div className="container py-16 max-w-lg text-center">
          <XCircle className="w-20 h-20 mx-auto text-destructive mb-6" />
          <h1 className="text-2xl font-bold mb-4">Erreur</h1>
          <p className="text-muted-foreground mb-8">{error || 'Commande non trouvée'}</p>
          <Button onClick={() => navigate('/')}>
            Retour à la boutique
          </Button>
        </div>
      </Layout>
    );
  }

  const isPaid = order.payment_status === 'paid';
  const isPending = order.payment_status === 'pending';

  return (
    <Layout showGrid={false}>
      <div className="container py-16 max-w-lg text-center">
        <div className="animate-scale-in">
          {isPaid ? (
            <CheckCircle className="w-20 h-20 mx-auto text-success mb-6" />
          ) : isPending ? (
            <Loader2 className="w-20 h-20 mx-auto text-primary animate-spin mb-6" />
          ) : (
            <XCircle className="w-20 h-20 mx-auto text-destructive mb-6" />
          )}
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold mb-4 animate-slide-up">
          {isPaid ? 'Paiement confirmé !' : isPending ? 'Paiement en attente' : 'Paiement échoué'}
        </h1>
        
        <p className="text-muted-foreground mb-2 animate-slide-up stagger-1">
          Commande: <span className="font-mono text-foreground">{order.order_number}</span>
        </p>
        
        <p className="text-muted-foreground mb-6 animate-slide-up stagger-1">
          {isPaid 
            ? 'Merci pour votre achat. Vos fichiers sont prêts à être téléchargés.'
            : isPending 
            ? 'Votre paiement est en cours de traitement.'
            : 'Le paiement a échoué. Veuillez réessayer.'}
        </p>

        {/* Manual status check button for pending/failed payments */}
        {!isPaid && (
          <Button
            onClick={checkPaymentStatus}
            disabled={checking}
            variant="secondary"
            className="gap-2 mb-6 animate-slide-up stagger-2"
          >
            {checking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Vérifier le statut
          </Button>
        )}

        {isPaid && order.items.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-6 mb-8 animate-slide-up stagger-2">
            <h2 className="font-semibold mb-4">Vos téléchargements</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <button 
                  key={item.id}
                  onClick={() => handleDownload(item)}
                  className="w-full flex items-center justify-between p-3 bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  <Download className="w-4 h-4 text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="gap-2 animate-slide-up stagger-3"
        >
          Continuer vos achats
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </Layout>
  );
};

export default Confirmation;
