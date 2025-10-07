// Seed sample meetings for user@user.pl on Railway via public API
// Usage: node scripts/seed-railway-meetings.mjs [BASE_URL]
// BASE_URL default is the backend public domain from Railway env

const BASE = process.argv[2] || process.env.RAILWAY_BACKEND_URL || 'https://backend-production-12b2.up.railway.app';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} at ${url}: ${text}`);
  }
  return res.json();
}

function toIso(date) {
  return date.toISOString();
}

function addHours(date, h) {
  const d = new Date(date);
  d.setHours(d.getHours() + h);
  return d;
}

function atTime(date, hour, minute) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

(async () => {
  console.log(`Using backend: ${BASE}`);
  // 1) Login as admin
  const { token } = await fetchJson(`${BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@admin.pl', password: 'test123' }),
  });
  const authHeader = { Authorization: `Bearer ${token}` };

  // 2) Fetch users, locate user@user.pl
  const users = await fetchJson(`${BASE}/api/users`, { headers: authHeader });
  const user = users.find(u => u.email === 'user@user.pl');
  if (!user) throw new Error('Nie znaleziono użytkownika user@user.pl');
  console.log(`Target user: ${user.firstName} ${user.lastName} (${user.id})`);

  // 3) Create some past and future meetings
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const notesPast = ['Podsumowanie oferty', 'Wizyta u klienta', 'Omówienie potrzeb'];
  const notesFuture = ['Prezentacja oferty', 'Wideokonferencja', 'Spotkanie w biurze'];
  const locations = ['U klienta', 'Biuro', 'Zdalne'];

  const payloads = [];

  // 3 past meetings: -5d 10:00, -3d 14:00, -1d 9:00
  const pastOffsets = [5, 3, 1];
  pastOffsets.forEach((d, idx) => {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const start = atTime(day, [10, 14, 9][idx], 0);
    const end = addHours(start, 1);
    payloads.push({
      scheduledAt: toIso(start),
      endsAt: toIso(end),
      location: locations[idx % locations.length],
      notes: `${notesPast[idx % notesPast.length]} (przeszłe)`,
      attendeeId: user.id,
      status: idx % 2 === 0 ? 'Sukces' : 'Rezygnacja',
      client: {
        firstName: `KlientP${idx+1}`,
        lastName: 'Testowy',
        city: 'Warszawa',
      },
      contactConsent: true,
    });
  });

  // 3 future meetings: +1d 11:00, +3d 13:30, +7d 16:00
  const futureDefs = [
    { d: 1, h: 11, m: 0 },
    { d: 3, h: 13, m: 30 },
    { d: 7, h: 16, m: 0 },
  ];
  futureDefs.forEach((def, idx) => {
    const day = new Date(today);
    day.setDate(day.getDate() + def.d);
    const start = atTime(day, def.h, def.m);
    const end = addHours(start, 1);
    payloads.push({
      scheduledAt: toIso(start),
      endsAt: toIso(end),
      location: locations[idx % locations.length],
      notes: `${notesFuture[idx % notesFuture.length]} (przyszłe)`,
      attendeeId: user.id,
      client: {
        firstName: `KlientF${idx+1}`,
        lastName: 'Testowy',
        city: 'Kraków',
      },
      contactConsent: true,
    });
  });

  let created = 0;
  for (const p of payloads) {
    await fetchJson(`${BASE}/api/meetings`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify(p),
    });
    created++;
  }
  console.log(`Utworzono ${created} spotkań dla ${user.email}`);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
