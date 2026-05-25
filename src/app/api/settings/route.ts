import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'

// ─── Simple in-memory store for settings (no DB table needed) ───
const settingsCache: Record<string, Record<string, unknown>> = {
  store_profile: {
    storeName: 'PharmaCare Medical Store',
    address: '123 Main Street, City',
    phone: '+91 98765 43210',
    email: 'info@pharmacare.com',
    gstNo: '29AABCU9603R1ZM',
    drugLicenseNo: 'DL-2024-001234',
    pharmacyRegNo: 'PR-2024-005678',
  },
  tax_settings: {
    defaultGstRate: '5',
    gstCalculationMode: 'exclusive',
    roundOffMode: 'nearest',
  },
  print_settings: {
    invoiceFormat: 'a4',
    showLogo: 'true',
    showGstBreakup: 'true',
    showTerms: 'true',
    termsText: 'Goods once sold will not be returned. Keep bill for warranty.',
    copies: '2',
  },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    switch (type) {
      case 'store_profile':
        return NextResponse.json(settingsCache.store_profile)

      case 'tax_settings':
        return NextResponse.json(settingsCache.tax_settings)

      case 'print_settings':
        return NextResponse.json(settingsCache.print_settings)

      case 'staff': {
        const staff = await db.staff.findMany({
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, lastLogin: true, createdAt: true },
        })
        return NextResponse.json(staff)
      }

      case 'counters': {
        const counters = await db.counter.findMany({
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, code: true, isActive: true, createdAt: true },
        })
        return NextResponse.json(counters)
      }

      case 'day_status': {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const openDay = await db.dayBook.findFirst({
          where: { date: { gte: today }, status: 'open' },
          orderBy: { openedAt: 'desc' },
        })
        return NextResponse.json({
          isOpen: !!openDay,
          dayBook: openDay ? {
            id: openDay.id,
            counter: openDay.counterId,
            openingCash: openDay.openingCash,
            totalSales: openDay.totalSales,
            actualCash: openDay.actualCash,
            difference: openDay.difference,
            openedAt: openDay.openedAt,
          } : null,
        })
      }

      case 'day_history': {
        const history = await db.dayBook.findMany({
          orderBy: { openedAt: 'desc' },
          take: 20,
          include: { counter: { select: { name: true, code: true } } },
        })
        return NextResponse.json(history.map(h => ({
          id: h.id,
          counter: h.counter?.name || 'Unknown',
          date: h.date,
          openingCash: h.openingCash,
          totalSales: h.totalSales,
          actualCash: h.actualCash,
          difference: h.difference,
          status: h.status,
          openedAt: h.openedAt,
          closedAt: h.closedAt,
        })))
      }

      default:
        return NextResponse.json({ error: 'Unknown settings type' }, { status: 400 })
    }
  } catch (error) {
    console.error(`Settings GET [${type}]:`, error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    switch (type) {
      case 'staff': {
        const body = await req.json()
        const { name, email, phone, role, password } = body

        if (!name || !password) {
          return NextResponse.json({ error: 'Name and password are required' }, { status: 400 })
        }

        const hashedPassword = await hash(password, 10)

        const staff = await db.staff.create({
          data: {
            name,
            email: email || null,
            phone: phone || null,
            role: role || 'salesman',
            password: hashedPassword,
          },
        })

        return NextResponse.json({
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          isActive: staff.isActive,
          lastLogin: staff.lastLogin,
          createdAt: staff.createdAt,
        }, { status: 201 })
      }

      case 'counters': {
        const body = await req.json()
        const { name, code } = body

        if (!name || !code) {
          return NextResponse.json({ error: 'Name and code are required' }, { status: 400 })
        }

        const counter = await db.counter.create({
          data: { name, code },
        })

        return NextResponse.json({
          id: counter.id,
          name: counter.name,
          code: counter.code,
          isActive: counter.isActive,
          createdAt: counter.createdAt,
        }, { status: 201 })
      }

      case 'open_day': {
        const body = await req.json()
        const { counterId, openingCash, openingCard, openingUPI, openedBy } = body

        // Check if there's already an open day
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const existing = await db.dayBook.findFirst({
          where: { date: { gte: today }, status: 'open' },
        })
        if (existing) {
          return NextResponse.json({ error: 'Day is already open', dayBook: existing }, { status: 409 })
        }

        const dayBook = await db.dayBook.create({
          data: {
            counterId: counterId || 'default',
            date: new Date(),
            openingCash: openingCash || 0,
            openingCard: openingCard || 0,
            openingUPI: openingUPI || 0,
            openedBy: openedBy || 'Admin',
          },
        })

        return NextResponse.json({ success: true, dayBook: { id: dayBook.id, openedAt: dayBook.openedAt } }, { status: 201 })
      }

      case 'close_day': {
        const body = await req.json()
        const { id, actualCash, actualCard, actualUPI, closedBy } = body

        const dayBook = await db.dayBook.findUnique({ where: { id } })
        if (!dayBook) {
          return NextResponse.json({ error: 'Day book not found' }, { status: 404 })
        }

        const updated = await db.dayBook.update({
          where: { id },
          data: {
            status: 'closed',
            actualCash: actualCash ?? 0,
            actualCard: actualCard ?? 0,
            actualUPI: actualUPI ?? 0,
            difference: (actualCash ?? 0) - (dayBook.openingCash + dayBook.totalCashSales),
            closedBy: closedBy || 'Admin',
            closedAt: new Date(),
          },
        })

        return NextResponse.json({ success: true, dayBook: { id: updated.id, closedAt: updated.closedAt } })
      }

      default:
        return NextResponse.json({ error: 'Unknown settings type' }, { status: 400 })
    }
  } catch (error) {
    console.error(`Settings POST [${type}]:`, error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    switch (type) {
      case 'store_profile': {
        const body = await req.json()
        settingsCache.store_profile = { ...settingsCache.store_profile, ...body }
        return NextResponse.json({ success: true })
      }

      case 'tax_settings': {
        const body = await req.json()
        settingsCache.tax_settings = { ...settingsCache.tax_settings, ...body }
        return NextResponse.json({ success: true })
      }

      case 'print_settings': {
        const body = await req.json()
        settingsCache.print_settings = { ...settingsCache.print_settings, ...body }
        return NextResponse.json({ success: true })
      }

      case 'staff': {
        const body = await req.json()
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 })

        const data: Record<string, unknown> = {}
        if (body.name) data.name = body.name
        if (body.email !== undefined) data.email = body.email || null
        if (body.phone !== undefined) data.phone = body.phone || null
        if (body.role) data.role = body.role
        if (body.password) data.password = await hash(body.password, 10)

        const staff = await db.staff.update({
          where: { id },
          data,
        })

        return NextResponse.json({
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          isActive: staff.isActive,
          lastLogin: staff.lastLogin,
          createdAt: staff.createdAt,
        })
      }

      case 'counters': {
        const body = await req.json()
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'Counter ID required' }, { status: 400 })

        const counter = await db.counter.update({
          where: { id },
          data: {
            ...(body.name && { name: body.name }),
            ...(body.code && { code: body.code }),
          },
        })

        return NextResponse.json({
          id: counter.id,
          name: counter.name,
          code: counter.code,
          isActive: counter.isActive,
          createdAt: counter.createdAt,
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown settings type' }, { status: 400 })
    }
  } catch (error) {
    console.error(`Settings PUT [${type}]:`, error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const id = searchParams.get('id')

  try {
    switch (type) {
      case 'staff': {
        if (!id) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 })
        const body = await req.json()

        const staff = await db.staff.update({
          where: { id },
          data: { isActive: body.isActive },
        })

        return NextResponse.json({
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          isActive: staff.isActive,
          lastLogin: staff.lastLogin,
          createdAt: staff.createdAt,
        })
      }

      case 'counters': {
        if (!id) return NextResponse.json({ error: 'Counter ID required' }, { status: 400 })
        const body = await req.json()

        const counter = await db.counter.update({
          where: { id },
          data: { isActive: body.isActive },
        })

        return NextResponse.json({
          id: counter.id,
          name: counter.name,
          code: counter.code,
          isActive: counter.isActive,
          createdAt: counter.createdAt,
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown settings type' }, { status: 400 })
    }
  } catch (error) {
    console.error(`Settings PATCH [${type}]:`, error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const id = searchParams.get('id')

  try {
    switch (type) {
      case 'staff': {
        if (!id) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 })
        await db.staff.delete({ where: { id } })
        return NextResponse.json({ success: true })
      }

      case 'counters': {
        if (!id) return NextResponse.json({ error: 'Counter ID required' }, { status: 400 })
        await db.counter.delete({ where: { id } })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown settings type' }, { status: 400 })
    }
  } catch (error) {
    console.error(`Settings DELETE [${type}]:`, error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
