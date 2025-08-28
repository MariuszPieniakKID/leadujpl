import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      email: 'admin@admin.pl',
      password: 'test123',
      role: 'ADMIN' as const,
      firstName: 'Mario',
      lastName: 'OKOK',
      phone: '123123123',
      street: 'Losowa 1',
      city: 'Warszawa',
      postalCode: '00-001',
      houseNumber: '1',
      apartmentNumber: '2',
      company: 'SUPER firma',
      industry: 'fotowoltaika',
    },
    {
      email: 'user@user.pl',
      password: 'test123',
      role: 'SALES_REP' as const,
      firstName: 'Pracownik',
      lastName: 'MOOJ',
      phone: '123123123',
      street: 'Przypadkowa 12',
      city: 'Kraków',
      postalCode: '30-002',
      houseNumber: '12',
      apartmentNumber: '4',
      company: 'SUPER firma',
      industry: 'fotowoltaika',
    },
    {
      email: 'menago@example.com',
      password: 'test123',
      role: 'MANAGER' as const,
      firstName: 'Menago',
      lastName: 'OOOOO',
      phone: '123123123',
      street: 'Szczęśliwa 7',
      city: 'Gdańsk',
      postalCode: '80-003',
      houseNumber: '7',
      apartmentNumber: '1',
      company: 'SUPER firma',
      industry: 'fotowoltaika',
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, firstName: u.firstName, lastName: u.lastName, phone: u.phone, street: u.street, city: u.city, postalCode: u.postalCode, houseNumber: u.houseNumber, apartmentNumber: u.apartmentNumber, company: u.company, industry: u.industry },
      create: { email: u.email, passwordHash, role: u.role, firstName: u.firstName, lastName: u.lastName, phone: u.phone, street: u.street, city: u.city, postalCode: u.postalCode, houseNumber: u.houseNumber, apartmentNumber: u.apartmentNumber, company: u.company, industry: u.industry },
    });
  }

  console.log('Seeded users');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});


