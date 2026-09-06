#!/bin/sh
set -eu
mkdir -p /data/clients
chmod 700 /data /data/clients || true

case "${VPN_ENDPOINT:-}" in
  ""|YOUR_PUBLIC_IP_OR_DOMAIN|your.public.ip.or.domain)
    echo "ERROR: Set VPN_ENDPOINT to your public IP or DNS name." >&2; exit 64;;
esac
case "${ADMIN_TOKEN:-}" in
  ""|change-this-now|replace-with-a-long-random-string)
    echo "ERROR: Set ADMIN_TOKEN to a long random secret (recommended 24+ characters)." >&2; exit 64;;
esac
if [ "${#ADMIN_TOKEN}" -lt 16 ]; then
  echo "ERROR: ADMIN_TOKEN must be at least 16 characters." >&2; exit 64
fi

python -m app.init_server
exec uvicorn app.main:app --host 0.0.0.0 --port 8080 --proxy-headers --forwarded-allow-ips='*'
