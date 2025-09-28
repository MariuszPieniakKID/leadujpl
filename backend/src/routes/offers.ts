import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import PDFDocument from 'pdfkit'
import { requireAuth } from '../middleware/auth'

const prisma = new PrismaClient()
const router = Router()

// PDF helper: normalize labels to ASCII to avoid garbled diacritics in some PDF viewers
function toAscii(input: string): string {
  try {
    return String(input)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'L')
  } catch {
    return String(input)
  }
}

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
    const quick = (snapshot as any).quickCalc || null
    const today = new Date()
    const dateStr = today.toLocaleDateString('pl-PL')

    doc.fontSize(22).text(toAscii('Oferta fotowoltaiczna'), { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).text(`Data: ${dateStr}`, { align: 'center' })
    doc.moveDown(1)
    doc.fontSize(11).text(toAscii(`Przygotował: ${user ? `${user.firstName} ${user.lastName}` : current.id}`))
    if (user?.email) doc.fontSize(10).fillColor('#555555').text(toAscii(`Email: ${user.email}`)).fillColor('black')
    doc.moveDown(0.5)
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#dddddd').stroke().strokeColor('black')
    doc.moveDown(0.75)

    doc.fontSize(14).text(toAscii('Konfiguracja systemu'))
    doc.moveDown(0.5)
    doc.fontSize(11)
      .text(toAscii(`Rodzaj systemu: ${safe(form.systemType)}`))
      .text(toAscii(`Zestaw PV: ${safe(form.pvSet) || '—'}`))
      .text(toAscii(`Magazyn energii: ${safe(form.battery) || '—'}`))
      .text(toAscii(`Model falownika: ${safe(form.inverter) || '—'}`))
      .text(toAscii(`Backup: ${safe(form.backup)}`))
      .text(toAscii(`Przekop: ${safe(form.trench)}`))
      .text(toAscii(`Dotacja: ${safe(form.grant)}`))

    // Show quick PV and battery calculator summary inline (if available)
    if (quick) {
      const usage = typeof quick.resultKwpUsage === 'number' ? Number(quick.resultKwpUsage || 0) : null
      const cost = typeof quick.resultKwpCost === 'number' ? Number(quick.resultKwpCost || 0) : null
      const legacy = typeof quick.resultKwp === 'number' ? Number(quick.resultKwp || 0) : null
      if (usage != null || cost != null || legacy != null) {
        doc.moveDown(0.25)
        doc.fontSize(11)
        if (usage != null) doc.text(toAscii(`Moc PV (zużycie): ${usage.toFixed(2)} kWp`))
        if (cost != null) doc.text(toAscii(`Moc PV (koszt): ${cost.toFixed(2)} kWp`))
        if (usage == null && cost == null && legacy != null) doc.text(toAscii(`Moc PV (kalkulator): ${legacy.toFixed(2)} kWp`))
      }
      // Battery
      const bat = (snapshot as any).batteryCalc || null
      if (bat) {
        const bUsage = typeof bat.resultKwhUsage === 'number' ? Number(bat.resultKwhUsage || 0) : null
        const bCost = typeof bat.resultKwhCost === 'number' ? Number(bat.resultKwhCost || 0) : null
        if (bUsage != null || bCost != null) {
          doc.moveDown(0.25)
          doc.fontSize(11)
          if (bUsage != null) doc.text(toAscii(`Magazyn (zużycie): ${bUsage.toFixed(2)} kWh`))
          if (bCost != null) doc.text(toAscii(`Magazyn (koszt): ${bCost.toFixed(2)} kWh`))
        }
      }
    }

    doc.moveDown(0.75)
    doc.fontSize(14).text(toAscii('Podsumowanie kosztów (netto)'))
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

    doc.moveDown(0.75)
    doc.fontSize(14).text('Rozliczenie')
    doc.moveDown(0.5)
    row('Dotacja', `- ${pln(calc.grant || 0)}`)
    row('Wkład własny', `- ${pln(form.downPayment || 0)}`)
    doc.moveDown(0.25)
    row('Kwota finansowana', calc.financed || 0, true)

    doc.moveDown(1)
    doc.fontSize(14).text('Finansowanie')
    doc.moveDown(0.5)
    doc.fontSize(11)
      .text(`RRSO rocznie: ${(((calc.rrsoYear || 0) * 100) as number).toFixed(2)}%`)
      .text(`Okres (miesiace): ${safe(form.termMonths)}`)
      .text(`Rata miesieczna: ${pln(Math.abs(calc.monthly || 0))}`)

    // Other options (12..120 months)
    try {
      const financed = Number(calc.financed || 0)
      const rrsoYear = Number(calc.rrsoYear || 0)
      const rateMonthly = rrsoYear / 12
      const pmt = (ratePerPeriod: number, numberOfPayments: number, presentValue: number): number => {
        if (!isFinite(ratePerPeriod) || !isFinite(numberOfPayments) || !isFinite(presentValue)) return 0
        if (ratePerPeriod === 0) return numberOfPayments > 0 ? -(presentValue / numberOfPayments) : 0
        const r = ratePerPeriod
        const n = numberOfPayments
        return -(presentValue * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      }
      const provided: Array<{ term: number; monthly: number }> = Array.isArray((calc as any).otherTerms) ? (calc as any).otherTerms : []
      let alts: Array<{ term: number; monthly: number }>
      if (provided.length > 0) {
        alts = provided.filter(t => t.term >= 12 && t.term <= 120)
      } else {
        const terms: number[] = Array.from({ length: 10 }, (_, i) => (i + 1) * 12)
        alts = terms.map(t => ({ term: t, monthly: pmt(rateMonthly, t, financed) }))
      }
      doc.moveDown(0.75)
      doc.fontSize(12).text('Pozostale mozliwosci')
      doc.moveDown(0.35)
      const startY = doc.y
      const leftX = 40
      const rightX = 320
      const lineH = 14
      const rows = Math.ceil(alts.length / 2)
      for (let i = 0; i < rows; i++) {
        const y = startY + i * lineH
        const left = alts[i]
        if (left) {
          doc.fontSize(10).text(`${left.term} mies. (${(left.term/12)} lat): ${pln(Math.abs(left.monthly || 0))}`, leftX, y)
        }
        const right = alts[i + rows]
        if (right) {
          doc.fontSize(10).text(`${right.term} mies. (${(right.term/12)} lat): ${pln(Math.abs(right.monthly || 0))}`, rightX, y)
        }
      }
      doc.moveDown( (rows * lineH) / 12 )
    } catch {}

    doc.moveDown(1)
    doc.fontSize(9).fillColor('#666666').text('Oferta ma charakter pogladowy. Ostateczne warunki moga sie roznic.', { width: 515 })
    doc.fillColor('black')

    if (quick && typeof quick.resultKwp === 'number') {
      doc.moveDown(0.75)
      doc.fontSize(14).text('Kalkulator mocy PV')
      doc.moveDown(0.5)
      doc.fontSize(11)
      const rowKV = (label: string, value: string) => {
        const y = doc.y
      doc.text(toAscii(label), 40, y, { continued: true })
        doc.text(' ', { continued: true })
        doc.text(value, 300, y, { align: 'right' })
      }
      rowKV('Średnie mies. zużycie', `${(Number(quick.monthlyKwh || 0)).toLocaleString('pl-PL')} kWh`)
      rowKV('Margines bezpieczeństwa', `${Number(quick.margin || 0).toFixed(2)}`)
      rowKV('Roczna prod. 1 kWp', `${Number(quick.yieldPerKwp || 0).toLocaleString('pl-PL')} kWh`)
      rowKV('Wynik', `${Number(quick.resultKwp || 0).toFixed(2)} kWp`)
    }

    doc.end()
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.post('/save', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { offerId, clientId, meetingId, fileName, snapshot } = req.body as { offerId?: string; clientId: string; meetingId?: string; fileName?: string; snapshot: any }
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
      const quick = (snapshot as any).quickCalc || null
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

      // Show quick PV and battery calculator summary inline (if available)
      if (quick) {
        const usage = typeof (quick as any).resultKwpUsage === 'number' ? Number((quick as any).resultKwpUsage || 0) : null
        const cost = typeof (quick as any).resultKwpCost === 'number' ? Number((quick as any).resultKwpCost || 0) : null
        const legacy = typeof (quick as any).resultKwp === 'number' ? Number((quick as any).resultKwp || 0) : null
        if (usage != null || cost != null || legacy != null) {
          doc.moveDown(0.25)
          doc.fontSize(11)
          if (usage != null) doc.text(toAscii(`Moc PV (zużycie): ${usage.toFixed(2)} kWp`))
          if (cost != null) doc.text(toAscii(`Moc PV (koszt): ${cost.toFixed(2)} kWp`))
          if (usage == null && cost == null && legacy != null) doc.text(toAscii(`Moc PV (kalkulator): ${legacy.toFixed(2)} kWp`))
        }
        // Battery
        const bat = (snapshot as any).batteryCalc || null
        if (bat) {
          const bUsage = typeof (bat as any).resultKwhUsage === 'number' ? Number((bat as any).resultKwhUsage || 0) : null
          const bCost = typeof (bat as any).resultKwhCost === 'number' ? Number((bat as any).resultKwhCost || 0) : null
          if (bUsage != null || bCost != null) {
            doc.moveDown(0.25)
            doc.fontSize(11)
            if (bUsage != null) doc.text(toAscii(`Magazyn (zużycie): ${bUsage.toFixed(2)} kWh`))
            if (bCost != null) doc.text(toAscii(`Magazyn (koszt): ${bCost.toFixed(2)} kWh`))
          }
        }
      }

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

      doc.moveDown(0.75)
    doc.fontSize(14).text(toAscii('Rozliczenie'))
      doc.moveDown(0.5)
      row('Dotacja', `- ${pln(calc.grant || 0)}`)
      row('Wkład własny', `- ${pln(form.downPayment || 0)}`)
      doc.moveDown(0.25)
      row('Kwota finansowana', calc.financed || 0, true)

      doc.moveDown(1)
    doc.fontSize(14).text(toAscii('Finansowanie'))
      doc.moveDown(0.5)
      doc.fontSize(11)
      .text(toAscii(`RRSO rocznie: ${(((calc.rrsoYear || 0) * 100) as number).toFixed(2)}%`))
      .text(toAscii(`Okres (miesiące): ${safe(form.termMonths)}`))
      .text(toAscii(`Rata miesięczna: ${pln(Math.abs(calc.monthly || 0))}`))

      // Other options (12..120 months)
      try {
        const financed = Number(calc.financed || 0)
        const rrsoYear = Number(calc.rrsoYear || 0)
        const rateMonthly = rrsoYear / 12
        const pmt = (ratePerPeriod: number, numberOfPayments: number, presentValue: number): number => {
          if (!isFinite(ratePerPeriod) || !isFinite(numberOfPayments) || !isFinite(presentValue)) return 0
          if (ratePerPeriod === 0) return numberOfPayments > 0 ? -(presentValue / numberOfPayments) : 0
          const r = ratePerPeriod
          const n = numberOfPayments
          return -(presentValue * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        }
        const provided: Array<{ term: number; monthly: number }> = Array.isArray((calc as any).otherTerms) ? (calc as any).otherTerms : []
        let alts: Array<{ term: number; monthly: number }>
        if (provided.length > 0) {
          alts = provided.filter(t => t.term >= 12 && t.term <= 120)
        } else {
          const terms: number[] = Array.from({ length: 10 }, (_, i) => (i + 1) * 12)
          alts = terms.map(t => ({ term: t, monthly: pmt(rateMonthly, t, financed) }))
        }
        doc.moveDown(0.75)
        doc.fontSize(12).text('Pozostale mozliwosci')
        doc.moveDown(0.35)
        const startY = doc.y
        const leftX = 40
        const rightX = 320
        const lineH = 14
        const rows = Math.ceil(alts.length / 2)
        for (let i = 0; i < rows; i++) {
          const y = startY + i * lineH
          const left = alts[i]
          if (left) {
            doc.fontSize(10).text(`${left.term} mies. (${(left.term/12)} lat): ${pln(Math.abs(left.monthly || 0))}`, leftX, y)
          }
          const right = alts[i + rows]
          if (right) {
            doc.fontSize(10).text(`${right.term} mies. (${(right.term/12)} lat): ${pln(Math.abs(right.monthly || 0))}`, rightX, y)
          }
        }
        doc.moveDown( (rows * lineH) / 12 )
      } catch {}

      doc.moveDown(1)
    doc.fontSize(9).fillColor('#666666').text(toAscii('Oferta ma charakter poglądowy. Ostateczne warunki mogą się różnić.'), { width: 515 })
      doc.fillColor('black')

      if (quick && typeof quick.resultKwp === 'number') {
        doc.moveDown(0.75)
      doc.fontSize(14).text(toAscii('Kalkulator mocy PV'))
        doc.moveDown(0.5)
        doc.fontSize(11)
        const rowKV = (label: string, value: string) => {
          const y = doc.y
          doc.text(label, 40, y, { continued: true })
          doc.text(' ', { continued: true })
          doc.text(value, 300, y, { align: 'right' })
        }
      rowKV(toAscii('Średnie mies. zużycie'), `${(Number(quick.monthlyKwh || 0)).toLocaleString('pl-PL')} kWh`)
      rowKV(toAscii('Margines bezpieczeństwa'), `${Number(quick.margin || 0).toFixed(2)}`)
      rowKV(toAscii('Roczna prod. 1 kWp'), `${Number(quick.yieldPerKwp || 0).toLocaleString('pl-PL')} kWh`)
      rowKV(toAscii('Wynik'), `${Number(quick.resultKwp || 0).toFixed(2)} kWp`)
      }

      doc.end()
    })
    const pdf = Buffer.concat(chunks)

    if (offerId) {
      const updated = await prisma.offer.update({ where: { id: offerId }, data: {
        clientId,
        ...(meetingId ? { meetingId } : {}),
        ownerId: current.id,
        fileName: fileName || `oferta-${Date.now()}.pdf`,
        mimeType: 'application/pdf',
        pdf,
        snapshot,
      }})
      return res.status(200).json({ id: updated.id, fileName: updated.fileName })
    } else {
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
      return res.status(201).json({ id: created.id, fileName: created.fileName })
    }
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

router.get('/client/:clientId', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { clientId } = req.params
    // Only list offers related to clients that have meetings with current user (or admin/manager see all)
    let where: any = { clientId }
    if (current.role !== 'ADMIN' && current.role !== 'MANAGER') {
      const count = await prisma.client.count({ where: { id: clientId, meetings: { some: { attendeeId: current.id } } } })
      if (count === 0) {
        // Fallback: show offers created by the current user for this client
        where = { clientId, ownerId: current.id }
      }
    }
    const offers = await prisma.offer.findMany({ where, orderBy: { createdAt: 'desc' }, select: { id: true, fileName: true, createdAt: true, meetingId: true } })
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

router.get('/:id/view', requireAuth, async (req, res) => {
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
    res.setHeader('Content-Disposition', `inline; filename="${offer.fileName}"`)
    res.send(Buffer.from(offer.pdf))
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router


