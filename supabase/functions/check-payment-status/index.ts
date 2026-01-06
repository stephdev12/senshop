import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_token } = await req.json();

    console.log('Checking payment status for token:', payment_token);

    if (!payment_token) {
      return new Response(
        JSON.stringify({ error: 'Missing payment_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get order by payment token
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_token', payment_token)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found order:', order.id, 'with MoneyFusion token:', order.transaction_number);

    // If no MoneyFusion token, we can't check status
    if (!order.transaction_number) {
      console.log('No MoneyFusion token found, returning current status');
      return new Response(
        JSON.stringify({
          success: true,
          order_id: order.id,
          order_number: order.order_number,
          payment_status: order.payment_status,
          message: 'No MoneyFusion token available for verification'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call MoneyFusion API to check payment status
    const moneyFusionStatusUrl = `https://www.pay.moneyfusion.net/paiementNotif/${order.transaction_number}`;
    
    console.log('Calling MoneyFusion status URL:', moneyFusionStatusUrl);

    const statusResponse = await fetch(moneyFusionStatusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const statusData = await statusResponse.json();
    console.log('MoneyFusion status response:', JSON.stringify(statusData, null, 2));

    // Map MoneyFusion status to our internal status
    let newPaymentStatus = order.payment_status;
    let paymentMethod = order.payment_method;

    // MoneyFusion returns different formats - handle them
    if (statusData.statut === true || statusData.status === 'completed' || statusData.event === 'payin.session.completed') {
      newPaymentStatus = 'paid';
      paymentMethod = statusData.moyen || statusData.payment_method || 'mobile_money';
    } else if (statusData.statut === false || statusData.status === 'failed' || statusData.event === 'payin.session.cancelled') {
      newPaymentStatus = 'failed';
    } else if (statusData.status === 'pending' || statusData.event === 'payin.session.pending') {
      newPaymentStatus = 'pending';
    }

    // Update order if status changed
    if (newPaymentStatus !== order.payment_status) {
      console.log('Updating order status from', order.payment_status, 'to', newPaymentStatus);
      
      const updateData: Record<string, unknown> = {
        payment_status: newPaymentStatus,
      };

      if (paymentMethod) {
        updateData.payment_method = paymentMethod;
      }

      if (newPaymentStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (updateError) {
        console.error('Error updating order:', updateError);
      } else {
        console.log('Order status updated successfully');

        // Log the status check
        await supabase.from('admin_logs').insert({
          action: 'payment_status_verified',
          entity_type: 'order',
          entity_id: order.id,
          details: {
            old_status: order.payment_status,
            new_status: newPaymentStatus,
            moneyfusion_response: statusData,
            verified_at: new Date().toISOString()
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        payment_status: newPaymentStatus,
        previous_status: order.payment_status,
        moneyfusion_data: statusData,
        message: newPaymentStatus !== order.payment_status 
          ? 'Payment status updated' 
          : 'Payment status unchanged'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-payment-status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
