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
    const { customer_name, customer_phone, customer_email, items, total_amount, currency } = await req.json();

    console.log('Creating payment for:', { customer_name, customer_phone, total_amount, currency });

    // Validate required fields
    if (!customer_name || !customer_phone || !items || !total_amount) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    // Generate payment token for tracking
    const paymentToken = crypto.randomUUID();

    // Create order in database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        items,
        total_amount,
        currency: currency || 'FCFA',
        payment_token: paymentToken,
        payment_status: 'pending',
        personal_info: { name: customer_name, phone: customer_phone, email: customer_email }
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order created:', order.id);

    // Get site URL for callback
    const siteUrl = Deno.env.get('SITE_URL') || 'https://lovable.dev';
    const moneyFusionApiUrl = Deno.env.get('MONEYFUSION_API_URL');

    if (!moneyFusionApiUrl) {
      console.error('MONEYFUSION_API_URL not configured');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare articles for MoneyFusion - format: single object with all items
    const articleObject: Record<string, number> = {};
    items.forEach((item: { name: string; price_fcfa: number; quantity: number }) => {
      articleObject[item.name] = item.price_fcfa * item.quantity;
    });

    // Format phone number: remove spaces, +, and ensure it's clean
    const formattedPhone = customer_phone
      .replace(/\s+/g, '')
      .replace(/^\+/, '')
      .replace(/^00/, '');

    console.log('Formatted phone:', formattedPhone);

    // Create MoneyFusion payment request with correct format
    const moneyFusionPayload = {
      totalPrice: total_amount,
      article: [articleObject],
      personal_Info: [
        {
          orderId: order.id,
          orderNumber: orderNumber,
          paymentToken: paymentToken
        }
      ],
      numeroSend: formattedPhone,
      nomclient: customer_name,
      return_url: `${siteUrl}/confirmation?token=${paymentToken}`,
      webhook_url: `${supabaseUrl}/functions/v1/payment-webhook`
    };

    console.log('MoneyFusion payload:', JSON.stringify(moneyFusionPayload, null, 2));

    // Call MoneyFusion API
    const moneyFusionResponse = await fetch(moneyFusionApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(moneyFusionPayload)
    });

    const moneyFusionData = await moneyFusionResponse.json();
    console.log('MoneyFusion response:', JSON.stringify(moneyFusionData));

    if (!moneyFusionData.statut) {
      console.error('MoneyFusion payment failed:', moneyFusionData);
      return new Response(
        JSON.stringify({ 
          error: moneyFusionData.message || 'Payment initiation failed',
          details: moneyFusionData 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store MoneyFusion token in order for tracking
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        transaction_number: moneyFusionData.token 
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order with MoneyFusion token:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: orderNumber,
        payment_token: paymentToken,
        payment_url: moneyFusionData.url,
        moneyfusion_token: moneyFusionData.token,
        message: 'Payment initiated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
