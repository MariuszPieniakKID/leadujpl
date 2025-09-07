import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import PDFDocument from 'pdfkit'
import { requireAuth } from '../middleware/auth'

const prisma = new PrismaClient()
const router = Router()

router.post('/generate', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const snapshot = req.body as any

    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(Buffer.from(c)))
    doc.on('end', () => {
      const pdf = Buffer.concat(chunks)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="oferta.pdf"')
      res.send(pdf)
    })

    // Simple PDF rendering
    doc.fontSize(20).text('Oferta Fotowoltaika', { align: 'center' })
    doc.moveDown()
    doc.fontSize(12).text(`Przygotował: ${current.id}`)
    doc.moveDown()
    doc.fontSize(14).text('Podsumowanie:')
    doc.moveDown(0.5)
    const entries = Object.entries(snapshot || {})
    for (const [key, value] of entries) {
      doc.fontSize(11).text(`${key}: ${typeof value === 'number' ? value.toLocaleString('pl-PL') : JSON.stringify(value)}`)
    }

    doc.end()
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/save', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { clientId, fileName, snapshot } = req.body as { clientId: string; fileName?: string; snapshot: any }
    if (!clientId || !snapshot) return res.status(400).json({ error: 'clientId and snapshot required' })

    // Render PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(Buffer.from(c)))
    await new Promise<void>((resolve) => {
      doc.on('end', () => resolve())
      doc.fontSize(20).text('Oferta Fotowoltaika', { align: 'center' })
      doc.moveDown()
      doc.fontSize(12).text(`Przygotował: ${current.id}`)
      doc.moveDown()
      doc.fontSize(14).text('Podsumowanie:')
      doc.moveDown(0.5)
      const entries = Object.entries(snapshot || {})
      for (const [key, value] of entries) {
        doc.fontSize(11).text(`${key}: ${typeof value === 'number' ? value.toLocaleString('pl-PL') : JSON.stringify(value)}`)
      }
      doc.end()
    })
    const pdf = Buffer.concat(chunks)

    const created = await prisma.offer.create({
      data: {
        clientId,
        ownerId: current.id,
        fileName: fileName || `oferta-${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        pdf,
        snapshot,
      },
    })
    res.status(201).json({ id: created.id, fileName: created.fileName })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/client/:clientId', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { clientId } = req.params
    // Only list offers related to clients that have meetings with current user (or admin/manager see all)
    if (current.role !== 'ADMIN' && current.role !== 'MANAGER') {
      const count = await prisma.client.count({ where: { id: clientId, meetings: { some: { attendeeId: current.id } } } })
      if (count === 0) return res.json([])
    }
    const offers = await prisma.offer.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { id: true, fileName: true, createdAt: true } })
    res.json(offers)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { id } = req.params
    const offer = await prisma.offer.findUnique({ where: { id }, include: { client: { include: { meetings: true } } } })
    if (!offer) return res.status(404).json({ error: 'Not found' })
    if (current.role !== 'ADMIN' && current.role !== 'MANAGER') {
      const can = offer.client.meetings.some(m => m.attendeeId === current.id)
      if (!can && offer.ownerId !== current.id) return res.status(403).json({ error: 'Forbidden' })
    }
    res.setHeader('Content-Type', offer.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${offer.fileName}"`)
    res.send(Buffer.from(offer.pdf))
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router


