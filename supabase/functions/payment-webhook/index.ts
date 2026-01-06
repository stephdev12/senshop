import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-moneyfusion-signature',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    console.log('Received webhook body:', body);

    const payload = JSON.parse(body);
    
    // MoneyFusion webhook payload structure
    const { 
      event,
      tokenPay,
      numeroSend,
      nomclient,
      numeroTransaction,
      Montant,
      frais,
      personal_Info,
      moyen
    } = payload;

    console.log('Payment webhook received:', { event, tokenPay, numeroTransaction, Montant });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract order info from personal_Info
    let orderId: string | null = null;
    let orderNumber: string | null = null;
    let paymentToken: string | null = null;

    if (personal_Info && Array.isArray(personal_Info) && personal_Info.length > 0) {
      const info = personal_Info[0];
      orderId = info.orderId;
      orderNumber = info.orderNumber;
      paymentToken = info.paymentToken;
    }

    console.log('Extracted order info:', { orderId, orderNumber, paymentToken });

    // Find the order - try by orderId first, then by MoneyFusion token
    let order = null;
    
    if (orderId) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
      
      if (!error && data) {
        order = data;
      }
    }

    // If not found by orderId, try by transaction_number (MoneyFusion token)
    if (!order && tokenPay) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_number', tokenPay)
        .maybeSingle();
      
      if (!error && data) {
        order = data;
      }
    }

    if (!order) {
      console.error('Order not found for webhook:', { orderId, tokenPay });
      return new Response(
        JSON.stringify({ error: 'Order not found', received: { orderId, tokenPay } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found order:', order.id, 'Current status:', order.payment_status);

    // Map MoneyFusion event to payment status
    let paymentStatus = order.payment_status;
    
    switch (event) {
      case 'payin.session.completed':
        paymentStatus = 'paid';
        break;
      case 'payin.session.cancelled':
        paymentStatus = 'failed';
        break;
      case 'payin.session.pending':
        paymentStatus = 'pending';
        break;
      default:
        console.log('Unknown event type:', event);
    }

    // Only update if status has changed (avoid duplicate notifications)
    if (paymentStatus === order.payment_status && event !== 'payin.session.completed') {
      console.log('Status unchanged, skipping update');
      return new Response(
        JSON.stringify({ success: true, message: 'Status unchanged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order with payment status
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus,
      payment_method: moyen || null,
    };

    if (numeroTransaction) {
      updateData.transaction_number = numeroTransaction;
    }

    if (paymentStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order updated successfully:', order.id, 'New status:', paymentStatus);

    // Log admin action
    await supabase.from('admin_logs').insert({
      action: 'payment_webhook_received',
      entity_type: 'order',
      entity_id: order.id,
      details: { 
        event,
        status: paymentStatus, 
        transaction_number: numeroTransaction, 
        payment_method: moyen,
        amount: Montant,
        fees: frais
      }
    });

    return new Response(
      JSON.stringify({ success: true, status: paymentStatus, order_id: order.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in payment-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
