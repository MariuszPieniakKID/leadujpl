-- Add admin user: amadeusz.smigielski@gmail.com
-- Password: Admin2025!Secure#Railway

INSERT INTO "User" (
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
)
SELECT
  'clx' || substring(md5(random()::text) from 1 for 22),
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
  'ADMIN'::"Role",
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "User" WHERE email = 'amadeusz.smigielski@gmail.com'
);

-- Update if user already exists
UPDATE "User"
SET
  "passwordHash" = '$2a$10$i1pHPvO.tJwuR1Mmv4CqZu7ISLpO8e4ufTDLpfbcbSjstU4lGduTu',
  role = 'ADMIN'::"Role",
  "firstName" = 'Amadeusz',
  "lastName" = 'Smigielski',
  "updatedAt" = NOW()
WHERE email = 'amadeusz.smigielski@gmail.com';

