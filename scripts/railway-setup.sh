#!/usr/bin/env bash
set -euo pipefail

PROJECT="${1:-valiant-passion}"
BACKEND_SVC="${2:-backend}"
FRONTEND_SVC="${3:-frontend}"
DB_SVC="${4:-postgres}"

echo "==> Linking current directory to project: $PROJECT"
railway link -p "$PROJECT" >/dev/null

# Ensure DB service exists or create it
if railway variables -s "$DB_SVC" >/dev/null 2>&1; then
  echo "==> Database service '$DB_SVC' already exists"
else
  echo "==> Creating Postgres service '$DB_SVC'"
  railway add --database postgres --service "$DB_SVC"
fi

# Fetch or generate domains for backend and frontend
echo "==> Fetching backend domain for service '$BACKEND_SVC'"
BACKEND_DOMAIN=$(railway domain -s "$BACKEND_SVC" | tail -1 | tr -d '[:space:]')
[ -n "$BACKEND_DOMAIN" ] || { echo "Failed to obtain backend domain"; exit 1; }
echo "    BACKEND_DOMAIN=$BACKEND_DOMAIN"

echo "==> Fetching frontend domain for service '$FRONTEND_SVC'"
FRONTEND_DOMAIN=$(railway domain -s "$FRONTEND_SVC" | tail -1 | tr -d '[:space:]')
[ -n "$FRONTEND_DOMAIN" ] || { echo "Failed to obtain frontend domain"; exit 1; }
echo "    FRONTEND_DOMAIN=$FRONTEND_DOMAIN"

# Prepare cross-service DB reference without shell expansion
DATABASE_REF="\${{ ${DB_SVC}.DATABASE_URL }}"

# Set backend variables
echo "==> Setting backend variables on '$BACKEND_SVC'"
railway variables -s "$BACKEND_SVC" \
  --set "DATABASE_URL=$DATABASE_REF" \
  --set "CORS_ORIGIN=https://$FRONTEND_DOMAIN,http://localhost:3005"

# Set frontend variables
echo "==> Setting frontend variables on '$FRONTEND_SVC'"
railway variables -s "$FRONTEND_SVC" \
  --set "VITE_API_BASE=https://$BACKEND_DOMAIN"

# Run Prisma migrations on backend
echo "==> Running Prisma migrate deploy on '$BACKEND_SVC'"
railway run -s "$BACKEND_SVC" -- npm run prisma:deploy

# Redeploy services
echo "==> Redeploying services"
railway redeploy -s "$BACKEND_SVC"
railway redeploy -s "$FRONTEND_SVC"

# Health check
echo "==> Health check"
curl -s "https://$BACKEND_DOMAIN/health" || true

echo
echo "All done."
