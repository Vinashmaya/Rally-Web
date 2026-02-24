#!/bin/bash
# Rally Web Nginx Reverse Proxy Configuration
# Run as root: sudo bash setup-nginx.sh
# Writes configs to /etc/nginx/conf.d/ and reloads nginx

set -e

SSL_CERT="/etc/ssl/rally.vin/origin.pem"
SSL_KEY="/etc/ssl/rally.vin/origin.key"
VPS_IP="66.179.189.87"
LOG_DIR="/var/www/vhosts/system/rally.vin/logs"

# app.rally.vin -> staff app (port 3001)
cat > /etc/nginx/conf.d/app.rally.vin.conf << NGINX
server {
    listen ${VPS_IP}:80;
    server_name app.rally.vin;
    return 301 https://\$host\$request_uri;
}

server {
    listen ${VPS_IP}:443 ssl;
    http2 on;
    server_name app.rally.vin;

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    client_max_body_size 50m;

    access_log ${LOG_DIR}/app_access_ssl_log;
    error_log ${LOG_DIR}/app_error_log;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINX

# manage.rally.vin -> manage app (port 3002)
cat > /etc/nginx/conf.d/manage.rally.vin.conf << NGINX
server {
    listen ${VPS_IP}:80;
    server_name manage.rally.vin;
    return 301 https://\$host\$request_uri;
}

server {
    listen ${VPS_IP}:443 ssl;
    http2 on;
    server_name manage.rally.vin;

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    client_max_body_size 50m;

    access_log ${LOG_DIR}/manage_access_ssl_log;
    error_log ${LOG_DIR}/manage_error_log;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINX

# admin.rally.vin -> admin app (port 3003)
cat > /etc/nginx/conf.d/admin.rally.vin.conf << NGINX
server {
    listen ${VPS_IP}:80;
    server_name admin.rally.vin;
    return 301 https://\$host\$request_uri;
}

server {
    listen ${VPS_IP}:443 ssl;
    http2 on;
    server_name admin.rally.vin;

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    client_max_body_size 50m;

    access_log ${LOG_DIR}/admin_access_ssl_log;
    error_log ${LOG_DIR}/admin_error_log;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINX

echo "Nginx configs written. Testing..."
nginx -t
if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "NGINX_RELOADED_OK"
else
    echo "NGINX_CONFIG_ERROR"
    exit 1
fi
