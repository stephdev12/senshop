# Guide de Déploiement VPS (Node.js + Nginx)
Domaine : `digi.senstudio.space`

## 1. Préparation sur le VPS

Connectez-vous à votre VPS et installez les outils nécessaires :

```bash
# Mise à jour
sudo apt update && sudo apt upgrade -y

# Installation de Node.js 20 (si pas déjà fait)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git certbot python3-certbot-nginx

# Installation de PM2 (pour gérer le serveur en arrière-plan)
sudo npm install -g pm2
```

## 2. Installation du Projet

On va installer le projet dans `/var/www/senstudio`.

```bash
# Création du dossier
sudo mkdir -p /var/www/senstudio
sudo chown -R $USER:$USER /var/www/senstudio

# Cloner votre projet (via HTTPS ou SSH selon votre config git)
# Si votre code est sur GitHub/GitLab, mettez l'URL ici :
git clone <VOTRE_URL_GIT> /var/www/senstudio

# OU BIEN, si vous transférez les fichiers manuellement via FileZilla/SCP,
# assurez-vous de copier tout le contenu du dossier local vers /var/www/senstudio
```

## 3. Configuration du Backend (API)

```bash
cd /var/www/senstudio/server

# Installer les dépendances du serveur
npm install

# Créer le fichier .env de production
nano .env
```

**Collez ceci dans le fichier `.env` du serveur (Ctrl+O pour sauver, Ctrl+X pour quitter) :**

```env
# Supabase
SUPABASE_URL=https://qmhihjtxfidijnlbeqzp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaGloanR4ZmlkaWpubGJlcXpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODYzNjIwNiwiZXhwIjoyMDc0MjEyMjA2fQ.OFuwXZLXgQaItpXkQvnNchAGaQx00TC4WxiwpVVGBCc

# URLs
SITE_URL=https://digi.senstudio.space
API_PUBLIC_URL=https://digi.senstudio.space

# MoneyFusion (URL qui marche !)
MONEYFUSION_API_URL=https://www.pay.moneyfusion.net/Wemove/3b2ccd753bf04364/pay/

PORT=3000
```

**Démarrer le serveur avec PM2 :**

```bash
pm2 start server.js --name "senstudio-api"
pm2 save
pm2 startup
# Suivez l'instruction affichée par "pm2 startup" si nécessaire
```

## 4. Configuration du Frontend (React)

```bash
cd /var/www/senstudio

# Installer les dépendances
npm install

# Créer le fichier .env pour le Build
nano .env
```

**Collez les clés publiques Supabase :**

```env
VITE_SUPABASE_PROJECT_ID="qmhihjtxfidijnlbeqzp"
VITE_SUPABASE_URL="https://qmhihjtxfidijnlbeqzp.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaGloanR4ZmlkaWpubGJlcXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzYyMDYsImV4cCI6MjA3NDIxMjIwNn0.4suD0pWXcnm5Z1ZVQVD7A1JJqwC5pD6RrTxUNM0HEtY"
```

**Construire le site :**

```bash
npm run build
```

Cela va créer un dossier `dist` qui contient votre site optimisé.

## 5. Configuration Nginx (Le Proxy)

C'est ici qu'on relie le tout (Frontend + Backend).

```bash
sudo nano /etc/nginx/sites-available/senstudio
```

**Collez cette configuration :**

```nginx
server {
    server_name digi.senstudio.space;

    root /var/www/senstudio/dist;
    index index.html;

    # Gzip pour la vitesse
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # 1. Configuration du Frontend (React SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Proxy vers le Backend Node.js (API)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Activer le site :**

```bash
sudo ln -s /etc/nginx/sites-available/senstudio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## 6. Sécurisation SSL (HTTPS)

```bash
sudo certbot --nginx -d digi.senstudio.space
```

Et voilà ! Votre site sera accessible sur `https://digi.senstudio.space`.
