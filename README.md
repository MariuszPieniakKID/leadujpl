# Leaduj

Aplikacja do zbierania leadów, zarządzania spotkaniami i analityki.

## Struktura
- `frontend` – React + Vite (TS)
- `backend` – Node.js + Express + Prisma (PostgreSQL)

## Uruchomienie lokalne
1. Uruchom Postgres (Docker):
```bash
cd /Users/kid/Leaduj
docker compose up -d
```
2. Utwórz pliki `.env`:
- Backend: `backend/.env`
```bash
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://leaduj:leaduj@localhost:5432/leaduj?schema=public
JWT_SECRET=dev_secret_change_me
```
- Frontend (opcjonalnie): `frontend/.env`
```bash
VITE_API_BASE=/
```
3. Zainicjalizuj bazę i uruchom API:
```bash
cd /Users/kid/Leaduj/backend
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

5. (Opcjonalnie) Zaszseeduj bazę użytkownikami testowymi – po uruchomieniu Postgresa i migracji:
```bash
cd /Users/kid/Leaduj/backend
npm run seed
```
4. Uruchom frontend:
```bash
cd /Users/kid/Leaduj/frontend
npm run dev
```
Frontend: `http://localhost:5173` (proxy do `http://localhost:4000`).

## Deploy na Railway
- Backend:
  - Zmienne: `DATABASE_URL`, `CORS_ORIGIN`, `PORT`
  - Build: `npm run build`, Start: `npm run start`
  - Dodaj `JWT_SECRET`
- Frontend:
  - `VITE_API_BASE` ustaw na URL backendu (np. `https://leaduj-api.up.railway.app`)

## Modele danych
- Role: `ADMIN`, `MANAGER`, `SALES_REP`
- Encje: `User`, `Team`, `Lead`, `Meeting`
