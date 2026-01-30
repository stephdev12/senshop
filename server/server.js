import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check .env file.');
  if (!supabaseUrl) console.error(' - Missing: SUPABASE_URL');
  if (!supabaseServiceKey) console.error(' - Missing: SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Constants
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';
const MONEYFUSION_API_URL = process.env.MONEYFUSION_API_URL || 'https://api.moneyfusion.net/v1/paiement';

// Helper to format phone number (cleaned version)
function formatPhoneNumber(phone) {
  return phone.replace(/\s+/g, '').replace(/^\+/, '').replace(/^00/, '');
}

// =================== CREATE PAYMENT ===================
app.post('/api/create-payment', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, items, total_amount, currency } = req.body;

    console.log('Creating payment for:', { customer_name, customer_phone, total_amount, currency });

    if (!customer_name || !customer_phone || !items || !total_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const paymentToken = crypto.randomUUID();

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
      return res.status(500).json({ error: 'Failed to create order' });
    }

    const articleObject = {};
    items.forEach((item) => {
      articleObject[item.name] = item.price_fcfa * item.quantity;
    });

    const formattedPhone = formatPhoneNumber(customer_phone);
    console.log('Formatted phone:', formattedPhone);

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
      return_url: `${SITE_URL}/confirmation?token=${paymentToken}`,
      webhook_url: `${process.env.API_PUBLIC_URL || SITE_URL}/api/payment-webhook`
    };
    
    console.log('MoneyFusion Payload:', JSON.stringify(moneyFusionPayload, null, 2));

    const moneyFusionResponse = await fetch(MONEYFUSION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moneyFusionPayload)
    });

    const moneyFusionData = await moneyFusionResponse.json();
    console.log('MoneyFusion Response:', moneyFusionData);

    if (!moneyFusionData.statut) {
      return res.status(400).json({ 
        error: moneyFusionData.message || 'Payment initiation failed',
        details: moneyFusionData
      });
    }

    await supabase
      .from('orders')
      .update({ transaction_number: moneyFusionData.token })
      .eq('id', order.id);

    return res.json({
      success: true,
      order_id: order.id,
      order_number: orderNumber,
      payment_token: paymentToken,
      payment_url: moneyFusionData.url,
      moneyfusion_token: moneyFusionData.token,
      message: 'Payment initiated successfully'
    });

  } catch (error) {
    console.error('Error in create-payment:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// =================== PAYMENT WEBHOOK ===================
app.post('/api/payment-webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received webhook:', JSON.stringify(payload, null, 2));

    const { event, tokenPay, numeroTransaction, Montant, frais, personal_Info, moyen } = payload;

    let orderId = null;
    if (personal_Info && Array.isArray(personal_Info) && personal_Info.length > 0) {
      orderId = personal_Info[0].orderId;
    }

    let order = null;
    
    if (orderId) {
      const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (data) order = data;
    }

    if (!order && tokenPay) {
      const { data } = await supabase.from('orders').select('*').eq('transaction_number', tokenPay).maybeSingle();
      if (data) order = data;
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let paymentStatus = order.payment_status;
    switch (event) {
      case 'payin.session.completed': paymentStatus = 'paid'; break;
      case 'payin.session.cancelled': paymentStatus = 'failed'; break;
      case 'payin.session.pending': paymentStatus = 'pending'; break;
    }

    const updateData = {
      payment_status: paymentStatus,
      payment_method: moyen || null,
    };

    if (numeroTransaction) updateData.transaction_number = numeroTransaction;
    if (paymentStatus === 'paid') updateData.paid_at = new Date().toISOString();

    await supabase.from('orders').update(updateData).eq('id', order.id);

    await supabase.from('admin_logs').insert({
      action: 'payment_webhook_received',
      entity_type: 'order',
      entity_id: order.id,
      details: { event, status: paymentStatus, transaction_number: numeroTransaction, amount: Montant, fees: frais }
    });

    return res.json({ success: true, status: paymentStatus });

  } catch (error) {
    console.error('Error in webhook:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// =================== CHECK PAYMENT STATUS ===================
app.post('/api/check-payment-status', async (req, res) => {
  try {
    const { payment_token } = req.body;

    if (!payment_token) {
      return res.status(400).json({ error: 'Missing payment_token' });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_token', payment_token)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.transaction_number) {
      return res.json({
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        payment_status: order.payment_status,
      });
    }

    const statusResponse = await fetch(`https://www.pay.moneyfusion.net/paiementNotif/${order.transaction_number}`);
    const statusData = await statusResponse.json();

    let newPaymentStatus = order.payment_status;
    let paymentMethod = order.payment_method;

    if (statusData.statut === true || statusData.event === 'payin.session.completed') {
      newPaymentStatus = 'paid';
      paymentMethod = statusData.moyen || 'mobile_money';
    } else if (statusData.statut === false || statusData.event === 'payin.session.cancelled') {
      newPaymentStatus = 'failed';
    }

    if (newPaymentStatus !== order.payment_status) {
      const updateData = { payment_status: newPaymentStatus };
      if (paymentMethod) updateData.payment_method = paymentMethod;
      if (newPaymentStatus === 'paid') updateData.paid_at = new Date().toISOString();

      await supabase.from('orders').update(updateData).eq('id', order.id);
    }

    return res.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      payment_status: newPaymentStatus,
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// =================== SERVE STATIC FILES (FRONTEND) ===================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the 'dist' directory (located one level up)
app.use(express.static(path.join(__dirname, '../dist')));

// Handle React Routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`- POST /api/create-payment`);
  console.log(`- POST /api/payment-webhook`);
  console.log(`- POST /api/check-payment-status`);
});
