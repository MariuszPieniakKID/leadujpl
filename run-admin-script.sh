#!/usr/bin/env bash
set -e

echo "🚀 Dodawanie admina na Railway..."
echo ""

# Sprawdź czy użytkownik jest zalogowany
if ! railway whoami >/dev/null 2>&1; then
  echo "❌ Nie jesteś zalogowany do Railway"
  echo "Uruchom: railway login"
  exit 1
fi

# Link do projektu jeśli jeszcze nie
if ! railway status >/dev/null 2>&1; then
  echo "Linkuję do projektu Railway..."
  railway link
fi

# Uruchom skrypt
echo "📝 Uruchamiam skrypt tworzenia admina..."
railway run -s backend node scripts/create-admin-railway.mjs

echo ""
echo "✅ Gotowe! Dane logowania:"
echo "   Email: amadeusz.smigielski@gmail.com"
echo "   Hasło: Admin2025!Secure#Railway"

