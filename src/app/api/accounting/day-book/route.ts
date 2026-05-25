import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST — Open a new day book for a counter
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { counterId, openingCash, openingCard, openingUPI } = body

    if (!counterId) {
      return NextResponse.json({ error: 'counterId is required' }, { status: 400 })
    }

    // Check if there's already an open day book for this counter today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const existingOpen = await db.dayBook.findFirst({
      where: {
        counterId,
        date: { gte: todayStart, lte: todayEnd },
        status: 'open',
      },
    })

    if (existingOpen) {
      return NextResponse.json(
        { error: 'Day book already open for this counter today', dayBook: existingOpen },
        { status: 409 }
      )
    }

    // Get counter details
    const counter = await db.counter.findUnique({ where: { id: counterId } })
    if (!counter) {
      return NextResponse.json({ error: 'Counter not found' }, { status: 404 })
    }

    const dayBook = await db.dayBook.create({
      data: {
        counterId,
        date: new Date(),
        openingCash: openingCash || 0,
        openingCard: openingCard || 0,
        openingUPI: openingUPI || 0,
        status: 'open',
        openedBy: 'Admin',
      },
      include: { counter: { select: { name: true, code: true } } },
    })

    return NextResponse.json({ message: 'Day book opened successfully', dayBook }, { status: 201 })
  } catch (error) {
    console.error('[DayBook POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT — Close a day book
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, actualCash } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Get the day book
    const dayBook = await db.dayBook.findUnique({
      where: { id },
      include: { counter: { select: { name: true, code: true } } },
    })

    if (!dayBook) {
      return NextResponse.json({ error: 'Day book not found' }, { status: 404 })
    }

    if (dayBook.status === 'closed') {
      return NextResponse.json({ error: 'Day book already closed' }, { status: 409 })
    }

    // Calculate today's totals
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const salesAgg = await db.salesInvoice.aggregate({
      where: {
        counterId: dayBook.counterId,
        date: { gte: todayStart, lte: todayEnd },
        status: 'completed',
      },
      _sum: { totalAmount: true },
    })
    const totalSales = salesAgg._sum.totalAmount || 0

    const cashSalesAgg = await db.salesInvoice.aggregate({
      where: {
        counterId: dayBook.counterId,
        date: { gte: todayStart, lte: todayEnd },
        status: 'completed',
        paymentMode: 'cash',
      },
      _sum: { totalAmount: true },
    })
    const totalCashSales = cashSalesAgg._sum.totalAmount || 0

    const cardSalesAgg = await db.salesInvoice.aggregate({
      where: {
        counterId: dayBook.counterId,
        date: { gte: todayStart, lte: todayEnd },
        status: 'completed',
        paymentMode: 'card',
      },
      _sum: { totalAmount: true },
    })
    const totalCardSales = cardSalesAgg._sum.totalAmount || 0

    const upiSalesAgg = await db.salesInvoice.aggregate({
      where: {
        counterId: dayBook.counterId,
        date: { gte: todayStart, lte: todayEnd },
        status: 'completed',
        paymentMode: 'upi',
      },
      _sum: { totalAmount: true },
    })
    const totalUPISales = upiSalesAgg._sum.totalAmount || 0

    // Returns
    const returnsAgg = await db.salesInvoice.aggregate({
      where: {
        counterId: dayBook.counterId,
        date: { gte: todayStart, lte: todayEnd },
        status: 'returned',
      },
      _sum: { totalAmount: true, returnAmount: true },
    })
    const totalReturns = returnsAgg._sum.returnAmount || returnsAgg._sum.totalAmount || 0

    // Expenses
    const expenseAgg = await db.expense.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd }, paymentMode: 'cash' },
      _sum: { amount: true },
    })
    const totalExpenses = expenseAgg._sum.amount || 0

    // Purchases
    const purchaseAgg = await db.purchaseOrder.aggregate({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        status: { in: ['received', 'partial'] },
        paymentMode: 'cash',
      },
      _sum: { totalAmount: true },
    })
    const totalPurchases = purchaseAgg._sum.totalAmount || 0

    const expectedCash = dayBook.openingCash + totalCashSales - totalReturns - totalExpenses - totalPurchases
    const difference = (actualCash || 0) - expectedCash

    const updated = await db.dayBook.update({
      where: { id },
      data: {
        totalCashSales,
        totalCardSales,
        totalUPISales,
        totalSales,
        totalPurchases,
        totalReturns,
        totalExpenses,
        closingCash: dayBook.openingCash + totalCashSales - totalExpenses,
        closingCard: dayBook.openingCard + totalCardSales,
        closingUPI: dayBook.openingUPI + totalUPISales,
        actualCash: actualCash || 0,
        difference,
        status: 'closed',
        closedBy: 'Admin',
        closedAt: new Date(),
      },
      include: { counter: { select: { name: true, code: true } } },
    })

    return NextResponse.json({ message: 'Day book closed successfully', dayBook: updated })
  } catch (error) {
    console.error('[DayBook PUT] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
