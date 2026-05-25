'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, RefreshCw, X, Calculator, DollarSign,
  User, CheckCircle, Clock, Filter, TrendingUp
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
interface CommissionItem {
  id: string
  staffId: string
  invoiceId: string | null
  month: number
  year: number
  totalSales: number
  totalProfit: number
  commissionPct: number
  commissionAmt: number
  status: string
  paidAt: string | null
  notes: string | null
  createdAt: string
  staff: { id: string; name: string; role: string; phone: string | null }
}

interface CommissionSummary {
  totalCommission: number
  paidCommission: number
  pendingCommission: number
  topEarner: { name: string; amount: number } | null
}

interface StaffInfo {
  id: string
  name: string
  role: string
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */
function formatINR(val: number) {
  return '\u20B9' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  calculated: { label: 'Pending', badgeClass: 'marg-badge marg-badge-orange' },
  paid: { label: 'Paid', badgeClass: 'marg-badge marg-badge-green' },
  cancelled: { label: 'Cancelled', badgeClass: 'marg-badge marg-badge-red' },
}

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
export default function CommissionModule() {
  /* ── Data State ────────────────────────────────────────────────── */
  const [commissions, setCommissions] = useState<CommissionItem[]>([])
  const [summary, setSummary] = useState<CommissionSummary>({
    totalCommission: 0, paidCommission: 0, pendingCommission: 0, topEarner: null,
  })
  const [staffList, setStaffList] = useState<StaffInfo[]>([])
  const [loading, setLoading] = useState(true)

  /* ── Filter State ──────────────────────────────────────────────── */
  const [filterStaff, setFilterStaff] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  /* ── Calculator Dialog ─────────────────────────────────────────── */
  const [calcDialogOpen, setCalcDialogOpen] = useState(false)
  const [calcStaff, setCalcStaff] = useState('')
  const [calcMonth, setCalcMonth] = useState(new Date().getMonth() + 1)
  const [calcYear, setCalcYear] = useState(new Date().getFullYear())
  const [calculating, setCalculating] = useState(false)

  /* ─── Data Fetching ────────────────────────────────────────────── */
  const fetchCommissions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('month', String(selectedMonth))
      params.set('year', String(selectedYear))
      if (filterStaff) params.set('staffId', filterStaff)
      if (filterStatus) params.set('status', filterStatus)

      const res = await fetch(`/api/commissions?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCommissions(data.commissions || [])
        if (data.summary) setSummary(data.summary)
        setStaffList(data.staffList || [])
      }
    } catch {
      toast.error('Failed to fetch commissions')
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear, filterStaff, filterStatus])

  useEffect(() => { fetchCommissions() }, [fetchCommissions])

  /* ─── Handlers ─────────────────────────────────────────────────── */
  const handleCalculate = async () => {
    if (!calcStaff) {
      toast.error('Please select a staff member')
      return
    }
    setCalculating(true)
    try {
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: calcStaff,
          month: calcMonth,
          year: calcYear,
          action: 'calculate',
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Commission calculated: ${formatINR(data.commission.commissionAmt)}`)
        setCalcDialogOpen(false)
        fetchCommissions()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to calculate commission')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setCalculating(false)
    }
  }

  const handlePayCommission = async (commission: CommissionItem) => {
    if (!confirm(`Mark commission for ${commission.staff.name} (${formatINR(commission.commissionAmt)}) as paid?`)) return
    try {
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: commission.staffId,
          month: commission.month,
          year: commission.year,
          action: 'pay',
        }),
      })
      if (res.ok) {
        toast.success(`Commission paid to ${commission.staff.name}`)
        fetchCommissions()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to pay commission')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const openCalculator = () => {
    setCalcStaff('')
    setCalcMonth(selectedMonth)
    setCalcYear(selectedYear)
    setCalcDialogOpen(true)
  }

  /* ─── Aggregate staff-wise data ────────────────────────────────── */
  const staffWiseData: Record<string, {
    name: string
    role: string
    totalSales: number
    totalProfit: number
    commissionAmt: number
    status: string
    commissionId: string
    staffId: string
  }> = {}

  commissions.forEach(c => {
    if (!staffWiseData[c.staffId]) {
      staffWiseData[c.staffId] = {
        name: c.staff.name,
        role: c.staff.role,
        totalSales: 0,
        totalProfit: 0,
        commissionAmt: 0,
        status: c.status,
        commissionId: c.id,
        staffId: c.staffId,
      }
    }
    staffWiseData[c.staffId].totalSales += c.totalSales
    staffWiseData[c.staffId].totalProfit += c.totalProfit
    staffWiseData[c.staffId].commissionAmt += c.commissionAmt
    if (c.status === 'calculated') staffWiseData[c.staffId].status = 'calculated'
  })

  const staffRows = Object.values(staffWiseData)

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* ── Panel Caption ────────────────────────────────────────── */}
      <div className="marg-panel-caption">
        <span>Commission Management — {MONTH_NAMES[selectedMonth]} {selectedYear}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="marg-btn marg-btn-blue" onClick={openCalculator}>
            <Calculator style={{ width: 12, height: 12 }} /> Calculate Commission
          </button>
          <button className="marg-btn" onClick={() => { fetchCommissions(); toast.success('Refreshed') }}>
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Commission Summary KPIs ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1px', background: '#808080' }}>
        <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
          <div className="marg-kpi-value">{formatINR(summary.totalCommission)}</div>
          <div className="marg-kpi-label">Total Commission</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
          <div className="marg-kpi-value" style={{ color: '#006600' }}>{formatINR(summary.paidCommission)}</div>
          <div className="marg-kpi-label">Paid</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
          <div className="marg-kpi-value" style={{ color: '#CC6600' }}>{formatINR(summary.pendingCommission)}</div>
          <div className="marg-kpi-label">Pending</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
          <div className="marg-kpi-value" style={{ color: '#336699' }}>
            {summary.topEarner ? summary.topEarner.name : '--'}
          </div>
          <div className="marg-kpi-label">Top Earner</div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────── */}
      <div className="marg-groupbox" style={{ margin: '2px 0 0 0', padding: '4px 6px' }}>
        <legend>Filter</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Month:</span>
            <select
              className="marg-input"
              style={{ width: 100 }}
              value={String(selectedMonth)}
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
            >
              {MONTH_NAMES.filter(Boolean).map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Year:</span>
            <select
              className="marg-input"
              style={{ width: 70 }}
              value={String(selectedYear)}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
            >
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Staff:</span>
            <select
              className="marg-input"
              style={{ width: 130 }}
              value={filterStaff}
              onChange={e => setFilterStaff(e.target.value)}
            >
              <option value="">All Staff</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Status:</span>
            <select
              className="marg-input"
              style={{ width: 100 }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <button className="marg-btn marg-btn-blue" onClick={fetchCommissions} style={{ marginLeft: 'auto' }}>
            <Search style={{ width: 12, height: 12 }} /> Find
          </button>
        </div>
      </div>

      {/* ── Staff-wise Commission Table ─────────────────────────── */}
      <div className="marg-panel" style={{ flex: 1, overflow: 'auto', margin: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            Loading commissions...
          </div>
        ) : staffRows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            No commission data for {MONTH_NAMES[selectedMonth]} {selectedYear}
            <button className="marg-btn marg-btn-blue" style={{ marginTop: 8 }} onClick={openCalculator}>
              <Calculator style={{ width: 12, height: 12 }} /> Calculate Now
            </button>
          </div>
        ) : (
          <table className="marg-grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Staff Name</th>
                <th>Role</th>
                <th style={{ textAlign: 'right' }}>Total Sales</th>
                <th style={{ textAlign: 'right' }}>Total Profit</th>
                <th style={{ textAlign: 'right' }}>Comm. %</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((row, idx) => (
                <tr key={row.staffId}>
                  <td style={{ textAlign: 'right', color: '#808080', fontSize: '7pt' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <User style={{ width: 10, height: 10, color: '#336699' }} />
                      {row.name}
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize', color: '#808080' }}>{row.role}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(row.totalSales)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: row.totalProfit >= 0 ? '#006600' : '#CC0000' }}>
                    {formatINR(row.totalProfit)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    {row.totalSales > 0 ? (row.commissionAmt / row.totalSales * 100).toFixed(1) + '%' : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#003366' }}>
                    {formatINR(row.commissionAmt)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={STATUS_CONFIG[row.status]?.badgeClass || 'marg-badge marg-badge-blue'}>
                      {STATUS_CONFIG[row.status]?.label || row.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.status === 'calculated' && (() => {
                      const target = commissions.find(c => c.staffId === row.staffId && c.status === 'calculated')
                      return target ? (
                        <button
                          className="marg-btn marg-btn-green"
                          style={{ fontSize: '7pt', height: 18, padding: '0 6px' }}
                          onClick={() => handlePayCommission(target)}
                        >
                          <CheckCircle style={{ width: 9, height: 9 }} /> Pay
                        </button>
                      ) : null
                    })()}
                    {row.status === 'paid' && (() => {
                      const paidComm = commissions.find(c => c.staffId === row.staffId && c.status === 'paid')
                      return (
                        <span style={{ fontSize: '7pt', color: '#808080' }}>
                          {paidComm?.paidAt
                            ? format(new Date(paidComm.paidAt), 'dd MMM yy')
                            : '--'}
                        </span>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Summary Footer ──────────────────────────────────────── */}
      <div className="marg-pager" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <span>Showing {staffRows.length} staff member{staffRows.length !== 1 ? 's' : ''}</span>
        <span>
          Total: {formatINR(summary.totalCommission)} | Paid: {formatINR(summary.paidCommission)} | Pending: {formatINR(summary.pendingCommission)}
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Commission Calculator Dialog
          ═══════════════════════════════════════════════════════════ */}
      {calcDialogOpen && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setCalcDialogOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 420 }}>
            <div className="marg-dialog-titlebar">
              <span>Commission Calculator</span>
              <button onClick={() => setCalcDialogOpen(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              <div className="marg-sunken" style={{ padding: '4px 6px', marginBottom: 6, fontSize: '7pt', color: '#808080' }}>
                Commission is auto-calculated from sales data: 2% of total sales OR 5% of profit, whichever is higher.
              </div>
              <fieldset className="marg-groupbox">
                <legend>Calculate Commission</legend>
                <div className="marg-field">
                  <span className="marg-label">Staff *</span>
                  <select
                    className="marg-input"
                    value={calcStaff}
                    onChange={e => setCalcStaff(e.target.value)}
                  >
                    <option value="">-- Select Staff --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Month</span>
                    <select
                      className="marg-input"
                      value={String(calcMonth)}
                      onChange={e => setCalcMonth(parseInt(e.target.value))}
                    >
                      {MONTH_NAMES.filter(Boolean).map((name, idx) => (
                        <option key={idx + 1} value={idx + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Year</span>
                    <select
                      className="marg-input"
                      value={String(calcYear)}
                      onChange={e => setCalcYear(parseInt(e.target.value))}
                    >
                      {[2023, 2024, 2025, 2026].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setCalcDialogOpen(false)}>Cancel</button>
              <button className="marg-btn marg-btn-green" onClick={handleCalculate} disabled={calculating}>
                {calculating ? 'Calculating...' : 'Calculate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
