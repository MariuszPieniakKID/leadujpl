# Dodawanie admina na Railway

## Metoda 1: Za pomocą Railway CLI (zalecana)

1. Zaloguj się do Railway (w nowym terminalu):
```bash
railway login
```

2. Połącz się z projektem:
```bash
cd /Users/kid/Leaduj
railway link
```

3. Uruchom skrypt w kontekście Railway (backend service):
```bash
railway run -s backend node scripts/create-admin-railway.mjs
```

## Metoda 2: Ręczne wykonanie SQL

Jeśli masz dostęp do Railway Dashboard:

1. Otwórz Railway Dashboard → Twój projekt → Postgres → Query
2. Wykonaj poniższe zapytanie SQL:

```sql
INSERT INTO "public"."User" (
  id,
  email,
  "firstName",
  "lastName",
  phone,
  street,
  city,
  "postalCode",
  "houseNumber",
  "apartmentNumber",
  company,
  industry,
  "passwordHash",
  role,
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  'amadeusz.smigielski@gmail.com',
  'Amadeusz',
  'Smigielski',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '$2a$10$i1pHPvO.tJwuR1Mmv4CqZu7ISLpO8e4ufTDLpfbcbSjstU4lGduTu',
  'ADMIN',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  role = EXCLUDED.role,
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "updatedAt" = NOW();
```

**Hash powyżej odpowiada hasłu: `Admin2025!Secure#Railway`**

## Dane logowania

- **Email:** amadeusz.smigielski@gmail.com
- **Hasło:** Admin2025!Secure#Railway

## Metoda 3: Przez Railway Variables i npx

```bash
# Pobierz DATABASE_URL z Railway
railway variables -s backend

# Ustaw zmienną lokalnie i uruchom skrypt
DATABASE_URL="<twoje_railway_database_url>" node scripts/create-admin-railway.mjs
```

