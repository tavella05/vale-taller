import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const adminExists = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@tallerllave.com',
        firstName: 'Admin',
        lastName: '',
        password: await bcrypt.hash('admin1234', 12),
        role: 'admin',
      },
    });
    console.log('Admin user created: admin / admin1234');
  }

  // Working hours (Mon–Fri open, Sat–Sun closed)
  const hoursExist = await prisma.workingHours.count();
  if (hoursExist === 0) {
    for (let day = 0; day <= 6; day++) {
      await prisma.workingHours.create({
        data: {
          dayOfWeek: day,
          isOpen: day < 5,
          openTime: '09:00',
          closeTime: '18:00',
          slotDuration: 30,
        },
      });
    }
    console.log('Working hours seeded');
  }

  // Default services
  const servicesExist = await prisma.service.count();
  if (servicesExist === 0) {
    await prisma.service.createMany({
      data: [
        { name: 'Copia de llave', serviceType: 'keys', durationMinutes: 15, price: 1500 },
        { name: 'Llave con chip', serviceType: 'keys', durationMinutes: 30, price: 5000 },
        { name: 'Limpieza de inyectores', serviceType: 'injectors', durationMinutes: 60, price: 8000 },
        { name: 'Reprogramación ECU', serviceType: 'ecu', durationMinutes: 120, price: 15000 },
      ],
    });
    console.log('Services seeded');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
