'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, DollarSign, Wallet, CreditCard, Smartphone,
  TrendingUp, TrendingDown, RefreshCw, ChevronLeft, ChevronRight,
  CalendarDays, X, AlertTriangle, CheckCircle, FileText,
  ArrowUpRight, ArrowDownRight, Scale, BarChart3, Landmark,
  Receipt, ShoppingBag, RotateCcw, Banknote,
} from 'lucide-react'
import { toast } from 'sonner'

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface DayBookData {
  openingCash: number
  openingCard: number
  openingUPI: number
  totalCashSales: number
  totalCardSales: number
  totalUPISales: number
  totalSales: number
  totalPurchases: number
  totalReturns: number
  totalExpenses: number
  closingCash: number
  closingCard: number
  closingUPI: number
  difference: number
  dayBookId: string | null
  dayBookStatus: string
  counters: { id: string; counterName: string; status: string }[]
  entries: DayBookEntry[]
}

interface DayBookEntry {
  id: string
  time: string
  type: string
  description: string
  mode: string
  debit: number
  credit: number
  balance: number
}

interface CashBookData {
  openingBalance: number
  closingBalance: number
  totalDebits: number
  totalCredits: number
  entries: CashBookEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface CashBookEntry {
  date: string
  type: string
  description: string
  debit: number
  credit: number
  balance: number
}

interface TrialBalanceData {
  accounts: { name: string; debit: number; credit: number; type: string }[]
  totalDebit: number
  totalCredit: number
  difference: number
}

interface ProfitLossData {
  revenue: {
    grossRevenue: number
    gstCollected: number
    netRevenue: number
    totalReturns: number
    adjustedRevenue: number
  }
  cost: {
    costOfGoods: number
    expenses: { category: string; amount: number }[]
    totalExpenses: number
    totalCost: number
  }
  profit: {
    grossProfit: number
    netProfit: number
    profitMargin: number
  }
}

interface BalanceSheetData {
  assets: {
    cash: number
    bank: number
    receivables: number
    inventory: number
  }
  liabilities: {
    payables: number
    gstLiability: number
    loans: number
  }
  capital: {
    ownerEquity: number
    retainedEarnings: number
  }
  totalAssets: number
  totalLiabilities: number
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function formatINR(val: number) {
  if (val >= 10000000) return '\u20B9' + (val / 10000000).toFixed(2) + ' Cr'
  if (val >= 100000) return '\u20B9' + (val / 100000).toFixed(2) + ' L'
  if (val >= 1000) return '\u20B9' + (val / 1000).toFixed(1) + 'K'
  return '\u20B9' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatINRFull(val: number) {
  return '\u20B9' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

function formatDateTime(iso: string) {
  return formatDate(iso) + ' ' + formatTime(iso)
}

function getTodayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function getMonthStartStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'
}

function typeBadge(type: string) {
  switch (type) {
    case 'Sale': return <span className="marg-badge marg-badge-green">Sale</span>
    case 'Return': return <span className="marg-badge marg-badge-red">Return</span>
    case 'Purchase': return <span className="marg-badge marg-badge-orange">Purchase</span>
    case 'Expense': return <span className="marg-badge marg-badge-red">Expense</span>
    case 'Opening': return <span className="marg-badge marg-badge-blue">Opening</span>
    default: return <span className="marg-badge marg-badge-blue">{type}</span>
  }
}

function modeBadge(mode: string) {
  switch (mode) {
    case 'cash': return <span className="marg-badge marg-badge-green">CASH</span>
    case 'card': return <span className="marg-badge marg-badge-blue">CARD</span>
    case 'upi': return <span className="marg-badge marg-badge-orange">UPI</span>
    default: return <span className="marg-badge">{mode.toUpperCase()}</span>
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Tab definitions
   ═══════════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'day_book', label: 'Day Book' },
  { key: 'cash_book', label: 'Cash Book' },
  { key: 'trial_balance', label: 'Trial Balance' },
  { key: 'profit_loss', label: 'Profit & Loss' },
  { key: 'balance_sheet', label: 'Balance Sheet' },
] as const

type TabKey = (typeof TABS)[number]['key']

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

export default function AccountingModule() {
  const [activeTab, setActiveTab] = useState<TabKey>('day_book')
  const [loading, setLoading] = useState(true)

  // Day Book state
  const [dayBook, setDayBook] = useState<DayBookData | null>(null)
  const [openDialog, setOpenDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const [counters, setCounters] = useState<{ id: string; name: string }[]>([])
  const [selectedCounter, setSelectedCounter] = useState('')
  const [openCash, setOpenCash] = useState('')
  const [openCard, setOpenCard] = useState('')
  const [openUPI, setOpenUPI] = useState('')
  const [actualCash, setActualCash] = useState('')
  const [saving, setSaving] = useState(false)

  // Cash Book state
  const [cashBook, setCashBook] = useState<CashBookData | null>(null)
  const [cashBookPage, setCashBookPage] = useState(1)

  // Date filters
  const [dateFrom, setDateFrom] = useState(getMonthStartStr())
  const [dateTo, setDateTo] = useState(getTodayStr())

  // Profit & Loss / Balance Sheet state
  const [trialBalance, setTrialBalance] = useState<TrialBalanceData | null>(null)
  const [profitLoss, setProfitLoss] = useState<ProfitLossData | null>(null)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null)

  // ─── Fetch Day Book ──────────────────────────────────────────────
  const fetchDayBook = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'day_book' })
      const res = await fetch('/api/accounting?' + params)
      if (res.ok) {
        const data = await res.json()
        setDayBook(data)
      } else {
        toast.error('Failed to load day book')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Fetch Cash Book ─────────────────────────────────────────────
  const fetchCashBook = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'cash_book',
        dateFrom,
        dateTo,
        page: String(cashBookPage),
        limit: '50',
      })
      const res = await fetch('/api/accounting?' + params)
      if (res.ok) {
        const data = await res.json()
        setCashBook(data)
      } else {
        toast.error('Failed to load cash book')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, cashBookPage])

  // ─── Fetch Trial Balance ────────────────────────────────────────
  const fetchTrialBalance = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'trial_balance',
        dateFrom,
        dateTo,
      })
      const res = await fetch('/api/accounting?' + params)
      if (res.ok) {
        const data = await res.json()
        setTrialBalance(data)
      } else {
        toast.error('Failed to load trial balance')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  // ─── Fetch Profit & Loss ────────────────────────────────────────
  const fetchProfitLoss = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: 'profit_loss',
        dateFrom,
        dateTo,
      })
      const res = await fetch('/api/accounting?' + params)
      if (res.ok) {
        const data = await res.json()
        setProfitLoss(data)
      } else {
        toast.error('Failed to load P&L')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  // ─── Fetch Balance Sheet ────────────────────────────────────────
  const fetchBalanceSheet = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'balance_sheet' })
      const res = await fetch('/api/accounting?' + params)
      if (res.ok) {
        const data = await res.json()
        setBalanceSheet(data)
      } else {
        toast.error('Failed to load balance sheet')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── Fetch Counters ─────────────────────────────────────────────
  const fetchCounters = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        // We'll get counters from day book data
      }
    } catch {
      // silent
    }
  }, [])

  // ─── Tab Change Handler ─────────────────────────────────────────
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
    switch (tab) {
      case 'day_book': fetchDayBook(); break
      case 'cash_book': setCashBookPage(1); break
      case 'trial_balance': fetchTrialBalance(); break
      case 'profit_loss': fetchProfitLoss(); break
      case 'balance_sheet': fetchBalanceSheet(); break
    }
  }

  // ─── Effects ────────────────────────────────────────────────────
  useEffect(() => {
    fetchDayBook()
    fetchCounters()
  }, [fetchDayBook, fetchCounters])

  useEffect(() => {
    if (activeTab === 'cash_book') fetchCashBook()
  }, [activeTab, fetchCashBook])

  // ─── Open Day Book ──────────────────────────────────────────────
  const handleOpenDay = async () => {
    if (!selectedCounter) {
      toast.error('Please select a counter')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/accounting/day-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterId: selectedCounter,
          openingCash: parseFloat(openCash) || 0,
          openingCard: parseFloat(openCard) || 0,
          openingUPI: parseFloat(openUPI) || 0,
        }),
      })
      if (res.ok) {
        toast.success('Day book opened successfully')
        setOpenDialog(false)
        fetchDayBook()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to open day book')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Close Day Book ─────────────────────────────────────────────
  const handleCloseDay = async () => {
    if (!dayBook?.dayBookId) {
      toast.error('No open day book found')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/accounting/day-book', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dayBook.dayBookId,
          actualCash: parseFloat(actualCash) || 0,
        }),
      })
      if (res.ok) {
        toast.success('Day book closed successfully')
        setCloseDialog(false)
        fetchDayBook()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to close day book')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Refresh ────────────────────────────────────────────────────
  const handleRefresh = () => {
    switch (activeTab) {
      case 'day_book': fetchDayBook(); break
      case 'cash_book': fetchCashBook(); break
      case 'trial_balance': fetchTrialBalance(); break
      case 'profit_loss': fetchProfitLoss(); break
      case 'balance_sheet': fetchBalanceSheet(); break
    }
    toast.success('Refreshed')
  }

  /* ═══════════════════════════════════════════════════════════════
     Loading State
     ═══════════════════════════════════════════════════════════════ */
  if (loading && activeTab === 'day_book' && !dayBook) {
    return (
      <div className="marg-panel" style={{ padding: '12px 16px', textAlign: 'center', color: '#808080', fontSize: '8pt' }}>
        Loading accounting data...
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0, fontSize: '8pt' }}>
      {/* ── Panel Caption ────────────────────────────────────────── */}
      <div className="marg-panel-caption">
        <span>Accounting &amp; Books</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="marg-btn marg-btn-green" onClick={handleRefresh}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Tab Strip ────────────────────────────────────────────── */}
      <div className="marg-tabstrip">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`marg-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.key === 'day_book' && <BookOpen style={{ width: 11, height: 11 }} />}
            {tab.key === 'cash_book' && <Wallet style={{ width: 11, height: 11 }} />}
            {tab.key === 'trial_balance' && <Scale style={{ width: 11, height: 11 }} />}
            {tab.key === 'profit_loss' && <BarChart3 style={{ width: 11, height: 11 }} />}
            {tab.key === 'balance_sheet' && <Landmark style={{ width: 11, height: 11 }} />}
            {' '}{tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: Day Book
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'day_book' && dayBook && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: 2 }}>
          {/* KPI Row */}
          <div style={{ display: 'flex', gap: 2 }}>
            <div className="marg-kpi" style={{ flex: 1 }}>
              <div className="marg-kpi-value" style={{ color: '#006600' }}>{formatINRFull(dayBook.openingCash)}</div>
              <div className="marg-kpi-label">
                <Banknote style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> Opening Cash
              </div>
            </div>
            <div className="marg-kpi" style={{ flex: 1 }}>
              <div className="marg-kpi-value" style={{ color: '#003366' }}>{formatINRFull(dayBook.totalCashSales)}</div>
              <div className="marg-kpi-label">
                <ArrowUpRight style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', color: '#006600' }} /> Cash Sales
              </div>
            </div>
            <div className="marg-kpi" style={{ flex: 1 }}>
              <div className="marg-kpi-value" style={{ color: '#003366' }}>{formatINRFull(dayBook.totalCardSales)}</div>
              <div className="marg-kpi-label">
                <CreditCard style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> Card Sales
              </div>
            </div>
            <div className="marg-kpi" style={{ flex: 1 }}>
              <div className="marg-kpi-value" style={{ color: '#003366' }}>{formatINRFull(dayBook.totalUPISales)}</div>
              <div className="marg-kpi-label">
                <Smartphone style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> UPI Sales
              </div>
            </div>
            <div className="marg-kpi" style={{ flex: 1 }}>
              <div className="marg-kpi-value" style={{ color: dayBook.difference !== 0 ? '#CC0000' : '#006600' }}>{formatINRFull(dayBook.closingCash)}</div>
              <div className="marg-kpi-label">
                <Wallet style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> Closing Cash
              </div>
            </div>
          </div>

          {/* Summary + Actions Row */}
          <div style={{ display: 'flex', gap: 2 }}>
            <div className="marg-panel" style={{ flex: 1 }}>
              <div className="marg-panel-caption"><span>Today&apos;s Summary</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', padding: '4px 6px', fontSize: '8pt', lineHeight: '18px' }}>
                <div><span style={{ color: '#808080' }}>Total Sales: </span><b style={{ color: '#006600' }}>{formatINRFull(dayBook.totalSales)}</b></div>
                <div><span style={{ color: '#808080' }}>Total Purchases: </span><b style={{ color: '#CC0000' }}>{formatINRFull(dayBook.totalPurchases)}</b></div>
                <div><span style={{ color: '#808080' }}>Total Returns: </span><b style={{ color: '#CC0000' }}>{formatINRFull(dayBook.totalReturns)}</b></div>
                <div><span style={{ color: '#808080' }}>Total Expenses: </span><b style={{ color: '#CC0000' }}>{formatINRFull(dayBook.totalExpenses)}</b></div>
                <div>
                  <span style={{ color: '#808080' }}>Difference: </span>
                  <b style={{ color: dayBook.difference !== 0 ? '#CC0000' : '#006600' }}>{formatINRFull(dayBook.difference)}</b>
                  {dayBook.difference !== 0 && <AlertTriangle style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', color: '#CC0000' }} />}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 140 }}>
              <button
                className="marg-btn marg-btn-green"
                style={{ height: 22, fontWeight: 700 }}
                disabled={dayBook.dayBookStatus === 'open'}
                onClick={() => { setOpenDialog(true); setOpenCash('0'); setOpenCard('0'); setOpenUPI('0') }}
              >
                <BookOpen style={{ width: 11, height: 11 }} /> Open Day
              </button>
              <button
                className="marg-btn marg-btn-red"
                style={{ height: 22, fontWeight: 700 }}
                disabled={dayBook.dayBookStatus !== 'open'}
                onClick={() => { setCloseDialog(true); setActualCash('') }}
              >
                <BookOpen style={{ width: 11, height: 11 }} /> Close Day
              </button>
              <div style={{ padding: '2px 4px', textAlign: 'center' }}>
                <span className={dayBook.dayBookStatus === 'open' ? 'marg-badge marg-badge-green' : dayBook.dayBookStatus === 'closed' ? 'marg-badge marg-badge-red' : 'marg-badge marg-badge-orange'}>
                  {dayBook.dayBookStatus === 'not_opened' ? 'NOT OPENED' : dayBook.dayBookStatus.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="marg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="marg-panel-caption">
              <span>Transactions ({dayBook.entries.length})</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {dayBook.entries.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
                  No transactions today. Open the day to begin.
                </div>
              ) : (
                <table className="marg-grid">
                  <thead>
                    <tr>
                      <th style={{ width: 55 }}>Time</th>
                      <th style={{ width: 60 }}>Type</th>
                      <th>Description</th>
                      <th style={{ width: 50 }}>Mode</th>
                      <th style={{ width: 85, textAlign: 'right' }}>Debit</th>
                      <th style={{ width: 85, textAlign: 'right' }}>Credit</th>
                      <th style={{ width: 85, textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBook.entries.map((entry, idx) => (
                      <tr key={entry.id + '-' + idx}>
                        <td style={{ fontFamily: 'monospace', fontSize: '8pt' }}>{formatTime(entry.time)}</td>
                        <td>{typeBadge(entry.type)}</td>
                        <td style={{ fontSize: '8pt', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</td>
                        <td>{modeBadge(entry.mode)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: entry.debit > 0 ? '#006600' : '#808080' }}>
                          {entry.debit > 0 ? formatINRFull(entry.debit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: entry.credit > 0 ? '#CC0000' : '#808080' }}>
                          {entry.credit > 0 ? formatINRFull(entry.credit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(entry.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#E8EEF4', fontWeight: 700 }}>
                      <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Closing Balance</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(dayBook.entries.reduce((s, e) => s + e.debit, 0))}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(dayBook.entries.reduce((s, e) => s + e.credit, 0))}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: dayBook.difference !== 0 ? '#CC0000' : '#006600' }}>
                        {dayBook.entries.length > 0 ? formatINRFull(dayBook.entries[dayBook.entries.length - 1].balance) : formatINRFull(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: Cash Book
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'cash_book' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: 2 }}>
          {/* Date Filter */}
          <div style={{ display: 'flex', gap: 4, padding: '3px 0', alignItems: 'center' }}>
            <span className="marg-label">From:</span>
            <input type="date" className="marg-input" style={{ width: 120, height: 18 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="marg-label">To:</span>
            <input type="date" className="marg-input" style={{ width: 120, height: 18 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            <button className="marg-btn marg-btn-blue" style={{ height: 18, fontSize: '7pt' }} onClick={fetchCashBook}>
              <RefreshCw style={{ width: 10, height: 10 }} /> Apply
            </button>
            {cashBook && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, fontSize: '8pt' }}>
                <span><b style={{ color: '#006600' }}>In: {formatINRFull(cashBook.totalDebits)}</b></span>
                <span><b style={{ color: '#CC0000' }}>Out: {formatINRFull(cashBook.totalCredits)}</b></span>
                <span><b>Net: {formatINRFull(cashBook.totalDebits - cashBook.totalCredits)}</b></span>
              </div>
            )}
          </div>

          {/* Summary KPIs */}
          {cashBook && (
            <div style={{ display: 'flex', gap: 2 }}>
              <div className="marg-kpi" style={{ flex: 1 }}>
                <div className="marg-kpi-value">{formatINRFull(cashBook.openingBalance)}</div>
                <div className="marg-kpi-label">Opening Balance</div>
              </div>
              <div className="marg-kpi" style={{ flex: 1 }}>
                <div className="marg-kpi-value" style={{ color: '#006600' }}>{formatINRFull(cashBook.totalDebits)}</div>
                <div className="marg-kpi-label">Total Inflow</div>
              </div>
              <div className="marg-kpi" style={{ flex: 1 }}>
                <div className="marg-kpi-value" style={{ color: '#CC0000' }}>{formatINRFull(cashBook.totalCredits)}</div>
                <div className="marg-kpi-label">Total Outflow</div>
              </div>
              <div className="marg-kpi" style={{ flex: 1 }}>
                <div className="marg-kpi-value">{formatINRFull(cashBook.closingBalance)}</div>
                <div className="marg-kpi-label">Closing Balance</div>
              </div>
            </div>
          )}

          {/* Cash Book Table */}
          <div className="marg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="marg-panel-caption">
              <span>Cash Flow Entries</span>
              {cashBook && <span style={{ fontWeight: 400, fontSize: '7pt' }}>{cashBook.pagination.total} transactions</span>}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
                  Loading...
                </div>
              ) : !cashBook || cashBook.entries.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
                  No cash transactions found for this period
                </div>
              ) : (
                <table className="marg-grid">
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Date</th>
                      <th style={{ width: 65 }}>Type</th>
                      <th>Description</th>
                      <th style={{ width: 85, textAlign: 'right' }}>Debit</th>
                      <th style={{ width: 85, textAlign: 'right' }}>Credit</th>
                      <th style={{ width: 85, textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashBook.entries.map((entry, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', fontSize: '8pt' }}>{formatDateTime(entry.date)}</td>
                        <td>{typeBadge(entry.type)}</td>
                        <td style={{ fontSize: '8pt' }}>{entry.description}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: entry.debit > 0 ? '#006600' : '#808080' }}>
                          {entry.debit > 0 ? formatINRFull(entry.debit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: entry.credit > 0 ? '#CC0000' : '#808080' }}>
                          {entry.credit > 0 ? formatINRFull(entry.credit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(entry.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Pager */}
          {cashBook && cashBook.pagination.totalPages > 1 && (
            <div className="marg-pager" style={{ marginTop: 0, justifyContent: 'space-between' }}>
              <span>
                Page {cashBook.pagination.page} of {cashBook.pagination.totalPages} ({cashBook.pagination.total} entries)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="marg-btn"
                  disabled={cashBookPage <= 1}
                  onClick={() => setCashBookPage(p => p - 1)}
                >
                  <ChevronLeft style={{ width: 12, height: 12 }} /> Prev
                </button>
                <button
                  className="marg-btn"
                  disabled={cashBookPage >= cashBook.pagination.totalPages}
                  onClick={() => setCashBookPage(p => p + 1)}
                >
                  Next <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: Trial Balance
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'trial_balance' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: 2 }}>
          {/* Date Filter */}
          <div style={{ display: 'flex', gap: 4, padding: '3px 0', alignItems: 'center' }}>
            <span className="marg-label">From:</span>
            <input type="date" className="marg-input" style={{ width: 120, height: 18 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="marg-label">To:</span>
            <input type="date" className="marg-input" style={{ width: 120, height: 18 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            <button className="marg-btn marg-btn-blue" style={{ height: 18, fontSize: '7pt' }} onClick={fetchTrialBalance}>
              <RefreshCw style={{ width: 10, height: 10 }} /> Apply
            </button>
          </div>

          <div className="marg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="marg-panel-caption">
              <span>Trial Balance</span>
              {trialBalance && (
                <span style={{ fontSize: '7pt', fontWeight: 400 }}>
                  {trialBalance.difference === 0 ? (
                    <span style={{ color: '#006600' }}>
                      <CheckCircle style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> Balanced
                    </span>
                  ) : (
                    <span style={{ color: '#CC0000' }}>
                      <AlertTriangle style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> Diff: {formatINRFull(trialBalance.difference)}
                    </span>
                  )}
                </span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
                  Loading...
                </div>
              ) : !trialBalance ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
                  No trial balance data
                </div>
              ) : (
                <table className="marg-grid">
                  <thead>
                    <tr>
                      <th>Account Name</th>
                      <th style={{ width: 50, textAlign: 'center' }}>Type</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Debit</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.accounts.map((account, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontSize: '8pt' }}>{account.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={
                            account.type === 'Asset' ? 'marg-badge marg-badge-blue' :
                            account.type === 'Liability' ? 'marg-badge marg-badge-orange' :
                            account.type === 'Revenue' ? 'marg-badge marg-badge-green' :
                            'marg-badge marg-badge-red'
                          }>
                            {account.type}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: account.debit > 0 ? '#003366' : '#808080' }}>
                          {account.debit > 0 ? formatINRFull(account.debit) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: account.credit > 0 ? '#003366' : '#808080' }}>
                          {account.credit > 0 ? formatINRFull(account.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#003366', color: '#FFFFFF', fontWeight: 700 }}>
                      <td colSpan={2}>Totals</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(trialBalance.totalDebit)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(trialBalance.totalCredit)}</td>
                    </tr>
                    {trialBalance.difference > 0 && (
                      <tr style={{ background: '#FFE0E0' }}>
                        <td colSpan={2} style={{ color: '#CC0000', fontWeight: 700 }}>Difference</td>
                        <td colSpan={2} style={{ textAlign: 'right', fontFamily: 'monospace', color: '#CC0000', fontWeight: 700 }}>
                          {formatINRFull(trialBalance.difference)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 4: Profit & Loss
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'profit_loss' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: 2 }}>
          {/* Date Filter */}
          <div style={{ display: 'flex', gap: 4, padding: '3px 0', alignItems: 'center' }}>
            <span className="marg-label">From:</span>
            <input type="date" className="marg-input" style={{ width: 120, height: 18 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="marg-label">To:</span>
            <input type="date" className="marg-input" style={{ width: 120, height: 18 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            <button className="marg-btn marg-btn-blue" style={{ height: 18, fontSize: '7pt' }} onClick={fetchProfitLoss}>
              <RefreshCw style={{ width: 10, height: 10 }} /> Apply
            </button>
          </div>

          {loading ? (
            <div className="marg-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#808080', fontSize: '8pt' }}>
              Loading...
            </div>
          ) : !profitLoss ? (
            <div className="marg-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#808080', fontSize: '8pt' }}>
              No P&L data
            </div>
          ) : (
            <>
              {/* P&L KPI Cards */}
              <div style={{ display: 'flex', gap: 2 }}>
                <div className="marg-kpi" style={{ flex: 1 }}>
                  <div className="marg-kpi-value" style={{ color: '#003366' }}>{formatINR(profitLoss.revenue.grossRevenue)}</div>
                  <div className="marg-kpi-label">Gross Revenue</div>
                </div>
                <div className="marg-kpi" style={{ flex: 1 }}>
                  <div className="marg-kpi-value" style={{ color: '#006600' }}>{formatINR(profitLoss.profit.grossProfit)}</div>
                  <div className="marg-kpi-label">Gross Profit</div>
                </div>
                <div className="marg-kpi" style={{ flex: 1 }}>
                  <div className="marg-kpi-value" style={{ color: profitLoss.profit.netProfit >= 0 ? '#006600' : '#CC0000' }}>
                    {formatINR(profitLoss.profit.netProfit)}
                  </div>
                  <div className="marg-kpi-label">Net Profit</div>
                </div>
                <div className="marg-kpi" style={{ flex: 1 }}>
                  <div className="marg-kpi-value" style={{ color: profitLoss.profit.profitMargin >= 0 ? '#006600' : '#CC0000' }}>
                    {profitLoss.profit.profitMargin.toFixed(1)}%
                  </div>
                  <div className="marg-kpi-label">Profit Margin</div>
                </div>
              </div>

              {/* P&L Statement */}
              <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
                {/* Left Column: Revenue & Cost */}
                <div className="marg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="marg-panel-caption"><span>Revenue</span></div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="marg-grid">
                      <tbody>
                        <tr>
                          <td><TrendingUp style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', color: '#006600' }} /> Gross Revenue</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(profitLoss.revenue.grossRevenue)}</td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: 16, color: '#808080' }}>(-) Returns</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#CC0000' }}>({formatINRFull(profitLoss.revenue.totalReturns)})</td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: 16, color: '#808080' }}>(-) GST Collected</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#CC0000' }}>({formatINRFull(profitLoss.revenue.gstCollected)})</td>
                        </tr>
                        <tr style={{ background: '#E0EEFF', fontWeight: 700 }}>
                          <td>Net Revenue</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#003366' }}>{formatINRFull(profitLoss.revenue.adjustedRevenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="marg-panel-caption"><span>Cost</span></div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="marg-grid">
                      <tbody>
                        <tr>
                          <td><ShoppingBag style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', color: '#CC6600' }} /> Cost of Goods</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(profitLoss.cost.costOfGoods)}</td>
                        </tr>
                        {profitLoss.cost.expenses.map((exp, idx) => (
                          <tr key={idx}>
                            <td style={{ paddingLeft: 16, color: '#808080' }}>{exp.category}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(exp.amount)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#FFE0E0', fontWeight: 700 }}>
                          <td>Total Cost</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#CC0000' }}>{formatINRFull(profitLoss.cost.totalCost)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Column: Profit Summary */}
                <div className="marg-panel" style={{ width: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="marg-panel-caption"><span>Profit Summary</span></div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="marg-grid">
                      <tbody>
                        <tr>
                          <td>Gross Profit</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#006600' }}>
                            {formatINRFull(profitLoss.profit.grossProfit)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: '#808080' }}>GP %</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                            {profitLoss.revenue.adjustedRevenue > 0
                              ? ((profitLoss.profit.grossProfit / profitLoss.revenue.adjustedRevenue) * 100).toFixed(1) + '%'
                              : '0%'}
                          </td>
                        </tr>
                        <tr style={{ background: '#E8E8E8' }}><td colSpan={2} /></tr>
                        <tr>
                          <td>Operating Expenses</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#CC0000' }}>
                            ({formatINRFull(profitLoss.cost.totalExpenses)})
                          </td>
                        </tr>
                        <tr style={{ background: '#E0EEFF' }}>
                          <td style={{ fontWeight: 700 }}>Net Profit</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: profitLoss.profit.netProfit >= 0 ? '#006600' : '#CC0000', fontSize: '9pt' }}>
                            {formatINRFull(profitLoss.profit.netProfit)}
                          </td>
                        </tr>
                        <tr>
                          <td>Profit Margin</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            <span className={profitLoss.profit.profitMargin >= 0 ? 'marg-badge marg-badge-green' : 'marg-badge marg-badge-red'}>
                              {profitLoss.profit.profitMargin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 5: Balance Sheet
          ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'balance_sheet' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: 2 }}>
          {loading ? (
            <div className="marg-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#808080', fontSize: '8pt' }}>
              Loading...
            </div>
          ) : !balanceSheet ? (
            <div className="marg-panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#808080', fontSize: '8pt' }}>
              No balance sheet data
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div style={{ display: 'flex', gap: 2 }}>
                <div className="marg-kpi" style={{ flex: 1 }}>
                  <div className="marg-kpi-value" style={{ color: '#003366' }}>{formatINR(balanceSheet.totalAssets)}</div>
                  <div className="marg-kpi-label">Total Assets</div>
                </div>
                <div className="marg-kpi" style={{ flex: 1 }}>
                  <div className="marg-kpi-value" style={{ color: '#CC6600' }}>{formatINR(balanceSheet.totalLiabilities)}</div>
                  <div className="marg-kpi-label">Total Liabilities</div>
                </div>
                <div className="marg-kpi" style={{ flex: 1 }}>
                  <div className="marg-kpi-value" style={{ color: '#006600' }}>{formatINR(balanceSheet.capital.ownerEquity)}</div>
                  <div className="marg-kpi-label">Owner Equity</div>
                </div>
              </div>

              {/* Balance Sheet */}
              <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
                {/* Assets */}
                <div className="marg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="marg-panel-caption">
                    <span style={{ color: '#003366' }}>Assets</span>
                    <span className="marg-badge marg-badge-blue">{formatINR(balanceSheet.totalAssets)}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="marg-grid">
                      <tbody>
                        <tr>
                          <td>
                            <Banknote style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', color: '#006600' }} /> Cash in Hand
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(balanceSheet.assets.cash)}</td>
                        </tr>
                        <tr>
                          <td>
                            <Landmark style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', color: '#003366' }} /> Bank (Card + UPI)
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(balanceSheet.assets.bank)}</td>
                        </tr>
                        <tr>
                          <td>
                            <Receipt style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', color: '#CC6600' }} /> Receivables
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(balanceSheet.assets.receivables)}</td>
                        </tr>
                        <tr>
                          <td>
                            <FileText style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', color: '#336699' }} /> Inventory (Stock)
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(balanceSheet.assets.inventory)}</td>
                        </tr>
                        <tr style={{ background: '#E0EEFF', fontWeight: 700 }}>
                          <td>Total Assets</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#003366' }}>{formatINRFull(balanceSheet.totalAssets)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Liabilities + Capital */}
                <div className="marg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="marg-panel-caption">
                    <span style={{ color: '#CC6600' }}>Liabilities &amp; Capital</span>
                    <span className="marg-badge marg-badge-orange">{formatINR(balanceSheet.totalLiabilities + balanceSheet.capital.ownerEquity)}</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table className="marg-grid">
                      <tbody>
                        <tr>
                          <td colSpan={2} style={{ background: '#F5F5F5', fontWeight: 700, color: '#CC6600' }}>Liabilities</td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: 16 }}>Payables (Suppliers)</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(balanceSheet.liabilities.payables)}</td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: 16 }}>GST Liability</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(balanceSheet.liabilities.gstLiability)}</td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: 16 }}>Loans</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(balanceSheet.liabilities.loans)}</td>
                        </tr>
                        <tr style={{ background: '#FFE0E0' }}>
                          <td style={{ fontWeight: 700 }}>Total Liabilities</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#CC0000', fontWeight: 700 }}>{formatINRFull(balanceSheet.totalLiabilities)}</td>
                        </tr>
                        <tr style={{ background: '#E8E8E8' }}><td colSpan={2} /></tr>
                        <tr>
                          <td colSpan={2} style={{ background: '#F5F5F5', fontWeight: 700, color: '#006600' }}>Capital</td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: 16 }}>Owner Equity</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINRFull(balanceSheet.capital.ownerEquity)}</td>
                        </tr>
                        <tr>
                          <td style={{ paddingLeft: 16 }}>Retained Earnings</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINRFull(balanceSheet.capital.retainedEarnings)}</td>
                        </tr>
                        <tr style={{ background: '#E0FFE0' }}>
                          <td style={{ fontWeight: 700 }}>Total Liabilities + Capital</td>
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600', fontWeight: 700 }}>
                            {formatINRFull(balanceSheet.totalLiabilities + balanceSheet.capital.ownerEquity)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          STATUS BAR
          ═══════════════════════════════════════════════════════════ */}
      <div className="marg-statusbar">
        <div className="sb-section">
          <DollarSign style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} />
          Accounting Module
        </div>
        <div className="sb-section flex-1" />
        <div className="sb-section">
          {dayBook && (
            <>
              Status: <span className={dayBook.dayBookStatus === 'open' ? 'marg-badge marg-badge-green' : dayBook.dayBookStatus === 'closed' ? 'marg-badge marg-badge-red' : 'marg-badge marg-badge-orange'}>
                {dayBook.dayBookStatus === 'not_opened' ? 'Day Not Opened' : dayBook.dayBookStatus.toUpperCase()}
              </span>
            </>
          )}
        </div>
        <div className="sb-section">{getTodayStr()}</div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DIALOG: Open Day Book
          ═══════════════════════════════════════════════════════════ */}
      {openDialog && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setOpenDialog(false)}>
          <div className="marg-dialog" style={{ width: 360 }}>
            <div className="marg-dialog-titlebar">
              <span>Open Day Book</span>
              <button onClick={() => setOpenDialog(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              <fieldset className="marg-groupbox">
                <legend>Opening Balances</legend>
                <div className="marg-field">
                  <span className="marg-label">Counter</span>
                  <select
                    className="marg-input"
                    value={selectedCounter}
                    onChange={e => setSelectedCounter(e.target.value)}
                  >
                    <option value="">-- Select Counter --</option>
                    {counters.length > 0 ? counters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    )) : (
                      <option value="default">Counter A (Default)</option>
                    )}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">
                      <Banknote style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> Cash
                    </span>
                    <input
                      className="marg-input"
                      type="number"
                      placeholder="0.00"
                      value={openCash}
                      onChange={e => setOpenCash(e.target.value)}
                    />
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">
                      <CreditCard style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> Card
                    </span>
                    <input
                      className="marg-input"
                      type="number"
                      placeholder="0.00"
                      value={openCard}
                      onChange={e => setOpenCard(e.target.value)}
                    />
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">
                      <Smartphone style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> UPI
                    </span>
                    <input
                      className="marg-input"
                      type="number"
                      placeholder="0.00"
                      value={openUPI}
                      onChange={e => setOpenUPI(e.target.value)}
                    />
                  </div>
                </div>
              </fieldset>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setOpenDialog(false)}>Cancel</button>
              <button className="marg-btn marg-btn-green" onClick={handleOpenDay} disabled={saving || !selectedCounter}>
                {saving ? 'Opening...' : 'Open Day'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          DIALOG: Close Day Book
          ═══════════════════════════════════════════════════════════ */}
      {closeDialog && dayBook && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setCloseDialog(false)}>
          <div className="marg-dialog" style={{ width: 360 }}>
            <div className="marg-dialog-titlebar">
              <span>Close Day Book</span>
              <button onClick={() => setCloseDialog(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              <div className="marg-sunken" style={{ padding: '6px 8px', marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 12, fontSize: '8pt', lineHeight: '18px' }}>
                  <div><span style={{ color: '#808080' }}>Expected Cash: </span><b>{formatINRFull(dayBook.closingCash)}</b></div>
                  <div><span style={{ color: '#808080' }}>Card: </span><b>{formatINRFull(dayBook.closingCard)}</b></div>
                  <div><span style={{ color: '#808080' }}>UPI: </span><b>{formatINRFull(dayBook.closingUPI)}</b></div>
                </div>
              </div>
              <fieldset className="marg-groupbox">
                <legend>Actual Cash Count</legend>
                <div className="marg-field">
                  <span className="marg-label">Actual Cash in Drawer</span>
                  <input
                    className="marg-input"
                    type="number"
                    placeholder="Enter actual cash amount"
                    value={actualCash}
                    onChange={e => setActualCash(e.target.value)}
                    style={{ fontWeight: 700, fontSize: '9pt' }}
                  />
                </div>
                {actualCash && (
                  <div style={{ paddingLeft: 94, fontSize: '7pt', padding: '2px 0' }}>
                    {(() => {
                      const diff = parseFloat(actualCash || '0') - dayBook.closingCash
                      return diff === 0 ? (
                        <span style={{ color: '#006600' }}><CheckCircle style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} /> Cash matches</span>
                      ) : (
                        <span style={{ color: '#CC0000' }}>
                          <AlertTriangle style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} />
                          Difference: {formatINRFull(diff)} ({diff > 0 ? 'Excess' : 'Shortage'})
                        </span>
                      )
                    })()}
                  </div>
                )}
              </fieldset>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setCloseDialog(false)}>Cancel</button>
              <button className="marg-btn marg-btn-red" onClick={handleCloseDay} disabled={saving || !actualCash}>
                {saving ? 'Closing...' : 'Close Day'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
