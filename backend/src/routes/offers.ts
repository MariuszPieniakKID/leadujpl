import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import PDFDocument from 'pdfkit'
import { requireAuth } from '../middleware/auth'

const prisma = new PrismaClient()
const router = Router()

router.post('/generate', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const snapshot = (req.body || {}) as any
    const user = await prisma.user.findUnique({ where: { id: current.id }, select: { firstName: true, lastName: true, email: true } })

    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (c: any) => chunks.push(Buffer.from(c)))
    doc.on('end', () => {
      const pdf = Buffer.concat(chunks)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="oferta.pdf"')
      res.send(pdf)
    })

    const pln = (n: number) => (isFinite(n) ? n : 0).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
    const safe = (s: any) => (s == null ? '' : String(s))
    const form = snapshot.form || {}
    const calc = snapshot.calc || {}
    const today = new Date()
    const dateStr = today.toLocaleDateString('pl-PL')

    doc.fontSize(22).text('Oferta fotowoltaiczna', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).text(`Data: ${dateStr}`, { align: 'center' })
    doc.moveDown(1)
    doc.fontSize(11).text(`Przygotowal: ${user ? `${user.firstName} ${user.lastName}` : current.id}`)
    if (user?.email) doc.fontSize(10).fillColor('#555555').text(`Email: ${user.email}`).fillColor('black')
    doc.moveDown(0.5)
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#dddddd').stroke().strokeColor('black')
    doc.moveDown(0.75)

    doc.fontSize(14).text('Konfiguracja systemu')
    doc.moveDown(0.5)
    doc.fontSize(11)
      .text(`Rodzaj systemu: ${safe(form.systemType)}`)
      .text(`Zestaw PV: ${safe(form.pvSet) || '—'}`)
      .text(`Magazyn energii: ${safe(form.battery) || '—'}`)
      .text(`Model falownika: ${safe(form.inverter) || '—'}`)
      .text(`Backup: ${safe(form.backup)}`)
      .text(`Przekop: ${safe(form.trench)}`)
      .text(`Dotacja: ${safe(form.grant)}`)

    doc.moveDown(0.75)
    doc.fontSize(14).text('Podsumowanie kosztow (netto)')
    doc.moveDown(0.5)
    const row = (label: string, value: string | number, bold = false) => {
      const y = doc.y
      doc.fontSize(11).text(label, 40, y, { continued: true })
      doc.text(' ', { continued: true })
      doc.text(typeof value === 'number' ? pln(value) : (value as string), 300, y, { align: 'right' })
      if (bold) doc.font('Helvetica-Bold').text('', 40, y).font('Helvetica')
    }
    row('Zestaw PV', calc.pvBase || 0)
    if (form.systemType === 'PV – Grunt' && (calc.pvGroundExtra || 0) > 0) row('Doplata za grunt', calc.pvGroundExtra || 0)
    if (form.systemType === 'Falownik + Magazyn' && (calc.inverterPrice || 0) > 0) row('Falownik', calc.inverterPrice || 0)
    if (form.battery) row('Magazyn energii', calc.batteryPrice || 0)
    if (form.backup === 'Tak') row('Backup', calc.backupPrice || 0)
    if (form.trench === 'Tak') row('Przekop', calc.trenchPrice || 0)
    doc.moveDown(0.25)
    row('Suma netto', calc.subtotalNet || 0, true)
    row('Dotacja', `- ${pln(calc.grant || 0)}`)
    row('Wklad wlasny', `- ${pln(form.downPayment || 0)}`)
    doc.moveDown(0.25)
    row('Kwota finansowana', calc.financed || 0, true)

    doc.moveDown(1)
    doc.fontSize(14).text('Finansowanie')
    doc.moveDown(0.5)
    doc.fontSize(11)
      .text(`RRSO rocznie: ${(((calc.rrsoYear || 0) * 100) as number).toFixed(2)}%`)
      .text(`Okres (miesiace): ${safe(form.termMonths)}`)
      .text(`Rata miesieczna: ${pln(Math.abs(calc.monthly || 0))}`)

    doc.moveDown(1)
    doc.fontSize(9).fillColor('#666666').text('Oferta ma charakter pogladowy. Ostateczne warunki moga sie roznic.', { width: 515 })
    doc.fillColor('black')

    doc.end()
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/save', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { clientId, meetingId, fileName, snapshot } = req.body as { clientId: string; meetingId?: string; fileName?: string; snapshot: any }
    if (!clientId || !snapshot) return res.status(400).json({ error: 'clientId and snapshot required' })

    // Render PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (c: any) => chunks.push(Buffer.from(c)))
    await new Promise<void>(async (resolve) => {
      doc.on('end', () => resolve())
      const user = await prisma.user.findUnique({ where: { id: current.id }, select: { firstName: true, lastName: true, email: true } })
      const pln = (n: number) => (isFinite(n) ? n : 0).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
      const safe = (s: any) => (s == null ? '' : String(s))
      const form = snapshot.form || {}
      const calc = snapshot.calc || {}
      const today = new Date()
      const dateStr = today.toLocaleDateString('pl-PL')

      doc.fontSize(22).text('Oferta fotowoltaiczna', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(10).text(`Data: ${dateStr}`, { align: 'center' })
      doc.moveDown(1)
      doc.fontSize(11).text(`Przygotowal: ${user ? `${user.firstName} ${user.lastName}` : current.id}`)
      if (user?.email) doc.fontSize(10).fillColor('#555555').text(`Email: ${user.email}`).fillColor('black')
      doc.moveDown(0.5)
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#dddddd').stroke().strokeColor('black')
      doc.moveDown(0.75)

      doc.fontSize(14).text('Konfiguracja systemu')
      doc.moveDown(0.5)
      doc.fontSize(11)
        .text(`Rodzaj systemu: ${safe(form.systemType)}`)
        .text(`Zestaw PV: ${safe(form.pvSet) || '—'}`)
        .text(`Magazyn energii: ${safe(form.battery) || '—'}`)
        .text(`Model falownika: ${safe(form.inverter) || '—'}`)
        .text(`Backup: ${safe(form.backup)}`)
        .text(`Przekop: ${safe(form.trench)}`)
        .text(`Dotacja: ${safe(form.grant)}`)

      doc.moveDown(0.75)
      doc.fontSize(14).text('Podsumowanie kosztow (netto)')
      doc.moveDown(0.5)
      const row = (label: string, value: string | number, bold = false) => {
        const y = doc.y
        doc.fontSize(11).text(label, 40, y, { continued: true })
        doc.text(' ', { continued: true })
        doc.text(typeof value === 'number' ? pln(value) : (value as string), 300, y, { align: 'right' })
        if (bold) doc.font('Helvetica-Bold').text('', 40, y).font('Helvetica')
      }
      row('Zestaw PV', calc.pvBase || 0)
      if (form.systemType === 'PV – Grunt' && (calc.pvGroundExtra || 0) > 0) row('Doplata za grunt', calc.pvGroundExtra || 0)
      if (form.systemType === 'Falownik + Magazyn' && (calc.inverterPrice || 0) > 0) row('Falownik', calc.inverterPrice || 0)
      if (form.battery) row('Magazyn energii', calc.batteryPrice || 0)
      if (form.backup === 'Tak') row('Backup', calc.backupPrice || 0)
      if (form.trench === 'Tak') row('Przekop', calc.trenchPrice || 0)
      doc.moveDown(0.25)
      row('Suma netto', calc.subtotalNet || 0, true)
      row('Dotacja', `- ${pln(calc.grant || 0)}`)
      row('Wklad wlasny', `- ${pln(form.downPayment || 0)}`)
      doc.moveDown(0.25)
      row('Kwota finansowana', calc.financed || 0, true)

      doc.moveDown(1)
      doc.fontSize(14).text('Finansowanie')
      doc.moveDown(0.5)
      doc.fontSize(11)
        .text(`RRSO rocznie: ${(((calc.rrsoYear || 0) * 100) as number).toFixed(2)}%`)
        .text(`Okres (miesiace): ${safe(form.termMonths)}`)
        .text(`Rata miesieczna: ${pln(Math.abs(calc.monthly || 0))}`)

      doc.moveDown(1)
      doc.fontSize(9).fillColor('#666666').text('Oferta ma charakter pogladowy. Ostateczne warunki moga sie roznic.', { width: 515 })
      doc.fillColor('black')

      doc.end()
    })
    const pdf = Buffer.concat(chunks)

    const created = await prisma.offer.create({
      data: {
        clientId,
        ...(meetingId ? { meetingId } : {}),
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
    const offers = await prisma.offer.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { id: true, fileName: true, createdAt: true, meetingId: true } })
    res.json(offers)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/meeting/:meetingId', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { meetingId } = req.params
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
    if (!meeting) return res.json([])
    if (current.role !== 'ADMIN' && current.role !== 'MANAGER' && meeting.attendeeId !== current.id) {
      return res.json([])
    }
    const offers = await prisma.offer.findMany({ where: { meetingId }, orderBy: { createdAt: 'desc' }, select: { id: true, fileName: true, createdAt: true, meetingId: true } })
    res.json(offers)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { id } = req.params
    const offer = await prisma.offer.findUnique({ where: { id }, include: { client: { include: { meetings: true } } } })
    if (!offer) return res.status(404).json({ error: 'Not found' })
    if (current.role !== 'ADMIN' && current.role !== 'MANAGER') {
      const can = offer.client.meetings.some(m => m.attendeeId === current.id)
      if (!can && offer.ownerId !== current.id) return res.status(403).json({ error: 'Forbidden' })
    }
    res.json({ id: offer.id, fileName: offer.fileName, createdAt: offer.createdAt, snapshot: offer.snapshot, clientId: offer.clientId, ownerId: offer.ownerId })
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


