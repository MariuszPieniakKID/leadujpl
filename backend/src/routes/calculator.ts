import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import baseData from '../../../frontend/src/data/calculatorData.json'
import { requireAuth, requireManagerOrAdmin } from '../middleware/auth'

const prisma = new PrismaClient()
const router = Router()

const CONFIG_ID = 'default'

router.get('/config', requireAuth, async (_req, res) => {
  try {
    let cfg = await prisma.calculatorConfig.findUnique({ where: { id: CONFIG_ID } })
    if (!cfg) {
      cfg = await prisma.calculatorConfig.create({ data: { id: CONFIG_ID, settings: (baseData as any).settings, pricing: (baseData as any).pricing } })
    }
    res.json({ settings: cfg.settings, pricing: cfg.pricing })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.put('/config', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const { settings, pricing } = req.body as { settings: any; pricing: any }
    if (!settings || !pricing) return res.status(400).json({ error: 'settings and pricing are required' })
    const updated = await prisma.calculatorConfig.upsert({
      where: { id: CONFIG_ID },
      update: { settings, pricing },
      create: { id: CONFIG_ID, settings, pricing },
    })
    res.json({ settings: updated.settings, pricing: updated.pricing })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router


