import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function setTime(date: Date, hour: number, minute: number): Date {
  const d = new Date(date)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function main() {
  const userEmail = 'user@user.pl'
  const user = await prisma.user.findUnique({ where: { email: userEmail } })
  if (!user) {
    throw new Error(`Nie znaleziono użytkownika ${userEmail}`)
  }

  // Remove all meetings
  await prisma.meeting.deleteMany({})

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const day = (today.getDay() + 6) % 7 // Monday=0
  const thisMonday = new Date(today)
  thisMonday.setDate(thisMonday.getDate() - day)
  const prevMonday = new Date(thisMonday)
  prevMonday.setDate(prevMonday.getDate() - 7)
  const nextMonday = new Date(thisMonday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  const rand = (n: number) => Math.floor(Math.random() * n)
  const statuses = [ 'Sukces', 'Rezygnacja', undefined ] as const

  // Previous week: 3 meetings per day
  const pastCreates: any[] = []
  for (let d = 0; d < 7; d++) {
    const base = new Date(prevMonday)
    base.setDate(base.getDate() + d)
    const slots = [ [9, 0], [12, 0], [15, 0] ]
    for (let i = 0; i < slots.length; i++) {
      const [h, m] = slots[i]
      const start = setTime(base, h, m)
      const end = setTime(base, h + 1, m)
      const status = statuses[rand(statuses.length)]
      const client = await prisma.client.create({ data: {
        firstName: `Jan${d}${i}`,
        lastName: `Kowalski${d}${i}`,
        phone: `500-00${d}${i}`,
        email: `jan.${d}${i}@example.com`,
        street: `Ulica ${d}${i} / ${10 + i}`,
        city: ['Warszawa','Kraków','Gdańsk','Łódź','Poznań'][rand(5)],
        category: ['A','B','C'][rand(3)],
      }})
      pastCreates.push(prisma.meeting.create({ data: {
        attendeeId: user.id,
        scheduledAt: start,
        endsAt: end,
        location: ['U klienta','Biuro','Zdalne','Inne'][rand(4)],
        notes: `Spotkanie ${d+1}-${i+1} (poprzedni tydzień)`,
        status: status as any,
        clientId: client.id,
      }}))
    }
  }
  await Promise.all(pastCreates)

  // Next week: 8 meetings spread across the week
  const futureCreates: any[] = []
  const futureSlots = [
    { dayOffset: 0, time: [9, 30] },
    { dayOffset: 0, time: [14, 0] },
    { dayOffset: 1, time: [10, 0] },
    { dayOffset: 2, time: [13, 0] },
    { dayOffset: 3, time: [9, 0] },
    { dayOffset: 3, time: [16, 0] },
    { dayOffset: 4, time: [11, 0] },
    { dayOffset: 5, time: [15, 30] },
  ]
  for (let idx = 0; idx < futureSlots.length; idx++) {
    const slot = futureSlots[idx]
    const base = new Date(nextMonday)
    base.setDate(base.getDate() + slot.dayOffset)
    const start = setTime(base, slot.time[0], slot.time[1])
    const end = setTime(base, slot.time[0] + 1, slot.time[1])
    const client = await prisma.client.create({ data: {
      firstName: `Anna${idx}`,
      lastName: `Nowak${idx}`,
      phone: `600-10${idx}0`,
      email: `anna.${idx}@example.com`,
      street: `Przykładowa ${idx}`,
      city: ['Warszawa','Kraków','Gdańsk','Łódź','Poznań'][rand(5)],
      category: ['A','B','C'][rand(3)],
    }})
    futureCreates.push(prisma.meeting.create({ data: {
      attendeeId: user.id,
      scheduledAt: start,
      endsAt: end,
      location: ['U klienta','Biuro','Zdalne','Inne'][rand(4)],
      notes: `Spotkanie przyszłe ${idx+1}`,
      clientId: client.id,
    }}))
  }
  await Promise.all(futureCreates)

  console.log('Wyczyszczono i dodano przykładowe spotkania')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})


