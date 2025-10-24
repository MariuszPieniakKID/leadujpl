import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'

const prisma = new PrismaClient()
const router = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

router.post('/upload', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    const current = req.user!
    const { meetingId, clientId, category } = req.body as { meetingId: string; clientId: string; category?: string }
    if (!meetingId || !clientId) return res.status(400).json({ error: 'meetingId and clientId required' })
    const files = (req.files as Express.Multer.File[]) || []
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' })

    const created = await Promise.all(files.map(f => prisma.attachment.create({ data: {
      meetingId,
      clientId,
      ownerId: current.id,
      category: category?.trim() || null,
      fileName: f.originalname,
      mimeType: f.mimetype,
      data: Buffer.from(f.buffer),
    }})))
    res.status(201).json({ count: created.length })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/meeting/:meetingId', requireAuth, async (req, res) => {
  try {
    const { meetingId } = req.params
    const list = await prisma.attachment.findMany({ where: { meetingId }, select: { id: true, fileName: true, mimeType: true, createdAt: true } })
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// List attachments for a client (across meetings)
router.get('/client/:clientId', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params
    const list = await prisma.attachment.findMany({ where: { clientId }, select: { id: true, fileName: true, mimeType: true, createdAt: true, meetingId: true, category: true }, orderBy: [{ category: 'asc' }, { createdAt: 'desc' }] })
    res.json(list)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const a = await prisma.attachment.findUnique({ where: { id } })
    if (!a) return res.status(404).json({ error: 'Not found' })
    res.setHeader('Content-Type', a.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${a.fileName}"`)
    res.send(Buffer.from(a.data))
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Inline view for preview-capable types (browser decides rendering)
router.get('/:id/view', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const a = await prisma.attachment.findUnique({ where: { id } })
    if (!a) return res.status(404).json({ error: 'Not found' })
    res.setHeader('Content-Type', a.mimeType)
    res.setHeader('Content-Disposition', `inline; filename="${a.fileName}"`)
    res.send(Buffer.from(a.data))
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Permanently delete an attachment
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { id } = req.params
    const a = await prisma.attachment.findUnique({ where: { id } })
    if (!a) return res.status(404).json({ error: 'Not found' })
    // Allow owner or admin/manager
    if (!(current.role === 'ADMIN' || current.role === 'MANAGER' || a.ownerId === current.id)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await prisma.attachment.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router


