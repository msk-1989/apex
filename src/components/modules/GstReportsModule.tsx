'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText, Printer, Download, RefreshCw, X,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────
function formatINR(value: number): string {
  return '\u20B9' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

// ─── Skeleton ───────────────────────────────────────────────────────────
function GSTSkeleton() {
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

// ─── Period Filter ──────────────────────────────────────────────────────
function PeriodFilter({ dateFrom, dateTo, setDateFrom, setDateTo, onGenerate }: {
  dateFrom: string; dateTo: string;
  setDateFrom: (v: string) => void; setDateTo: (v: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="marg-field" style={{ marginBottom: 6 }}>
      <span className="marg-label">Period:</span>
      <input type="date" className="marg-input" style={{ width: 120 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
      <span style={{ padding: '0 4px', color: '#808080' }}>to</span>
      <input type="date" className="marg-input" style={{ width: 120 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
      <button className="marg-btn marg-btn-blue" style={{ marginLeft: 4 }} onClick={onGenerate}>
        <RefreshCw className="w-3 h-3" /> Generate
      </button>
    </div>
  )
}

// ─── Tab 1: GSTR-1 (Outward Supplies) ──────────────────────────────────
function GSTR1Tab() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'gstr1', dateFrom, dateTo })
      const res = await fetch(`/api/gst-reports?${params}`)
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <GSTSkeleton />

  const summary = data.summary || {}
  const rateWise = data.rateWise || []
  const invoices = data.invoices || []

  return (
    <div style={{ padding: 6 }}>
      <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} onGenerate={fetchReport} />

      {/* Summary KPIs */}
      <div className="flex" style={{ marginBottom: 6 }}>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(summary.totalTaxableValue || 0)}</div>
          <div className="marg-kpi-label">Total Taxable Value</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(summary.totalCGST || 0)}</div>
          <div className="marg-kpi-label">Total CGST</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(summary.totalSGST || 0)}</div>
          <div className="marg-kpi-label">Total SGST</div>
        </div>
        <div className="marg-kpi flex-1">
          <div className="marg-kpi-value">{summary.totalInvoices || 0}</div>
          <div className="marg-kpi-label">Total Invoices</div>
        </div>
      </div>

      {/* Rate-wise Breakdown */}
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>GST Rate-wise Breakdown</legend>
        <div className="marg-sunken" style={{ maxHeight: 200, overflow: 'auto' }}>
          <table className="marg-grid">
            <thead>
              <tr>
                <th>GST Rate</th>
                <th style={{ textAlign: 'right' }}>Taxable Value</th>
                <th style={{ textAlign: 'right' }}>CGST</th>
                <th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'center' }}>Invoices</th>
              </tr>
            </thead>
            <tbody>
              {rateWise.map((r: any) => (
                <tr key={r.gstRate}>
                  <td><span className="marg-badge marg-badge-blue">{r.gstRate}%</span></td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(r.taxableValue)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(r.cgst)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(r.sgst)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.invoices}</td>
                </tr>
              ))}
              {rateWise.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No data for the selected period</td></tr>
              )}
            </tbody>
            {rateWise.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: '#E0E0E0' }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(summary.totalTaxableValue)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(summary.totalCGST)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(summary.totalSGST)}</td>
                  <td style={{ textAlign: 'center' }}>{summary.totalInvoices}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </fieldset>

      {/* Invoice List */}
      <fieldset className="marg-groupbox">
        <legend>Invoice Details ({invoices.length})</legend>
        <div className="marg-sunken" style={{ maxHeight: 240, overflow: 'auto' }}>
          <table className="marg-grid">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Customer GST</th>
                <th style={{ textAlign: 'center' }}>Date</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
                <th style={{ textAlign: 'right' }}>GST</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'monospace' }}>{inv.invoiceNo}</td>
                  <td>{inv.customerName}</td>
                  <td style={{ fontFamily: 'monospace', color: '#808080' }}>{inv.customerGst || '\u2014'}</td>
                  <td style={{ textAlign: 'center' }}>{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(inv.subtotal)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(inv.gstAmount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(inv.totalAmount)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`marg-badge ${inv.paymentMode === 'cash' ? 'marg-badge-green' : inv.paymentMode === 'card' ? 'marg-badge-blue' : inv.paymentMode === 'upi' ? 'marg-badge-orange' : 'marg-badge-red'}`}>
                      {inv.paymentMode}
                    </span>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No invoices found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  )
}

// ─── Tab 2: GSTR-3B Summary ────────────────────────────────────────────
function GSTR3BTab() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'gstr3b', dateFrom, dateTo })
      const res = await fetch(`/api/gst-reports?${params}`)
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <GSTSkeleton />

  const supplies = data.supplies || {}
  const itc = data.itc || {}
  const tax = data.tax || {}

  return (
    <div style={{ padding: 6 }}>
      <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} onGenerate={fetchReport} />

      {/* Table 3.1: Outward Supplies */}
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>Table 3.1 \u2014 Outward Supplies and Inward Supplies liable to reverse charge</legend>
        <table className="marg-grid">
          <thead>
            <tr>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Taxable Value</th>
              <th style={{ textAlign: 'right' }}>IGST</th>
              <th style={{ textAlign: 'right' }}>CGST</th>
              <th style={{ textAlign: 'right' }}>SGST</th>
              <th style={{ textAlign: 'right' }}>Cess</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>(a) Outward Taxable Supplies</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.taxableValue || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.igst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.cgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.sgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.cess || 0)}</td>
            </tr>
            <tr>
              <td>(b) Inward Supplies (Reverse Charge)</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
            </tr>
            <tr style={{ fontWeight: 700, background: '#E0E0E0' }}>
              <td>Total</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.taxableValue || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.igst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.cgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.sgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(supplies.cess || 0)}</td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      {/* Table 4: ITC Details */}
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>Table 4 \u2014 Eligible ITC</legend>
        <table className="marg-grid">
          <thead>
            <tr>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>IGST</th>
              <th style={{ textAlign: 'right' }}>CGST</th>
              <th style={{ textAlign: 'right' }}>SGST</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>(a) ITC Available (from Purchases)</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(itc.igst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(itc.cgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(itc.sgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(itc.available || 0)}</td>
            </tr>
            <tr style={{ background: '#F5F8FC' }}>
              <td style={{ paddingLeft: 20 }}>(b) ITC Reversed</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#808080' }}>{formatINR(0)}</td>
            </tr>
            <tr style={{ fontWeight: 700, background: '#D4E5F7' }}>
              <td>(c) Net ITC Available</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(itc.igst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(itc.cgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(itc.sgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(itc.available || 0)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>(d) ITC Utilized</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600' }}>{formatINR(Math.min(itc.igst || 0, supplies.igst || 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600' }}>{formatINR(Math.min(itc.cgst || 0, supplies.cgst || 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600' }}>{formatINR(Math.min(itc.sgst || 0, supplies.sgst || 0))}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600', fontWeight: 600 }}>{formatINR(itc.utilized || 0)}</td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      {/* Tax Payable & Total Liability */}
      <fieldset className="marg-groupbox">
        <legend>Table 5 &amp; 6 \u2014 Tax Payable and Total Liability</legend>
        <table className="marg-grid">
          <tbody>
            <tr>
              <td colSpan={2} style={{ background: '#E0E0E0', fontWeight: 700, color: '#003366' }}>Tax Payable (Output Tax \u2013 ITC)</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>IGST Payable</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(tax.igst || 0)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>CGST Payable</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(tax.cgst || 0)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>SGST Payable</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(tax.sgst || 0)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>Cess Payable</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(tax.cess || 0)}</td>
            </tr>
            <tr style={{ background: '#F0F0F0', fontWeight: 700 }}>
              <td style={{ paddingLeft: 20 }}>Total Tax Payable</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(tax.total || 0)}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ height: 4, background: '#FFFFFF' }}></td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>Interest</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(0)}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: 20 }}>Late Fee</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(0)}</td>
            </tr>
            <tr style={{ background: '#D4E5F7', fontWeight: 700, color: '#003366' }}>
              <td style={{ paddingLeft: 20, fontSize: '9pt' }}>TOTAL LIABILITY</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '10pt' }}>{formatINR(data.totalLiability || 0)}</td>
            </tr>
          </tbody>
        </table>
      </fieldset>
    </div>
  )
}

// ─── Tab 3: Purchase Register ───────────────────────────────────────────
function PurchaseRegisterTab() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'purchase_register', dateFrom, dateTo })
      const res = await fetch(`/api/gst-reports?${params}`)
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <GSTSkeleton />

  const purchases = data.purchases || []
  const summary = data.summary || {}

  return (
    <div style={{ padding: 6 }}>
      <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} onGenerate={fetchReport} />

      {/* Summary KPIs */}
      <div className="flex" style={{ marginBottom: 6 }}>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{purchases.length}</div>
          <div className="marg-kpi-label">Total Purchases</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(summary.totalTaxable || 0)}</div>
          <div className="marg-kpi-label">Total Taxable</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value">{formatINR(summary.totalCGST || 0)}</div>
          <div className="marg-kpi-label">Input CGST (ITC)</div>
        </div>
        <div className="marg-kpi flex-1">
          <div className="marg-kpi-value">{formatINR(summary.totalSGST || 0)}</div>
          <div className="marg-kpi-label">Input SGST (ITC)</div>
        </div>
      </div>

      {/* Purchase Table */}
      <fieldset className="marg-groupbox">
        <legend>Purchase Register \u2014 GST Input Credit ({purchases.length})</legend>
        <div className="marg-sunken" style={{ maxHeight: 360, overflow: 'auto' }}>
          <table className="marg-grid">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Supplier</th>
                <th>Supplier GST#</th>
                <th style={{ textAlign: 'center' }}>Date</th>
                <th style={{ textAlign: 'right' }}>Taxable</th>
                <th style={{ textAlign: 'center' }}>GST Rate</th>
                <th style={{ textAlign: 'right' }}>CGST</th>
                <th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace' }}>{p.invoiceNo}</td>
                  <td style={{ fontWeight: 600 }}>{p.supplier}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '7pt', color: '#808080' }}>{p.supplierGst || '\u2014'}</td>
                  <td style={{ textAlign: 'center' }}>{new Date(p.date).toLocaleDateString('en-IN')}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(p.taxableValue)}</td>
                  <td style={{ textAlign: 'center' }}><span className="marg-badge marg-badge-blue">{p.gstRate}%</span></td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(p.cgst)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(p.sgst)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(p.total)}</td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No purchase data for the selected period</td></tr>
              )}
            </tbody>
            {purchases.length > 0 && (
              <tfoot>
                <tr style={{ fontWeight: 700, background: '#E0E0E0' }}>
                  <td colSpan={4}>Total ({purchases.length} purchases)</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(summary.totalTaxable)}</td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(summary.totalCGST)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(summary.totalSGST)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(summary.totalPurchases)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </fieldset>
    </div>
  )
}

// ─── Tab 4: GST Summary Dashboard ───────────────────────────────────────
function GSTSummaryTab() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: 'gst_summary', dateFrom, dateTo })
      const res = await fetch(`/api/gst-reports?${params}`)
      if (res.ok) setData(await res.json())
      else setData(null)
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchReport() }, [fetchReport])

  if (loading || !data) return <GSTSkeleton />

  const outputGST = data.outputGST || {}
  const inputGST = data.inputGST || {}

  return (
    <div style={{ padding: 6 }}>
      <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} onGenerate={fetchReport} />

      {/* Top KPIs */}
      <div className="flex" style={{ marginBottom: 6 }}>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value" style={{ color: '#003366' }}>{formatINR(data.totalSales || 0)}</div>
          <div className="marg-kpi-label">Total Sales (Period)</div>
        </div>
        <div className="marg-kpi flex-1 border-r border-[#808080]">
          <div className="marg-kpi-value" style={{ color: '#003366' }}>{formatINR(data.totalPurchases || 0)}</div>
          <div className="marg-kpi-label">Total Purchases (Period)</div>
        </div>
        <div className="marg-kpi flex-1">
          <div className="marg-kpi-value" style={{ color: (data.netPayable || 0) > 0 ? '#CC0000' : '#006600', fontWeight: 700 }}>
            {formatINR(data.netPayable || 0)}
          </div>
          <div className="marg-kpi-label">Net GST Payable</div>
        </div>
      </div>

      {/* Comparison Table */}
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>GST Comparison \u2014 Output vs Input</legend>
        <table className="marg-grid">
          <thead>
            <tr>
              <th style={{ width: 160 }}>Component</th>
              <th style={{ textAlign: 'right', width: 140 }}>Output GST (Sales)</th>
              <th style={{ textAlign: 'right', width: 140 }}>Input GST (Purchases)</th>
              <th style={{ textAlign: 'right', width: 140 }}>Net Payable</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>CGST</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(outputGST.cgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600' }}>({formatINR(inputGST.cgst || 0)})</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(Math.max(0, (outputGST.cgst || 0) - (inputGST.cgst || 0)))}</td>
            </tr>
            <tr style={{ background: '#F5F8FC' }}>
              <td style={{ fontWeight: 600 }}>SGST</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(outputGST.sgst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600' }}>({formatINR(inputGST.sgst || 0)})</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(Math.max(0, (outputGST.sgst || 0) - (inputGST.sgst || 0)))}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>IGST</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(outputGST.igst || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600' }}>({formatINR(inputGST.igst || 0)})</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatINR(Math.max(0, (outputGST.igst || 0) - (inputGST.igst || 0)))}</td>
            </tr>
            <tr style={{ fontWeight: 700, background: '#E0E0E0' }}>
              <td style={{ fontWeight: 700, color: '#003366' }}>TOTAL</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(outputGST.total || 0)}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#006600' }}>({formatINR(inputGST.total || 0)})</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: (data.netPayable || 0) > 0 ? '#CC0000' : '#006600' }}>
                {formatINR(data.netPayable || 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </fieldset>

      {/* Visual Bars */}
      <fieldset className="marg-groupbox">
        <legend>Visual Comparison</legend>
        <div style={{ padding: '4px 8px' }}>
          {/* Output GST Bar */}
          <div style={{ marginBottom: 8 }}>
            <div className="flex justify-between" style={{ marginBottom: 2 }}>
              <span className="marg-label" style={{ fontWeight: 600 }}>Output GST (Collected on Sales)</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#003366' }}>{formatINR(outputGST.total || 0)}</span>
            </div>
            <div style={{ background: '#E0E0E0', height: 18, position: 'relative' }}>
              <div style={{ background: '#336699', height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#FFFFFF', fontSize: '7pt', fontWeight: 700 }}>
                  CGST: {formatINR(outputGST.cgst || 0)} | SGST: {formatINR(outputGST.sgst || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Input GST Bar */}
          <div style={{ marginBottom: 8 }}>
            <div className="flex justify-between" style={{ marginBottom: 2 }}>
              <span className="marg-label" style={{ fontWeight: 600 }}>Input GST (Available ITC)</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#006600' }}>{formatINR(inputGST.total || 0)}</span>
            </div>
            <div style={{ background: '#E0E0E0', height: 18, position: 'relative' }}>
              {(() => {
                const pct = outputGST.total > 0 ? Math.min((inputGST.total / outputGST.total) * 100, 100) : 0
                return (
                  <div style={{ background: '#006633', height: '100%', width: `${pct}%`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#FFFFFF', fontSize: '7pt', fontWeight: 700 }}>
                      CGST: {formatINR(inputGST.cgst || 0)} | SGST: {formatINR(inputGST.sgst || 0)}
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Net Payable Bar */}
          <div>
            <div className="flex justify-between" style={{ marginBottom: 2 }}>
              <span className="marg-label" style={{ fontWeight: 700 }}>Net GST Payable to Government</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: (data.netPayable || 0) > 0 ? '#CC0000' : '#006600', fontSize: '9pt' }}>
                {formatINR(data.netPayable || 0)}
              </span>
            </div>
            <div style={{ background: '#E0E0E0', height: 20, position: 'relative' }}>
              {(() => {
                const pct = outputGST.total > 0 ? Math.min(((data.netPayable || 0) / outputGST.total) * 100, 100) : 0
                const color = (data.netPayable || 0) > 0 ? '#CC0000' : '#006600'
                return (
                  <div style={{ background: color, height: '100%', width: `${Math.max(pct, 2)}%`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#FFFFFF', fontSize: '7pt', fontWeight: 700 }}>
                      {pct.toFixed(1)}% of Output GST
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Credit Note */}
          {(data.netPayable || 0) <= 0 && (
            <div style={{ marginTop: 6, padding: '4px 8px', background: '#E0FFE0', border: '1px solid #006600', color: '#006600', fontWeight: 600, fontSize: '8pt' }}>
              Note: You have excess ITC. Net Payable is Zero. Excess ITC of {formatINR(Math.abs(data.netPayable || 0))} will be carried forward.
            </div>
          )}
        </div>
      </fieldset>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────
export default function GstReportsModule() {
  const [activeTab, setActiveTab] = useState('gstr1')

  const tabs = [
    { key: 'gstr1', label: 'GSTR-1 (Outward)' },
    { key: 'gstr3b', label: 'GSTR-3B Summary' },
    { key: 'purchase_register', label: 'Purchase Register' },
    { key: 'gst_summary', label: 'GST Summary' },
  ]

  return (
    <div className="marg-panel flex flex-col h-full">
      {/* Panel Caption */}
      <div className="marg-panel-caption">
        <span>
          <FileText className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />
          GST Reports \u2014 Compliance &amp; Returns
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
            <FileText className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto" style={{ background: '#FFFFFF' }}>
        {activeTab === 'gstr1' && <GSTR1Tab />}
        {activeTab === 'gstr3b' && <GSTR3BTab />}
        {activeTab === 'purchase_register' && <PurchaseRegisterTab />}
        {activeTab === 'gst_summary' && <GSTSummaryTab />}
      </div>

      {/* Status Bar */}
      <div className="marg-statusbar">
        <span className="sb-section">GST Report: {tabs.find(t => t.key === activeTab)?.label}</span>
        <span className="sb-section" style={{ marginLeft: 'auto' }}>Generated: {new Date().toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}
