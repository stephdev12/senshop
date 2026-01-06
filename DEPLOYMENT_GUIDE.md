# Guide de Déploiement VPS - SEN STUDIO

## 📋 Prérequis

- **VPS** : Ubuntu 22.04 LTS (minimum 1GB RAM, 20GB SSD)
- **Domaine** : Un nom de domaine pointant vers votre VPS
- **Accès SSH** : Accès root ou sudo au serveur

---

## 🔧 1. Configuration Initiale du VPS

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des dépendances de base
sudo apt install -y curl git nginx certbot python3-certbot-nginx

# Installation de Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installation de Deno (pour les Edge Functions)
curl -fsSL https://deno.land/install.sh | sh
echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Vérification des installations
node -v
npm -v
deno --version
```

---

## 🗄️ 2. Configuration de PostgreSQL

### Option A : PostgreSQL Local

```bash
# Installation de PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Connexion à PostgreSQL
sudo -u postgres psql

# Créer la base de données et l'utilisateur
CREATE USER senstudio WITH PASSWORD 'votre_mot_de_passe_securise';
CREATE DATABASE senstudio OWNER senstudio;
GRANT ALL PRIVILEGES ON DATABASE senstudio TO senstudio;
\q
```

### Schéma de la Base de Données

```sql
-- Connexion à la base
sudo -u postgres psql -d senstudio

-- =============================================
-- SEN STUDIO - Complete Database Schema
-- =============================================

-- Products table
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price_fcfa NUMERIC NOT NULL,
    image_url TEXT NOT NULL,
    file_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Orders table
CREATE TABLE public.orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    total_amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'FCFA',
    items JSONB NOT NULL,
    personal_info JSONB,
    payment_token TEXT,
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    transaction_number TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Admin logs table
CREATE TABLE public.admin_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id UUID,
    entity_type TEXT,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Function pour updated_at automatique
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger pour products
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Index pour améliorer les performances
CREATE INDEX idx_orders_payment_token ON orders(payment_token);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_products_is_active ON products(is_active);
```

### Option B : Utiliser Supabase Cloud (Recommandé)

Gardez votre projet Supabase existant et utilisez simplement les variables d'environnement pour vous y connecter.

---

## 📦 3. Déploiement du Frontend

```bash
# Créer le répertoire de l'application
sudo mkdir -p /var/www/senstudio
sudo chown -R $USER:$USER /var/www/senstudio

# Cloner le projet (ou transférer les fichiers)
cd /var/www/senstudio
git clone votre_repo .

# Installer les dépendances
npm install

# Créer le fichier .env
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://tbwexvstaasgnnedpgps.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid2V4dnN0YWFzZ25uZWRwZ3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyODQzMzMsImV4cCI6MjA4MTg2MDMzM30.TgVJzkay7PmKz28xi6u1EMy36x6niUt8mEbgqmK09-0
VITE_SUPABASE_PROJECT_ID=tbwexvstaasgnnedpgps
EOF

# Build de production
npm run build
```

---

## 🚀 4. Déploiement des Edge Functions (API Backend)

### Créer le serveur Deno

```bash
# Créer le répertoire pour les fonctions
mkdir -p /var/www/senstudio-api

# Créer le fichier principal
cat > /var/www/senstudio-api/server.ts << 'EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-moneyfusion-signature',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL')!;
const MONEYFUSION_API_URL = Deno.env.get('MONEYFUSION_API_URL')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// =================== CREATE PAYMENT ===================
async function handleCreatePayment(req: Request): Promise<Response> {
  try {
    const { customer_name, customer_phone, customer_email, items, total_amount, currency } = await req.json();

    console.log('Creating payment for:', { customer_name, customer_phone, total_amount, currency });

    if (!customer_name || !customer_phone || !items || !total_amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const articleObject: Record<string, number> = {};
    items.forEach((item: { name: string; price_fcfa: number; quantity: number }) => {
      articleObject[item.name] = item.price_fcfa * item.quantity;
    });

    const formattedPhone = customer_phone
      .replace(/\s+/g, '')
      .replace(/^\+/, '')
      .replace(/^00/, '');

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
      webhook_url: `${SITE_URL}/api/payment-webhook`
    };

    const moneyFusionResponse = await fetch(MONEYFUSION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moneyFusionPayload)
    });

    const moneyFusionData = await moneyFusionResponse.json();

    if (!moneyFusionData.statut) {
      return new Response(
        JSON.stringify({ error: moneyFusionData.message || 'Payment initiation failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('orders')
      .update({ transaction_number: moneyFusionData.token })
      .eq('id', order.id);

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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// =================== PAYMENT WEBHOOK ===================
async function handlePaymentWebhook(req: Request): Promise<Response> {
  try {
    const body = await req.text();
    console.log('Received webhook body:', body);

    const payload = JSON.parse(body);
    const { event, tokenPay, numeroTransaction, Montant, frais, personal_Info, moyen } = payload;

    let orderId: string | null = null;
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
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let paymentStatus = order.payment_status;
    switch (event) {
      case 'payin.session.completed': paymentStatus = 'paid'; break;
      case 'payin.session.cancelled': paymentStatus = 'failed'; break;
      case 'payin.session.pending': paymentStatus = 'pending'; break;
    }

    const updateData: Record<string, unknown> = {
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

    return new Response(
      JSON.stringify({ success: true, status: paymentStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// =================== CHECK PAYMENT STATUS ===================
async function handleCheckPaymentStatus(req: Request): Promise<Response> {
  try {
    const { payment_token } = await req.json();

    if (!payment_token) {
      return new Response(
        JSON.stringify({ error: 'Missing payment_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_token', payment_token)
      .single();

    if (error || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!order.transaction_number) {
      return new Response(
        JSON.stringify({
          success: true,
          order_id: order.id,
          order_number: order.order_number,
          payment_status: order.payment_status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      const updateData: Record<string, unknown> = { payment_status: newPaymentStatus };
      if (paymentMethod) updateData.payment_method = paymentMethod;
      if (newPaymentStatus === 'paid') updateData.paid_at = new Date().toISOString();

      await supabase.from('orders').update(updateData).eq('id', order.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        payment_status: newPaymentStatus,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// =================== ROUTER ===================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  console.log(`${req.method} ${path}`);

  switch (path) {
    case '/api/create-payment':
      return handleCreatePayment(req);
    case '/api/payment-webhook':
      return handlePaymentWebhook(req);
    case '/api/check-payment-status':
      return handleCheckPaymentStatus(req);
    default:
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
}, { port: 8000 });

console.log('API Server running on http://localhost:8000');
EOF
```

### Créer le fichier d'environnement API

```bash
cat > /var/www/senstudio-api/.env << 'EOF'
SUPABASE_URL=https://tbwexvstaasgnnedpgps.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
SITE_URL=https://votre-domaine.com
MONEYFUSION_API_URL=https://api.moneyfusion.net/v1/paiement
MONEYFUSION_WEBHOOK_SECRET=votre_webhook_secret
EOF
```

### Créer le service systemd pour l'API

```bash
sudo cat > /etc/systemd/system/senstudio-api.service << 'EOF'
[Unit]
Description=SEN STUDIO API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/senstudio-api
ExecStart=/home/ubuntu/.deno/bin/deno run --allow-net --allow-env --allow-read server.ts
Restart=on-failure
RestartSec=5
EnvironmentFile=/var/www/senstudio-api/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable senstudio-api
sudo systemctl start senstudio-api
```

---

## 🌐 5. Configuration Nginx

```bash
sudo cat > /etc/nginx/sites-available/senstudio << 'EOF'
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    # Frontend React
    root /var/www/senstudio/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # API Backend (proxy vers Deno)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # React Router - SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Activer le site
sudo ln -s /etc/nginx/sites-available/senstudio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Tester et redémarrer Nginx
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 6. SSL avec Certbot

```bash
# Installer le certificat SSL
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com

# Renouvellement automatique (déjà configuré par défaut)
sudo certbot renew --dry-run
```

---

## 🔄 7. Modification du Frontend pour l'API locale

Si vous utilisez un backend local au lieu de Supabase Edge Functions, modifiez les appels API :

```typescript
// Dans src/pages/Checkout.tsx - remplacer :
const { data } = await supabase.functions.invoke('create-payment', { body: paymentData });

// Par :
const response = await fetch('/api/create-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(paymentData)
});
const data = await response.json();
```

---

## 📊 8. Monitoring et Logs

```bash
# Voir les logs de l'API
sudo journalctl -u senstudio-api -f

# Voir les logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Installer PM2 pour Node.js (optionnel, si conversion en Node.js)
npm install -g pm2
```

---

## ✅ 9. Checklist de Déploiement

- [ ] VPS configuré avec Ubuntu 22.04
- [ ] Node.js 20 installé
- [ ] Deno installé
- [ ] PostgreSQL configuré (ou connexion Supabase)
- [ ] Base de données créée avec le schéma
- [ ] Frontend buildé et déployé
- [ ] API Deno configurée et démarrée
- [ ] Nginx configuré
- [ ] SSL activé avec Certbot
- [ ] Variables d'environnement configurées
- [ ] MoneyFusion webhook URL mise à jour
- [ ] Tests de paiement effectués

---

## 🔧 10. Commandes Utiles

```bash
# Redémarrer l'API
sudo systemctl restart senstudio-api

# Rebuilder le frontend
cd /var/www/senstudio && npm run build

# Vérifier le statut des services
sudo systemctl status senstudio-api
sudo systemctl status nginx

# Mettre à jour le code
cd /var/www/senstudio
git pull
npm install
npm run build
sudo systemctl restart nginx
```

---

## ⚠️ Notes Importantes

1. **Sécurité** : Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
2. **Webhook** : Mettre à jour l'URL du webhook MoneyFusion avec `https://votre-domaine.com/api/payment-webhook`
3. **HTTPS** : Obligatoire pour les paiements en production
4. **Backups** : Configurer des sauvegardes régulières de la base de données

---

## 📞 Support

Pour toute question, contactez l'équipe de développement.
