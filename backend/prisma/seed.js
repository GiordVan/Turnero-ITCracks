const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Limpiar datos viejos (turnos primero: referencian professional via SET NULL)
  await prisma.turn.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professional.deleteMany();

  // Admin user
  const hashedPassword = await bcrypt.hash('admin1234', 10);
  await prisma.user.upsert({
    where: { email: 'admin@turnero.com' },
    update: {},
    create: { email: 'admin@turnero.com', password: hashedPassword, name: 'Administrador', role: 'ADMIN' },
  });

  // Admin config
  await prisma.adminConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', turnDuration: 30 },
  });

  // Work bands
  const existingBands = await prisma.workBand.count();
  if (existingBands === 0) {
    await prisma.workBand.createMany({
      data: [
        { label: 'Mañana', startTime: '08:00', endTime: '13:00', sortOrder: 0 },
        { label: 'Tarde',  startTime: '17:00', endTime: '21:00', sortOrder: 1 },
      ],
    });
  }

  // Peluqueros (padre e hijo) — caso ancla de la demo
  await prisma.professional.createMany({
    data: [
      { name: 'Carlos (padre)', sortOrder: 0 },
      { name: 'Nico (hijo)',    sortOrder: 1 },
    ],
  });

  console.log('Seed completado. Admin: admin@turnero.com / admin1234');
  console.log('Peluqueros: Carlos (padre), Nico (hijo)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
