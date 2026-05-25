import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'day_book'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build date range
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    const startDate = dateFrom ? new Date(dateFrom + 'T00:00:00.000Z') : todayStart
    const endDate = dateTo ? new Date(dateTo + 'T23:59:59.999Z') : todayEnd

    switch (type) {
      case 'day_book':
        return handleDayBook(startDate, endDate)
      case 'cash_book':
        return handleCashBook(req, startDate, endDate)
      case 'trial_balance':
        return handleTrialBalance(startDate, endDate)
      case 'profit_loss':
        return handleProfitLoss(startDate, endDate)
      case 'balance_sheet':
        return handleBalanceSheet()
      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Accounting API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Day Book ────────────────────────────────────────────────────────────────

async function handleDayBook(startDate: Date, endDate: Date) {
  // Get today's day book entries
  const dayBooks = await db.dayBook.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    include: { counter: { select: { name: true, code: true } } },
    orderBy: { openedAt: 'asc' },
  })

  // Get completed sales invoices grouped by payment mode
  const salesInvoices = await db.salesInvoice.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'completed',
    },
    select: {
      id: true,
      invoiceNo: true,
      date: true,
      totalAmount: true,
      paymentMode: true,
      gstAmount: true,
      discount: true,
      customer: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })

  // Get returned invoices
  const returnedInvoices = await db.salesInvoice.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'returned',
    },
    select: {
      id: true,
      invoiceNo: true,
      date: true,
      totalAmount: true,
      returnAmount: true,
      customer: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })

  // Get payments
  const payments = await db.payment.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      invoice: {
        select: { invoiceNo: true, customer: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Get expenses
  const expenses = await db.expense.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  })

  // Get purchases
  const purchases = await db.purchaseOrder.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: { in: ['received', 'partial'] },
    },
    select: {
      id: true,
      invoiceNo: true,
      date: true,
      totalAmount: true,
      paymentMode: true,
      paymentStatus: true,
      supplier: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })

  // Calculate totals
  const totalCashSales = salesInvoices
    .filter(i => i.paymentMode === 'cash')
    .reduce((s, i) => s + i.totalAmount, 0)

  const totalCardSales = salesInvoices
    .filter(i => i.paymentMode === 'card')
    .reduce((s, i) => s + i.totalAmount, 0)

  const totalUPISales = salesInvoices
    .filter(i => i.paymentMode === 'upi')
    .reduce((s, i) => s + i.totalAmount, 0)

  const totalSales = salesInvoices.reduce((s, i) => s + i.totalAmount, 0)
  const totalReturns = returnedInvoices.reduce((s, i) => s + (i.returnAmount || i.totalAmount), 0)
  const totalPurchases = purchases.reduce((s, i) => s + i.totalAmount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  // Opening balances from day book
  let openingCash = 0
  let openingCard = 0
  let openingUPI = 0

  const openDayBook = dayBooks.find(db => db.status === 'open')
  if (openDayBook) {
    openingCash = openDayBook.openingCash
    openingCard = openDayBook.openingCard
    openingUPI = openDayBook.openingUPI
  }

  // Closing balances
  const closingCash = openingCash + totalCashSales - totalExpenses
  const closingCard = openingCard + totalCardSales
  const closingUPI = openingUPI + totalUPISales

  // Expected cash
  const expectedCash = closingCash

  // Build entries list
  const entries: Array<{
    id: string
    time: string
    type: string
    description: string
    mode: string
    debit: number
    credit: number
    balance: number
  }> = []

  let runningCash = openingCash

  // Add opening entry
  if (openDayBook) {
    entries.push({
      id: 'opening',
      time: openDayBook.openedAt.toISOString(),
      type: 'Opening',
      description: 'Day opened — Counter: ' + openDayBook.counter.name,
      mode: 'cash',
      debit: openingCash,
      credit: 0,
      balance: runningCash,
    })
  }

  // Sales entries
  for (const sale of salesInvoices) {
    runningCash += sale.paymentMode === 'cash' ? sale.totalAmount : 0
    entries.push({
      id: sale.id,
      time: sale.date.toISOString(),
      type: 'Sale',
      description: 'Invoice ' + sale.invoiceNo + (sale.customer ? ' — ' + sale.customer.name : ''),
      mode: sale.paymentMode,
      debit: sale.totalAmount,
      credit: 0,
      balance: runningCash,
    })
  }

  // Return entries
  for (const ret of returnedInvoices) {
    const retAmt = ret.returnAmount || ret.totalAmount
    runningCash -= retAmt
    entries.push({
      id: ret.id,
      time: ret.date.toISOString(),
      type: 'Return',
      description: 'Return ' + ret.invoiceNo + (ret.customer ? ' — ' + ret.customer.name : ''),
      mode: 'cash',
      debit: 0,
      credit: retAmt,
      balance: runningCash,
    })
  }

  // Purchase entries
  for (const po of purchases) {
    runningCash -= po.totalAmount
    entries.push({
      id: po.id,
      time: po.date.toISOString(),
      type: 'Purchase',
      description: 'PO ' + po.invoiceNo + ' — ' + po.supplier.name,
      mode: po.paymentMode || 'cash',
      debit: 0,
      credit: po.totalAmount,
      balance: runningCash,
    })
  }

  // Expense entries
  for (const exp of expenses) {
    runningCash -= exp.amount
    entries.push({
      id: exp.id,
      time: exp.date.toISOString(),
      type: 'Expense',
      description: exp.category + (exp.description ? ' — ' + exp.description : ''),
      mode: exp.paymentMode,
      debit: 0,
      credit: exp.amount,
      balance: runningCash,
    })
  }

  const dayBookSummary = dayBooks.length > 0 ? dayBooks[dayBooks.length - 1] : null

  return NextResponse.json({
    openingCash,
    openingCard,
    openingUPI,
    totalCashSales,
    totalCardSales,
    totalUPISales,
    totalSales,
    totalPurchases,
    totalReturns,
    totalExpenses,
    closingCash: dayBookSummary?.closingCash ?? closingCash,
    closingCard: dayBookSummary?.closingCard ?? closingCard,
    closingUPI: dayBookSummary?.closingUPI ?? closingUPI,
    difference: dayBookSummary?.difference ?? 0,
    dayBookId: dayBookSummary?.id ?? null,
    dayBookStatus: dayBookSummary?.status ?? 'not_opened',
    counters: dayBooks.map(d => ({ id: d.id, counterName: d.counter.name, status: d.status })),
    entries,
  })
}

// ─── Cash Book ───────────────────────────────────────────────────────────────

async function handleCashBook(req: NextRequest, startDate: Date, endDate: Date) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')

  // Get all cash-related transactions for the date range
  // 1. Cash sales
  const cashSales = await db.salesInvoice.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'completed',
      paymentMode: 'cash',
    },
    select: {
      id: true,
      date: true,
      invoiceNo: true,
      totalAmount: true,
      customer: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })

  // 2. Cash returns
  const cashReturns = await db.salesInvoice.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'returned',
    },
    select: {
      id: true,
      date: true,
      invoiceNo: true,
      returnAmount: true,
      totalAmount: true,
      customer: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })

  // 3. Cash payments (received from customers)
  const cashPayments = await db.payment.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      mode: 'cash',
    },
    include: {
      invoice: {
        select: { invoiceNo: true, customer: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 4. Cash expenses
  const cashExpenses = await db.expense.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      paymentMode: 'cash',
    },
    orderBy: { date: 'asc' },
  })

  // 5. Cash purchases
  const cashPurchases = await db.purchaseOrder.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: { in: ['received', 'partial'] },
      paymentMode: 'cash',
    },
    select: {
      id: true,
      date: true,
      invoiceNo: true,
      totalAmount: true,
      supplier: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })

  // Get opening balance (from day book or calculate from previous transactions)
  const openDayBook = await db.dayBook.findFirst({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'open',
    },
    orderBy: { openedAt: 'desc' },
  })
  const openingBalance = openDayBook?.openingCash ?? 0

  // Merge all transactions into a single list
  type CashEntry = {
    date: string
    type: string
    description: string
    debit: number
    credit: number
    balance: number
  }

  const allEntries: CashEntry[] = []
  let runningBalance = openingBalance

  // Cash sales
  for (const s of cashSales) {
    runningBalance += s.totalAmount
    allEntries.push({
      date: s.date.toISOString(),
      type: 'Sale',
      description: 'Inv ' + s.invoiceNo + (s.customer ? ' — ' + s.customer.name : ''),
      debit: s.totalAmount,
      credit: 0,
      balance: runningBalance,
    })
  }

  // Cash returns
  for (const r of cashReturns) {
    const amt = r.returnAmount || r.totalAmount
    runningBalance -= amt
    allEntries.push({
      date: r.date.toISOString(),
      type: 'Return',
      description: 'Return ' + r.invoiceNo,
      debit: 0,
      credit: amt,
      balance: runningBalance,
    })
  }

  // Cash purchases
  for (const p of cashPurchases) {
    runningBalance -= p.totalAmount
    allEntries.push({
      date: p.date.toISOString(),
      type: 'Purchase',
      description: 'PO ' + p.invoiceNo + ' — ' + p.supplier.name,
      debit: 0,
      credit: p.totalAmount,
      balance: runningBalance,
    })
  }

  // Cash expenses
  for (const e of cashExpenses) {
    runningBalance -= e.amount
    allEntries.push({
      date: e.date.toISOString(),
      type: 'Expense',
      description: e.category + (e.description ? ' — ' + e.description : ''),
      debit: 0,
      credit: e.amount,
      balance: runningBalance,
    })
  }

  // Sort by date
  allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Recalculate running balance after sorting
  runningBalance = openingBalance
  for (const entry of allEntries) {
    runningBalance += entry.debit - entry.credit
    entry.balance = runningBalance
  }

  // Paginate
  const total = allEntries.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const skip = (page - 1) * limit
  const paginatedEntries = allEntries.slice(skip, skip + limit)

  return NextResponse.json({
    openingBalance,
    closingBalance: allEntries.length > 0 ? allEntries[allEntries.length - 1].balance : openingBalance,
    totalDebits: allEntries.reduce((s, e) => s + e.debit, 0),
    totalCredits: allEntries.reduce((s, e) => s + e.credit, 0),
    entries: paginatedEntries,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  })
}

// ─── Trial Balance ───────────────────────────────────────────────────────────

async function handleTrialBalance(startDate: Date, endDate: Date) {
  const accounts: Array<{ name: string; debit: number; credit: number; type: string }> = []

  // 1. Sales Revenue (Credit)
  const salesData = await db.salesInvoice.aggregate({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'completed',
    },
    _sum: { totalAmount: true, gstAmount: true, discount: true },
  })
  const salesTotal = salesData._sum.totalAmount || 0
  const salesGst = salesData._sum.gstAmount || 0

  accounts.push({ name: 'Sales Revenue', debit: 0, credit: salesTotal - salesGst, type: 'Revenue' })
  accounts.push({ name: 'GST Collected (Output)', debit: 0, credit: salesGst, type: 'Liability' })
  accounts.push({ name: 'Sales Discount Given', debit: salesData._sum.discount || 0, credit: 0, type: 'Expense' })

  // 2. Purchase Cost (Debit)
  const purchaseData = await db.purchaseOrder.aggregate({
    where: {
      date: { gte: startDate, lte: endDate },
      status: { in: ['received', 'partial'] },
    },
    _sum: { totalAmount: true, gstAmount: true, discount: true },
  })
  const purchaseTotal = purchaseData._sum.totalAmount || 0
  const purchaseGst = purchaseData._sum.gstAmount || 0

  accounts.push({ name: 'Purchase Cost', debit: purchaseTotal - purchaseGst, credit: 0, type: 'Expense' })
  accounts.push({ name: 'GST Paid (Input)', debit: purchaseGst, credit: 0, type: 'Asset' })
  accounts.push({ name: 'Purchase Discount Received', debit: 0, credit: purchaseData._sum.discount || 0, type: 'Revenue' })

  // 3. Sales Returns (Debit)
  const returnData = await db.salesInvoice.aggregate({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'returned',
    },
    _sum: { totalAmount: true, returnAmount: true },
  })
  accounts.push({ name: 'Sales Returns', debit: returnData._sum.returnAmount || returnData._sum.totalAmount || 0, credit: 0, type: 'Expense' })

  // 4. Expenses (Debit)
  const expenseByCategory = await db.expense.groupBy({
    by: ['category'],
    where: {
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  })
  for (const exp of expenseByCategory) {
    accounts.push({ name: 'Expense: ' + exp.category, debit: exp._sum.amount || 0, credit: 0, type: 'Expense' })
  }

  // 5. Customer Balances (Debit — Receivables)
  const customerBalances = await db.customer.aggregate({
    where: { balance: { gt: 0 } },
    _sum: { balance: true },
  })
  accounts.push({ name: 'Sundry Debtors (Receivables)', debit: customerBalances._sum.balance || 0, credit: 0, type: 'Asset' })

  // 6. Supplier Balances (Credit — Payables)
  const supplierBalances = await db.supplier.aggregate({
    where: { balance: { gt: 0 } },
    _sum: { balance: true },
  })
  accounts.push({ name: 'Sundry Creditors (Payables)', debit: 0, credit: supplierBalances._sum.balance || 0, type: 'Liability' })

  // 7. Inventory Value (Debit) — calculated per batch
  const allBatches = await db.medicineBatch.findMany({
    where: { currentStock: { gt: 0 } },
    select: { currentStock: true, costPrice: true },
  })
  const inventoryTotal = allBatches.reduce((s, b) => s + b.currentStock * b.costPrice, 0)
  accounts.push({ name: 'Inventory (Stock)', debit: inventoryTotal, credit: 0, type: 'Asset' })

  // 8. Cash Balance (Debit)
  const dayBook = await db.dayBook.findFirst({
    where: { date: { gte: startDate, lte: endDate }, status: 'open' },
    orderBy: { openedAt: 'desc' },
  })
  const cashBalance = dayBook?.openingCash ?? 0
  accounts.push({ name: 'Cash in Hand', debit: cashBalance, credit: 0, type: 'Asset' })

  // Calculate totals
  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0)
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0)
  const difference = Math.abs(totalDebit - totalCredit)

  return NextResponse.json({
    accounts,
    totalDebit,
    totalCredit,
    difference,
    dateRange: { from: startDate.toISOString(), to: endDate.toISOString() },
  })
}

// ─── Profit & Loss ───────────────────────────────────────────────────────────

async function handleProfitLoss(startDate: Date, endDate: Date) {
  // Revenue
  const salesData = await db.salesInvoice.aggregate({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'completed',
    },
    _sum: { totalAmount: true, gstAmount: true },
  })
  const grossRevenue = salesData._sum.totalAmount || 0
  const gstCollected = salesData._sum.gstAmount || 0
  const netRevenue = grossRevenue - gstCollected

  // Returns
  const returnData = await db.salesInvoice.aggregate({
    where: {
      date: { gte: startDate, lte: endDate },
      status: 'returned',
    },
    _sum: { totalAmount: true, returnAmount: true },
  })
  const totalReturns = returnData._sum.returnAmount || returnData._sum.totalAmount || 0

  // Cost of Goods (from purchase orders)
  const purchaseData = await db.purchaseOrder.aggregate({
    where: {
      date: { gte: startDate, lte: endDate },
      status: { in: ['received', 'partial'] },
    },
    _sum: { totalAmount: true, gstAmount: true },
  })
  const costOfGoods = (purchaseData._sum.totalAmount || 0) - (purchaseData._sum.gstAmount || 0)

  // Expenses
  const expenseTotal = await db.expense.aggregate({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  })

  // Expense breakdown by category
  const expenseByCategory = await db.expense.groupBy({
    by: ['category'],
    where: { date: { gte: startDate, lte: endDate } },
    _sum: { amount: true },
  })

  const totalExpenses = expenseTotal._sum.amount || 0
  const totalCost = costOfGoods + totalExpenses

  const adjustedRevenue = netRevenue - totalReturns
  const grossProfit = adjustedRevenue - costOfGoods
  const netProfit = adjustedRevenue - totalCost
  const profitMargin = adjustedRevenue > 0 ? ((netProfit / adjustedRevenue) * 100) : 0

  return NextResponse.json({
    revenue: {
      grossRevenue,
      gstCollected,
      netRevenue,
      totalReturns,
      adjustedRevenue,
    },
    cost: {
      costOfGoods,
      expenses: expenseByCategory.map(e => ({ category: e.category, amount: e._sum.amount || 0 })),
      totalExpenses,
      totalCost,
    },
    profit: {
      grossProfit,
      netProfit,
      profitMargin: Math.round(profitMargin * 100) / 100,
    },
    dateRange: { from: startDate.toISOString(), to: endDate.toISOString() },
  })
}

// ─── Balance Sheet ───────────────────────────────────────────────────────────

async function handleBalanceSheet() {
  // Assets
  // Cash
  const dayBook = await db.dayBook.findFirst({
    where: { status: 'open' },
    orderBy: { openedAt: 'desc' },
  })
  const cash = dayBook?.openingCash ?? 0

  // Inventory
  const allBatches = await db.medicineBatch.findMany({
    where: { currentStock: { gt: 0 } },
    select: { currentStock: true, costPrice: true },
  })
  const inventory = allBatches.reduce((s, b) => s + b.currentStock * b.costPrice, 0)

  // Receivables
  const receivables = await db.customer.aggregate({
    where: { balance: { gt: 0 } },
    _sum: { balance: true },
  })
  const receivablesTotal = receivables._sum.balance || 0

  // Bank (card payments — simplified as bank balance)
  const cardPayments = await db.salesInvoice.aggregate({
    where: { status: 'completed', paymentMode: 'card' },
    _sum: { totalAmount: true },
  })
  const upiPayments = await db.salesInvoice.aggregate({
    where: { status: 'completed', paymentMode: 'upi' },
    _sum: { totalAmount: true },
  })
  const bank = (cardPayments._sum.totalAmount || 0) + (upiPayments._sum.totalAmount || 0)

  const totalAssets = cash + bank + receivablesTotal + inventory

  // Liabilities
  const payables = await db.supplier.aggregate({
    where: { balance: { gt: 0 } },
    _sum: { balance: true },
  })
  const payablesTotal = payables._sum.balance || 0

  // GST liability
  const gstOutput = await db.salesInvoice.aggregate({
    where: { status: 'completed' },
    _sum: { gstAmount: true },
  })
  const gstInput = await db.purchaseOrder.aggregate({
    where: { status: { in: ['received', 'partial'] } },
    _sum: { gstAmount: true },
  })
  const gstLiability = (gstOutput._sum.gstAmount || 0) - (gstInput._sum.gstAmount || 0)

  // Loans (simulated — no loan model, so set to 0)
  const loans = 0
  const totalLiabilities = payablesTotal + Math.max(0, gstLiability) + loans

  // Capital
  const ownerEquity = totalAssets - totalLiabilities
  const retainedEarnings = 0 // Simplified

  return NextResponse.json({
    assets: {
      cash,
      bank,
      receivables: receivablesTotal,
      inventory,
    },
    liabilities: {
      payables: payablesTotal,
      gstLiability: Math.max(0, gstLiability),
      loans,
    },
    capital: {
      ownerEquity: Math.max(0, ownerEquity),
      retainedEarnings,
    },
    totalAssets,
    totalLiabilities,
  })
}
