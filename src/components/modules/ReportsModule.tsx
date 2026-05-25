'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, Printer, Download, RefreshCw, X, FileText
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── Helpers ────────────────────────────────────────────────────────────
function formatINR(value: number): string {
  return '\u20B9' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCompact(value: number): string {
  if (value >= 100000) return '\u20B9' + (value / 100000).toFixed(1) + 'L'
  if (value >= 1000) return '\u20B9' + (value / 1000).toFixed(1) + 'K'
  return '\u20B9' + value.toString()
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function thirtyDaysAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

// MARG chart colors
const MARG_COLORS = ['#003366', '#336699', '#6699CC', '#996633', '#006633', '#CC6600']

// ─── Skeleton ───────────────────────────────────────────────────────────
function ReportSkeleton() {
  return (
    <div style={{ padding: 6 }}>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="marg-kpi flex-1">
            <div className="animate-pulse" style={{ height: 10, background: '#F0F0F0', width: 60, marginBottom: 4 }} />
            <div className="animate-pulse" style={{ height: 16, background: '#F0F0F0', width: 80 }} />
          </div>
        ))}
      </div>
      <fieldset className="marg-groupbox" style={{ marginTop: 6 }}>
        <legend>&nbsp;</legend>
        <div className="animate-pulse" style={{ height: 180, background: '#F0F0F0' }} />
      </fieldset>
    </div>
  )
}

// ─── Daily Sales Report ─────────────────────────────────────────────────
function DailySalesReport() {
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'daily_sales', dateFrom, dateTo })
      const res = await fetch(`/api/reports?${params}`)
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <ReportSkeleton />

  const summary = data.summary || {}
  const paymentData = [
    { name: 'Cash', value: summary.cashSales || 0 },
    { name: 'Card', value: summary.cardSales || 0 },
    { name: 'UPI', value: summary.upiSales || 0 },
    { name: 'Credit', value: summary.creditSales || 0 },
  ].filter(p => p.value > 0)

  return (
    <div style={{ padding: 6 }}>
      {/* Date filter */}
      <div className="marg-field" style={{ marginBottom: 6 }}>
        <span className="marg-label">Date Range:</span>
        <input type="date" className="marg-input" style={{ width: 120 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ padding: '0 4px', color: '#808080' }}>to</span>
        <input type="date" className="marg-input" style={{ width: 120 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="marg-btn marg-btn-blue" style={{ marginLeft: 4 }} onClick={fetchReport}>
          <RefreshCw className="w-3 h-3" /> Generate
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="flex" style={{ marginBottom: 6 }}>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(summary.totalSales)}</div>
          <div className="marg-kpi-label">Total Sales</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{summary.totalInvoices}</div>
          <div className="marg-kpi-label">Invoices</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(summary.avgInvoiceValue)}</div>
          <div className="marg-kpi-label">Avg Bill</div>
        </div>
        <div className="marg-kpi flex-1">
          <div className="marg-kpi-value">{formatINR(summary.totalGST)}</div>
          <div className="marg-kpi-label">GST Collected</div>
        </div>
      </div>

      {/* Payment Breakdown */}
      {paymentData.length > 0 && (
        <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
          <legend>Payment Mode Breakdown</legend>
          <div className="flex" style={{ marginBottom: 4 }}>
            {paymentData.map((p, i) => (
              <div key={p.name} className="marg-kpi flex-1 border-r border-[#808080]" style={{ padding: '4px 8px' }}>
                <div className="marg-kpi-value" style={{ fontSize: '10pt', color: MARG_COLORS[i] }}>{formatINR(p.value)}</div>
                <div className="marg-kpi-label">{p.name}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 200, marginTop: 4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} strokeWidth={0} paddingAngle={2}>
                  {paymentData.map((_, i) => <Cell key={i} fill={MARG_COLORS[i % MARG_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </fieldset>
      )}

      {/* Sales Table */}
      <fieldset className="marg-groupbox">
        <legend>Invoice Details ({(data.sales || []).length})</legend>
        <div className="marg-sunken" style={{ maxHeight: 256, overflow: 'auto' }}>
          <table className="marg-grid">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
                <th style={{ textAlign: 'right' }}>GST</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {(data.sales || []).map((inv: any) => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'monospace' }}>{inv.invoiceNo}</td>
                  <td>{inv.customer?.name || 'Walk-in'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(inv.subtotal)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(inv.gstAmount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(inv.totalAmount)}</td>
                  <td style={{ textAlign: 'center' }}>{inv.paymentMode || '\u2014'}</td>
                </tr>
              ))}
              {(data.sales || []).length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No sales data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  )
}

// ─── Stock Summary Report ───────────────────────────────────────────────
function StockSummaryReport() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports?type=stock_summary')
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <ReportSkeleton />

  const topMedicines = (data.medicines || [])
    .sort((a: any, b: any) => b.totalValue - a.totalValue)
    .slice(0, 10)

  const stockSummary = data.summary || {}

  return (
    <div style={{ padding: 6 }}>
      {/* Summary KPIs */}
      <div className="flex" style={{ marginBottom: 6 }}>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{stockSummary.totalMedicines || 0}</div>
          <div className="marg-kpi-label">Medicines</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{stockSummary.totalItems || 0}</div>
          <div className="marg-kpi-label">Total Units</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(stockSummary.totalValue || 0)}</div>
          <div className="marg-kpi-label">Stock Value</div>
        </div>
        <div className="marg-kpi flex-1">
          <div className="marg-kpi-value" style={{ color: '#CC6600' }}>{stockSummary.lowStockItems || 0}</div>
          <div className="marg-kpi-label">Low Stock</div>
        </div>
      </div>

      {/* Chart */}
      {topMedicines.length > 0 && (
        <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
          <legend>Top 10 Medicines by Value</legend>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMedicines} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} fontSize={10} />
                <YAxis type="category" dataKey="name" width={140} fontSize={10} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Bar dataKey="totalValue" fill="#336699" maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </fieldset>
      )}

      {/* Full Stock Table */}
      <fieldset className="marg-groupbox">
        <legend>All Medicines ({(data.medicines || []).length})</legend>
        <div className="marg-sunken" style={{ maxHeight: 288, overflow: 'auto' }}>
          <table className="marg-grid">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Category</th>
                <th>Manufacturer</th>
                <th style={{ textAlign: 'center' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Value</th>
                <th style={{ textAlign: 'center' }}>Batches</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.medicines || []).map((m: any) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td>{m.category}</td>
                  <td style={{ color: '#808080' }}>{m.manufacturer}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{m.totalStock}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(m.totalValue)}</td>
                  <td style={{ textAlign: 'center' }}>{m.batchCount}</td>
                  <td style={{ textAlign: 'center' }}>
                    {m.isLowStock
                      ? <span className="marg-badge marg-badge-orange">Low Stock</span>
                      : <span className="marg-badge marg-badge-green">OK</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  )
}

// ─── GST Report ─────────────────────────────────────────────────────────
function GSTReport() {
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'gst_report', dateFrom, dateTo })
      const res = await fetch(`/api/reports?${params}`)
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <ReportSkeleton />

  const gstRates = Object.entries(data.gstBreakdown || {}).map(([rate, v]: [string, any]) => ({
    rate: `${rate}%`,
    taxableAmount: v.taxableAmount,
    cgst: v.cgst,
    sgst: v.sgst,
    totalGst: v.totalGst,
  }))

  const pieData = gstRates.map(r => ({ name: r.rate, value: r.totalGst }))

  return (
    <div style={{ padding: 6 }}>
      {/* Date filter */}
      <div className="marg-field" style={{ marginBottom: 6 }}>
        <span className="marg-label">Date Range:</span>
        <input type="date" className="marg-input" style={{ width: 120 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ padding: '0 4px', color: '#808080' }}>to</span>
        <input type="date" className="marg-input" style={{ width: 120 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="marg-btn marg-btn-blue" style={{ marginLeft: 4 }} onClick={fetchReport}>
          <RefreshCw className="w-3 h-3" /> Generate
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="flex" style={{ marginBottom: 6 }}>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(data.totalTaxable)}</div>
          <div className="marg-kpi-label">Taxable Amount</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(data.totalGST)}</div>
          <div className="marg-kpi-label">Total GST</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(data.totalGST / 2)}</div>
          <div className="marg-kpi-label">CGST</div>
        </div>
        <div className="marg-kpi flex-1">
          <div className="marg-kpi-value">{formatINR(data.totalGST / 2)}</div>
          <div className="marg-kpi-label">SGST</div>
        </div>
      </div>

      <div className="flex gap-2">
        {/* GST Breakdown Table */}
        <fieldset className="marg-groupbox flex-1">
          <legend>GST Breakdown by Rate</legend>
          <table className="marg-grid">
            <thead>
              <tr>
                <th>Rate</th>
                <th style={{ textAlign: 'right' }}>Taxable</th>
                <th style={{ textAlign: 'right' }}>CGST</th>
                <th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'right' }}>Total GST</th>
              </tr>
            </thead>
            <tbody>
              {gstRates.map(r => (
                <tr key={r.rate}>
                  <td><span className="marg-badge marg-badge-blue">{r.rate}</span></td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(r.taxableAmount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(r.cgst)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(r.sgst)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(r.totalGst)}</td>
                </tr>
              ))}
              {gstRates.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No GST data</td></tr>
              )}
            </tbody>
          </table>
        </fieldset>

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <fieldset className="marg-groupbox" style={{ width: 260 }}>
            <legend>GST Distribution</legend>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} strokeWidth={0} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={MARG_COLORS[i % MARG_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </fieldset>
        )}
      </div>
    </div>
  )
}

// ─── Expiry Report ──────────────────────────────────────────────────────
function ExpiryReport() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports?type=expiry_report')
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <ReportSkeleton />

  const sections = [
    { key: 'expired', label: 'Already Expired', cls: 'marg-badge-red', color: '#CC0000' },
    { key: 'expiring3Months', label: 'Expiring in 3 Months', cls: 'marg-badge-red', color: '#CC0000' },
    { key: 'expiring6Months', label: 'Expiring in 6 Months', cls: 'marg-badge-orange', color: '#CC6600' },
    { key: 'expiring1Year', label: 'Expiring in 1 Year', cls: 'marg-badge-blue', color: '#003366' },
  ]

  const chartData = sections.map(s => ({
    name: s.label.split(' in ')[0] || s.label,
    count: data[s.key]?.count || 0,
    value: data[s.key]?.value || 0,
  }))

  return (
    <div style={{ padding: 6 }}>
      {/* Summary KPIs */}
      <div className="flex" style={{ marginBottom: 6 }}>
        {sections.map((s, i) => (
          <div key={s.key} className={`marg-kpi flex-1 ${i < sections.length - 1 ? 'border-r border-[#808080]' : ''}`}>
            <div className="marg-kpi-value" style={{ color: s.color }}>{data[s.key]?.count || 0}</div>
            <div className="marg-kpi-label">{s.label}</div>
            <div style={{ fontFamily: 'monospace', color: '#808080' }}>{formatINR(data[s.key]?.value || 0)}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>Expiry Overview</legend>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Bar dataKey="count" fill="#CC0000" maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </fieldset>

      {/* Detailed Tables */}
      {sections.map(s => {
        const items = data[s.key]?.items || []
        if (items.length === 0) return null
        return (
          <fieldset key={s.key} className="marg-groupbox" style={{ marginBottom: 6 }}>
            <legend>
              {s.label} ({items.length}) \u2014 {formatINR(data[s.key]?.value || 0)}
            </legend>
            <div className="marg-sunken" style={{ maxHeight: 192, overflow: 'auto' }}>
              <table className="marg-grid">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Batch #</th>
                    <th>Expiry Date</th>
                    <th style={{ textAlign: 'center' }}>Stock</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((b: any) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600 }}>{b.medicine?.name || '\u2014'}</td>
                      <td>{b.medicine?.category?.name || '\u2014'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{b.batchNo}</td>
                      <td>{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('en-IN') : '\u2014'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{b.currentStock}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(b.costPrice * b.currentStock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

// ─── Profit & Loss Report ───────────────────────────────────────────────
function ProfitLossReport() {
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'profit_loss', dateFrom, dateTo })
      const res = await fetch(`/api/reports?${params}`)
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <ReportSkeleton />

  const revenue = data.revenue || {}
  const cost = data.cost || {}
  const profit = data.profit || {}
  const isProfit = (profit.netProfit || 0) >= 0

  return (
    <div style={{ padding: 6 }}>
      {/* Date filter */}
      <div className="marg-field" style={{ marginBottom: 6 }}>
        <span className="marg-label">Date Range:</span>
        <input type="date" className="marg-input" style={{ width: 120 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ padding: '0 4px', color: '#808080' }}>to</span>
        <input type="date" className="marg-input" style={{ width: 120 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="marg-btn marg-btn-blue" style={{ marginLeft: 4 }} onClick={fetchReport}>
          <RefreshCw className="w-3 h-3" /> Generate
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="flex" style={{ marginBottom: 6 }}>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(revenue.grossRevenue || 0)}</div>
          <div className="marg-kpi-label">Gross Revenue</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(cost.costOfGoods || 0)}</div>
          <div className="marg-kpi-label">Cost of Goods</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(cost.expenses || 0)}</div>
          <div className="marg-kpi-label">Expenses</div>
        </div>
        <div className="marg-kpi flex-1">
          <div className="marg-kpi-value" style={{ color: isProfit ? '#006600' : '#CC0000' }}>
            {formatINR(profit.netProfit || 0)}
          </div>
          <div className="marg-kpi-label">Net Profit ({profit.profitMargin || 0}%)</div>
        </div>
      </div>

      {/* P&L Table */}
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>Profit &amp; Loss Statement</legend>
        <table className="marg-grid">
          <tbody>
            <tr style={{ background: '#E0E0E0', fontWeight: 700 }}>
              <td colSpan={2} style={{ color: '#003366' }}>Revenue</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>Gross Revenue</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(revenue.grossRevenue || 0)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20, color: '#808080' }}>(\u2013) GST Collected</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>({formatINR(revenue.gstCollected || 0)})</td>
            </tr>
            <tr style={{ fontWeight: 700, background: '#F0F0F0' }}>
              <td style={{ paddingLeft: 20 }}>Net Revenue</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(revenue.netRevenue || 0)}</td>
            </tr>
            <tr style={{ background: '#E0E0E0', fontWeight: 700 }}>
              <td colSpan={2} style={{ color: '#003366' }}>Costs</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>Cost of Goods Sold</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(cost.costOfGoods || 0)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>Operating Expenses</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(cost.expenses || 0)}</td>
            </tr>
            <tr style={{ fontWeight: 700, background: '#F0F0F0' }}>
              <td style={{ paddingLeft: 20 }}>Total Costs</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(cost.totalCost || 0)}</td>
            </tr>
            <tr style={{ background: '#D4E5F7', fontWeight: 700 }}>
              <td style={{ paddingLeft: 20, color: '#003366' }}>Gross Profit</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#003366' }}>{formatINR(profit.grossProfit || 0)}</td>
            </tr>
            <tr style={{ background: isProfit ? '#E0FFE0' : '#FFE0E0', fontWeight: 700 }}>
              <td style={{ paddingLeft: 20, color: isProfit ? '#006600' : '#CC0000' }}>
                Net Profit {isProfit ? '\u2191' : '\u2193'}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: isProfit ? '#006600' : '#CC0000' }}>
                {formatINR(profit.netProfit || 0)}
              </td>
            </tr>
            <tr style={{ background: '#E0E0E0' }}>
              <td style={{ paddingLeft: 20, fontWeight: 600 }}>Profit Margin</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: '#003366' }}>{profit.profitMargin || 0}%</td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      {/* Expense Breakdown */}
      {data.expenses && data.expenses.length > 0 && (
        <fieldset className="marg-groupbox">
          <legend>Expense Breakdown</legend>
          <div className="marg-sunken" style={{ maxHeight: 192, overflow: 'auto' }}>
            <table className="marg-grid">
              <thead>
                <tr><th>Description</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
              </thead>
              <tbody>
                {data.expenses.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.description || e.category || '\u2014'}</td>
                    <td>{e.date ? new Date(e.date).toLocaleDateString('en-IN') : '\u2014'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────
export default function ReportsModule() {
  const [activeTab, setActiveTab] = useState('daily_sales')

  const tabs = [
    { key: 'daily_sales', label: 'Daily Sales' },
    { key: 'stock_summary', label: 'Stock Summary' },
    { key: 'gst_report', label: 'GST' },
    { key: 'expiry_report', label: 'Expiry' },
    { key: 'profit_loss', label: 'P&L' },
  ]

  return (
    <div className="marg-panel flex flex-col h-full">
      {/* Panel Caption */}
      <div className="marg-panel-caption">
        <span>
          <FileText className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />
          Reports \u2014 Select Report Type
        </span>
        <div className="flex items-center gap-1">
          <button className="marg-btn" onClick={() => window.print()}>
            <Printer className="w-3 h-3" /> Print
          </button>
          <button className="marg-btn">
            <Download className="w-3 h-3" /> Export
          </button>
          <button className="marg-btn marg-btn-red">
            <X className="w-3 h-3" /> Close
          </button>
        </div>
      </div>

      {/* Tab Strip */}
      <div className="marg-tabstrip">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`marg-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <BarChart3 className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-auto" style={{ background: '#FFFFFF' }}>
        {activeTab === 'daily_sales' && <DailySalesReport />}
        {activeTab === 'stock_summary' && <StockSummaryReport />}
        {activeTab === 'gst_report' && <GSTReport />}
        {activeTab === 'expiry_report' && <ExpiryReport />}
        {activeTab === 'profit_loss' && <ProfitLossReport />}
      </div>

      {/* Status Bar */}
      <div className="marg-statusbar">
        <span className="sb-section">Report: {tabs.find(t => t.key === activeTab)?.label}</span>
        <span className="sb-section" style={{ marginLeft: 'auto' }}>Generated: {new Date().toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}
