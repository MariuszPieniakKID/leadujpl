import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import meetingsRouter from './routes/meetings';
import clientsRouter from './routes/clients';
import calculatorRouter from './routes/calculator';
import offersRouter from './routes/offers';
import { PrismaClient } from '@prisma/client';
import attachmentsRouter from './routes/attachments';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3005'], credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/calculator', calculatorRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/offers', offersRouter);

app.get('/health', async (_req, res) => {
  let dbHealthy = true;
  let dbError: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbHealthy = false;
    dbError = (error as Error).message;
  }
  res.json({ status: 'ok', dbHealthy, dbError });
});

app.get('/api/leads', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const teamId = req.query.teamId as string | undefined;

    const leads = await prisma.lead.findMany({
      where: {
        ...(userId ? { ownerId: userId } : {}),
        ...(teamId ? { teamId } : {}),
      },
      include: { owner: true, team: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const { firstName, lastName, phone, email, company, notes, ownerId, teamId } = req.body as {
      firstName: string; lastName: string; phone?: string; email?: string; company?: string; notes?: string; ownerId?: string; teamId?: string;
    };

    // Ensure there is an owner
    let resolvedOwnerId: string;
    if (ownerId) {
      const existing = await prisma.user.findUnique({ where: { id: ownerId } });
      if (existing) {
        resolvedOwnerId = existing.id;
      } else {
        const created = await prisma.user.create({
          data: {
            id: ownerId,
            email: `${ownerId}@seed.local`,
            firstName: 'Seed',
            lastName: 'Owner',
            passwordHash: 'placeholder',
            role: 'SALES_REP',
          },
        });
        resolvedOwnerId = created.id;
      }
    } else {
      const demoEmail = 'demo@leaduj.local';
      const demo = await prisma.user.upsert({
        where: { email: demoEmail },
        update: {},
        create: { email: demoEmail, firstName: 'Demo', lastName: 'User', passwordHash: 'placeholder', role: 'SALES_REP' },
      });
      resolvedOwnerId = demo.id;
    }

    const lead = await prisma.lead.create({
      data: { firstName, lastName, phone, email, company, notes, ownerId: resolvedOwnerId, teamId },
    });
    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

const PORT = Number(process.env.PORT || 5001);
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});


