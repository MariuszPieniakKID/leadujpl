// Create admin user on Railway via Prisma
// Usage: node scripts/create-admin-railway.mjs

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'amadeusz.smigielski@gmail.com';
  const password = 'Admin2025!Secure#Railway';
  const role = 'ADMIN';
  
  console.log(`Creating admin user: ${email}`);
  console.log(`Password: ${password}`);
  console.log('');
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { 
        passwordHash, 
        role,
        firstName: 'Amadeusz',
        lastName: 'Smigielski',
      },
      create: { 
        email, 
        passwordHash, 
        role,
        firstName: 'Amadeusz',
        lastName: 'Smigielski',
        phone: '',
        street: '',
        city: '',
        postalCode: '',
        houseNumber: '',
        apartmentNumber: '',
        company: '',
        industry: '',
      },
    });
    
    console.log('✓ Admin user created/updated successfully!');
    console.log(`User ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log('');
    console.log('Login credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

