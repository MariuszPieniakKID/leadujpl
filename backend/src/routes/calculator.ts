import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
// Load default calculator data from backend-local JSON to work in container runtime
// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseData: any = require('../data/calculatorData.json')
import { requireAuth, requireManagerOrAdmin } from '../middleware/auth'

const prisma = new PrismaClient()
const router = Router()

const CONFIG_ID = 'default'

router.get('/config', requireAuth, async (_req, res) => {
  try {
    let cfg = await prisma.calculatorConfig.findUnique({ where: { id: CONFIG_ID } })
    // If not present, seed from embedded JSON
    if (!cfg) {
      cfg = await prisma.calculatorConfig.create({ data: { id: CONFIG_ID, settings: (baseData as any).settings, pricing: (baseData as any).pricing } })
    } else {
      // Optional auto-sync: if keys are missing in DB pricing vs embedded, merge embedded keys
      try {
        const embedded = (baseData as any) || {}
        const merged = { settings: cfg.settings || {}, pricing: cfg.pricing || {} }
        function deepMerge(a: any, b: any) {
          if (!a || typeof a !== 'object') return b
          const out: any = Array.isArray(a) ? [...a] : { ...a }
          for (const k of Object.keys(b || {})) {
            if (a[k] && typeof a[k] === 'object' && typeof b[k] === 'object' && !Array.isArray(a[k]) && !Array.isArray(b[k])) {
              out[k] = deepMerge(a[k], b[k])
            } else if (a[k] === undefined) {
              out[k] = b[k]
            }
          }
          return out
        }
        const nextSettings = deepMerge(cfg.settings || {}, embedded.settings || {})
        let nextPricing = deepMerge(cfg.pricing || {}, embedded.pricing || {})
        // Ensure PV set prices are in sync with embedded (treat embedded as source of truth)
        try {
          const embP = embedded.pricing || {}
          nextPricing = {
            ...nextPricing,
            pvPowerPriceD: { ...(embP.pvPowerPriceD || {}) },
            pvPowerPriceE: { ...(embP.pvPowerPriceE || {}) },
          }
        } catch {}
        const changed = JSON.stringify(nextSettings) !== JSON.stringify(cfg.settings) || JSON.stringify(nextPricing) !== JSON.stringify(cfg.pricing)
        if (changed) {
          cfg = await prisma.calculatorConfig.update({ where: { id: CONFIG_ID }, data: { settings: nextSettings, pricing: nextPricing } })
        }
      } catch {}
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


