'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Plus, Search, X, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, DollarSign, FileText,
} from 'lucide-react'
import { toast } from 'sonner'

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
interface BatchInfo {
  id: string;
  batchNo: string;
  expiryDate: string;
  currentStock: number;
  costPrice: number;
  medicine: { id: string; name: string; form: string; strength: string | null };
}

interface Claim {
  id: string;
  purchaseOrderId: string | null;
  supplierId: string;
  batchId: string;
  claimType: string;
  claimDate: string;
  quantity: number;
  unitCost: number;
  totalAmount: number;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  settledAt: string | null;
  creditNoteNo: string | null;
  notes: string | null;
  createdAt: string;
  supplier: { id: string; name: string; phone: string | null };
  purchaseOrder: { id: string; invoiceNo: string } | null;
  batch: BatchInfo | null;
}

interface SupplierInfo {
  id: string;
  name: string;
}

interface SummaryData {
  totalClaims: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  settledCount: number;
  settledAmount: number;
  settlementRate: number;
}

interface PaginationInfo {
  page: number; limit: number; total: number; totalPages: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════ */
const CLAIM_TYPES = [
  { value: 'expiry', label: 'Expiry' },
  { value: 'damage', label: 'Damage' },
  { value: 'short_supply', label: 'Short Supply' },
  { value: 'quality_issue', label: 'Quality Issue' },
]

const EMPTY_FORM = {
  supplierId: '',
  batchId: '',
  claimType: 'expiry',
  quantity: 0,
  unitCost: 0,
  notes: '',
  purchaseOrderId: '',
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */
function formatINR(val: number) {
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateSafe(d: string | null) {
  if (!d) return '--'
  try { return format(new Date(d), 'dd-MMM-yyyy') } catch { return '--' }
}

function formatDateShort(d: string | null) {
  if (!d) return '--'
  try { return format(new Date(d), 'dd/MM/yy') } catch { return '--' }
}

function claimTypeBadge(type: string) {
  const map: Record<string, { cls: string; label: string }> = {
    expiry: { cls: 'marg-badge marg-badge-orange', label: 'Expiry' },
    damage: { cls: 'marg-badge marg-badge-red', label: 'Damage' },
    short_supply: { cls: 'marg-badge marg-badge-blue', label: 'Short Supply' },
    quality_issue: { cls: 'marg-badge marg-badge-red', label: 'Quality Issue' },
  }
  const info = map[type] || { cls: 'marg-badge', label: type }
  return <span className={info.cls}>{info.label}</span>
}

function claimStatusBadge(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'marg-badge marg-badge-orange', label: 'Pending' },
    approved: { cls: 'marg-badge marg-badge-blue', label: 'Approved' },
    rejected: { cls: 'marg-badge marg-badge-red', label: 'Rejected' },
    settled: { cls: 'marg-badge marg-badge-green', label: 'Settled' },
  }
  const info = map[status] || { cls: 'marg-badge', label: status }
  return <span className={info.cls}>{info.label}</span>
}

function claimSerialNo(idx: number, total: number) {
  const pad = String(Math.max(total, 100)).length
  return 'CLM-' + String(idx + 1).padStart(pad, '0')
}

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
export default function ClaimsModule() {
  /* ── Data State ────────────────────────────────────────────────── */
  const [claims, setClaims] = useState<Claim[]>([])
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  /* ── Lookup data ─────────────────────────────────────────────── */
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([])
  const [batches, setBatches] = useState<BatchInfo[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<{ id: string; invoiceNo: string }[]>([])

  /* ── Filter State ──────────────────────────────────────────────── */
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  /* ── Dialog State ──────────────────────────────────────────────── */
  const [formOpen, setFormOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [settleData, setSettleData] = useState({ creditNoteNo: '', settledAt: '' })

  /* ─── Data Fetching ────────────────────────────────────────────── */
  const fetchClaims = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(pagination.page))
      params.set('limit', String(pagination.limit))
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterType !== 'all') params.set('type', filterType)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/claims?${params}`)
      if (res.ok) {
        const data = await res.json()
        setClaims(data.claims)
        setPagination(data.pagination)
        if (data.summary) setSummary(data.summary)
      }
    } catch {
      toast.error('Failed to fetch claims')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filterStatus, filterType, searchQuery])

  const fetchLookups = useCallback(async () => {
    try {
      const [supRes, medRes] = await Promise.all([
        fetch('/api/purchases?limit=50'),
        fetch('/api/medicines?limit=100'),
      ])
      if (supRes.ok) {
        const supData = await supRes.json()
        const supMap = new Map<string, SupplierInfo>()
        ;(supData.orders || []).forEach((po: { supplier: { id: string; name: string } | null }) => {
          if (po.supplier) supMap.set(po.supplier.id, po.supplier)
        })
        setSuppliers(Array.from(supMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
        // Reuse same data for purchase orders
        setPurchaseOrders(
          (supData.orders || []).map((po: { id: string; invoiceNo: string }) => ({
            id: po.id,
            invoiceNo: po.invoiceNo,
          }))
        )
      }
      if (medRes.ok) {
        const medData = await medRes.json()
        const allBatches: BatchInfo[] = []
        ;(medData.medicines || []).forEach((m: { id: string; name: string; form: string; strength: string | null; batches: BatchInfo[] }) => {
          ;(m.batches || []).forEach((b: BatchInfo) => {
            allBatches.push({
              ...b,
              medicine: { id: m.id, name: m.name, form: m.form, strength: m.strength },
            })
          })
        })
        setBatches(allBatches)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchClaims() }, [fetchClaims])
  useEffect(() => { fetchLookups() }, [fetchLookups])

  /* ─── Handlers ─────────────────────────────────────────────────── */
  const openAddForm = () => {
    setFormData(EMPTY_FORM)
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!formData.supplierId || !formData.batchId || !formData.quantity) {
      toast.error('Supplier, batch, and quantity are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast.success('Claim created successfully')
        setFormOpen(false)
        fetchClaims()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to create claim')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async (claim: Claim) => {
    if (!confirm(`Approve claim for ${claim.batch?.medicine?.name || 'Unknown'}? Amount: ${formatINR(claim.totalAmount)}`)) return
    try {
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      if (res.ok) {
        toast.success('Claim approved')
        fetchClaims()
      } else {
        toast.error('Failed to approve')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleReject = async (claim: Claim) => {
    const reason = prompt('Enter rejection reason:')
    if (reason === null) return
    try {
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', notes: reason }),
      })
      if (res.ok) {
        toast.success('Claim rejected')
        fetchClaims()
      } else {
        toast.error('Failed to reject')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const openSettleDialog = (claim: Claim) => {
    setSelectedClaim(claim)
    setSettleData({
      creditNoteNo: claim.creditNoteNo || '',
      settledAt: format(new Date(), 'yyyy-MM-dd'),
    })
    setSettleOpen(true)
  }

  const handleSettle = async () => {
    if (!selectedClaim) return
    if (!settleData.creditNoteNo) {
      toast.error('Credit note number is required')
      return
    }
    try {
      const res = await fetch(`/api/claims/${selectedClaim.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'settled',
          creditNoteNo: settleData.creditNoteNo,
          settledAt: settleData.settledAt,
        }),
      })
      if (res.ok) {
        toast.success('Claim settled with credit note ' + settleData.creditNoteNo)
        setSettleOpen(false)
        setSelectedClaim(null)
        fetchClaims()
      } else {
        toast.error('Failed to settle claim')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleFind = () => {
    setPagination(p => ({ ...p, page: 1 }))
  }

  const goToPage = (p: number) => setPagination(prev => ({ ...prev, page: p }))

  const fromRec = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0
  const toRec = Math.min(pagination.page * pagination.limit, pagination.total)

  // Auto-calculate total when qty or unit cost changes
  const totalAmount = formData.quantity * (formData.unitCost || 0)

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* ── Panel Caption ────────────────────────────────────────── */}
      <div className="marg-panel-caption">
        <span>Claims Management — List</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="marg-btn marg-btn-blue" onClick={openAddForm}>
            <Plus style={{ width: 12, height: 12 }} /> New Claim
          </button>
          <button className="marg-btn" onClick={() => { fetchClaims(); toast.success('Refreshed') }}>
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
          <button className="marg-btn" onClick={() => toast.info('Close')}>
            <X style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ────────────────────────────────────── */}
      {summary && (
        <div style={{ display: 'flex', gap: 4, padding: '2px 0 0 0', flexWrap: 'wrap' }}>
          <div className="marg-kpi" style={{ flex: '1 1 120px', minWidth: 120 }}>
            <div className="marg-kpi-value">{summary.totalClaims}</div>
            <div className="marg-kpi-label">Total Claims</div>
          </div>
          <div className="marg-kpi" style={{ flex: '1 1 140px', minWidth: 140 }}>
            <div className="marg-kpi-value" style={{ color: '#CC6600' }}>{formatINR(summary.pendingAmount)}</div>
            <div className="marg-kpi-label">Pending Amount</div>
          </div>
          <div className="marg-kpi" style={{ flex: '1 1 140px', minWidth: 140 }}>
            <div className="marg-kpi-value" style={{ color: '#003366' }}>{formatINR(summary.approvedAmount)}</div>
            <div className="marg-kpi-label">Approved Amount</div>
          </div>
          <div className="marg-kpi" style={{ flex: '1 1 120px', minWidth: 120 }}>
            <div className="marg-kpi-value" style={{ color: '#006600' }}>{summary.settlementRate}%</div>
            <div className="marg-kpi-label">Settlement Rate</div>
          </div>
        </div>
      )}

      {/* ── Filter GroupBox ──────────────────────────────────────── */}
      <div className="marg-groupbox" style={{ margin: '2px 0 0 0', padding: '4px 6px' }}>
        <legend>Filter</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Search:</span>
            <input
              className="marg-input"
              style={{ width: 140 }}
              placeholder="Credit note, notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFind()}
            />
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Status:</span>
            <select
              className="marg-input"
              style={{ width: 100 }}
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="settled">Settled</option>
            </select>
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Type:</span>
            <select
              className="marg-input"
              style={{ width: 120 }}
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
            >
              <option value="all">All Types</option>
              {CLAIM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button className="marg-btn marg-btn-blue" onClick={handleFind} style={{ marginLeft: 'auto' }}>
            <Search style={{ width: 12, height: 12 }} /> Find
          </button>
        </div>
      </div>

      {/* ── Data Grid ────────────────────────────────────────────── */}
      <div className="marg-panel" style={{ flex: 1, overflow: 'auto', margin: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            Loading...
          </div>
        ) : claims.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            No claims found
          </div>
        ) : (
          <table className="marg-grid">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ width: 70 }}>Claim#</th>
                <th>Type</th>
                <th>Supplier</th>
                <th>Medicine / Batch</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Date</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ width: 110, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim, idx) => {
                const rowIdx = fromRec + idx - 1
                return (
                  <tr key={claim.id}>
                    <td style={{ textAlign: 'right', color: '#808080', fontSize: '7pt' }}>{rowIdx}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '7pt', fontWeight: 600, color: '#003366' }}>
                      {claimSerialNo(idx, pagination.total)}
                    </td>
                    <td>{claimTypeBadge(claim.claimType)}</td>
                    <td style={{ fontSize: '8pt' }}>{claim.supplier.name}</td>
                    <td>
                      <div style={{ fontSize: '8pt', fontWeight: 600 }}>{claim.batch?.medicine?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '7pt', color: '#808080' }}>
                        Batch: {claim.batch?.batchNo || '--'} | Exp: {formatDateShort(claim.batch?.expiryDate)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>{claim.quantity}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#003366' }}>
                      {formatINR(claim.totalAmount)}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '7pt' }}>{formatDateShort(claim.claimDate)}</td>
                    <td style={{ textAlign: 'center' }}>{claimStatusBadge(claim.status)}</td>
                    <td style={{ padding: '1px 2px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'nowrap' }}>
                        {claim.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(claim)}
                              className="marg-btn marg-btn-green"
                              style={{ height: 18, fontSize: '7pt', padding: '0 4px', minWidth: 20 }}
                              title="Approve"
                            >
                              <CheckCircle style={{ width: 10, height: 10 }} />
                            </button>
                            <button
                              onClick={() => handleReject(claim)}
                              className="marg-btn marg-btn-red"
                              style={{ height: 18, fontSize: '7pt', padding: '0 4px', minWidth: 20 }}
                              title="Reject"
                            >
                              <XCircle style={{ width: 10, height: 10 }} />
                            </button>
                          </>
                        )}
                        {claim.status === 'approved' && (
                          <button
                            onClick={() => openSettleDialog(claim)}
                            className="marg-btn marg-btn-blue"
                            style={{ height: 18, fontSize: '7pt', padding: '0 4px', minWidth: 20 }}
                            title="Settle"
                          >
                            <DollarSign style={{ width: 10, height: 10 }} />
                          </button>
                        )}
                        {claim.status === 'settled' && claim.creditNoteNo && (
                          <span style={{ fontSize: '7pt', color: '#006600', fontFamily: 'monospace' }} title={claim.creditNoteNo}>
                            <FileText style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle' }} />
                            {' '}{claim.creditNoteNo}
                          </span>
                        )}
                        {claim.notes && (
                          <span style={{ fontSize: '7pt', color: '#808080', marginLeft: 2, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={claim.notes}>
                            {claim.notes}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pager ────────────────────────────────────────────────── */}
      <div className="marg-pager" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <span>Records {fromRec}–{toRec} of {pagination.total}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className="marg-btn" disabled={pagination.page <= 1} onClick={() => goToPage(pagination.page - 1)}>
            <ChevronLeft style={{ width: 12, height: 12 }} /> Prev
          </button>
          <span>Page {pagination.page} of {pagination.totalPages || 1}</span>
          <button className="marg-btn" disabled={pagination.page >= pagination.totalPages} onClick={() => goToPage(pagination.page + 1)}>
            Next <ChevronRight style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          New Claim Dialog
          ═══════════════════════════════════════════════════════════ */}
      {formOpen && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setFormOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 540 }}>
            {/* Title Bar */}
            <div className="marg-dialog-titlebar">
              <span>New Claim</span>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: 0 }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body */}
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              {/* ── Claim Details ─────────────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Claim Details</legend>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Claim Type *</span>
                    <select className="marg-input" value={formData.claimType} onChange={e => setFormData(f => ({ ...f, claimType: e.target.value }))}>
                      {CLAIM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Supplier *</span>
                    <select className="marg-input" value={formData.supplierId} onChange={e => setFormData(f => ({ ...f, supplierId: e.target.value }))}>
                      <option value="">-- Select --</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* ── Batch & Quantity ──────────────────────────────── */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Batch &amp; Quantity</legend>
                <div className="marg-field">
                  <span className="marg-label">Batch *</span>
                  <select
                    className="marg-input"
                    value={formData.batchId}
                    onChange={e => {
                      const batchId = e.target.value
                      const batch = batches.find(b => b.id === batchId)
                      setFormData(f => ({
                        ...f,
                        batchId,
                        unitCost: batch ? batch.costPrice : 0,
                      }))
                    }}
                  >
                    <option value="">-- Select Batch --</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.medicine.name} | Batch: {b.batchNo} | Exp: {formatDateShort(b.expiryDate)} | Stock: {b.currentStock}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Quantity *</span>
                    <input className="marg-input" type="number" min={1} value={formData.quantity} onChange={e => setFormData(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Unit Cost</span>
                    <input className="marg-input" type="number" step={0.01} value={formData.unitCost} onChange={e => setFormData(f => ({ ...f, unitCost: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="marg-field" style={{ flex: 1 }}>
                    <span className="marg-label">Total</span>
                    <input className="marg-input marg-input-readonly" type="text" value={formatINR(totalAmount)} readOnly />
                  </div>
                </div>
              </fieldset>

              {/* ── Reference & Notes ─────────────────────────────── */}
              <fieldset className="marg-groupbox">
                <legend>Reference &amp; Notes</legend>
                <div className="marg-field">
                  <span className="marg-label">PO Reference</span>
                  <select className="marg-input" value={formData.purchaseOrderId} onChange={e => setFormData(f => ({ ...f, purchaseOrderId: e.target.value }))}>
                    <option value="">-- Optional --</option>
                    {purchaseOrders.map(po => <option key={po.id} value={po.id}>{po.invoiceNo}</option>)}
                  </select>
                </div>
                <div className="marg-field">
                  <span className="marg-label">Notes</span>
                  <textarea
                    className="marg-input"
                    style={{ height: 40, resize: 'none', fontFamily: 'Tahoma, sans-serif' }}
                    value={formData.notes}
                    onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Additional notes about this claim..."
                  />
                </div>
              </fieldset>
            </div>

            {/* Footer */}
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setFormOpen(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Create Claim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Settle Claim Dialog
          ═══════════════════════════════════════════════════════════ */}
      {settleOpen && selectedClaim && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setSettleOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 400 }}>
            {/* Title Bar */}
            <div className="marg-dialog-titlebar">
              <span>Settle Claim — {selectedClaim.supplier.name}</span>
              <button onClick={() => setSettleOpen(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', padding: 0 }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body */}
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              {/* Claim Summary */}
              <div className="marg-sunken" style={{ padding: '4px 6px', marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt' }}>
                  <span><strong>Medicine:</strong> {selectedClaim.batch?.medicine?.name || 'Unknown'}</span>
                  <span><strong>Batch:</strong> {selectedClaim.batch?.batchNo || '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', marginTop: 2 }}>
                  <span><strong>Type:</strong> {selectedClaim.claimType}</span>
                  <span><strong>Qty:</strong> {selectedClaim.quantity} × {formatINR(selectedClaim.unitCost)}</span>
                </div>
                <div style={{ textAlign: 'right', fontSize: '9pt', fontWeight: 700, color: '#003366', marginTop: 2, borderTop: '1px solid #D4D4D4', paddingTop: 2 }}>
                  Total: {formatINR(selectedClaim.totalAmount)}
                </div>
              </div>

              {/* Settlement Fields */}
              <fieldset className="marg-groupbox">
                <legend>Settlement Details</legend>
                <div className="marg-field">
                  <span className="marg-label">Credit Note *</span>
                  <input
                    className="marg-input"
                    value={settleData.creditNoteNo}
                    onChange={e => setSettleData(d => ({ ...d, creditNoteNo: e.target.value }))}
                    placeholder="e.g., CN-2025-001"
                  />
                </div>
                <div className="marg-field">
                  <span className="marg-label">Settlement Date</span>
                  <input
                    className="marg-input"
                    type="date"
                    value={settleData.settledAt}
                    onChange={e => setSettleData(d => ({ ...d, settledAt: e.target.value }))}
                  />
                </div>
              </fieldset>
            </div>

            {/* Footer */}
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setSettleOpen(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" onClick={handleSettle}>
                <DollarSign style={{ width: 12, height: 12 }} /> Settle Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
