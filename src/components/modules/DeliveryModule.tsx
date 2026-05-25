'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, RefreshCw, X, Truck, User, Phone,
  MapPin, Hash, Package, DollarSign, Clock, ChevronRight,
  Filter, CheckCircle, XCircle, AlertCircle, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */
interface DeliveryItem {
  id: string
  invoiceId: string
  customerId: string
  patientName: string | null
  address: string
  phone: string | null
  status: string
  deliveryBoy: string | null
  notes: string | null
  codAmount: number | null
  assignedAt: string | null
  deliveredAt: string | null
  createdAt: string
  customer: { id: string; name: string; phone: string | null }
  invoice: { id: string; invoiceNo: string; totalAmount: number; _count?: { items: number } }
}

interface SummaryData {
  totalToday: number
  inTransit: number
  delivered: number
  pending: number
}

interface InvoiceOption {
  id: string
  invoiceNo: string
  totalAmount: number
  customer: { id: string; name: string; phone: string | null; address: string | null }
  items: unknown[]
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */
function formatINR(val: number) {
  return '\u20B9' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(d: string) {
  if (!d) return '--'
  return format(new Date(d), 'dd MMM yy hh:mm a')
}

function formatDate(d: string) {
  if (!d) return '--'
  return format(new Date(d), 'dd MMM yy')
}

const STATUS_PIPELINE = ['pending', 'assigned', 'in_transit', 'delivered']

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; bg: string; border: string; headerBg: string }> = {
  pending: {
    label: 'Pending',
    badgeClass: 'marg-badge marg-badge-orange',
    bg: '#FFFDE6',
    border: '#CC9900',
    headerBg: '#CC9900',
  },
  assigned: {
    label: 'Assigned',
    badgeClass: 'marg-badge marg-badge-blue',
    bg: '#E8F0FE',
    border: '#336699',
    headerBg: '#336699',
  },
  in_transit: {
    label: 'In Transit',
    badgeClass: 'marg-badge marg-badge-orange',
    bg: '#FFF0E0',
    border: '#CC6600',
    headerBg: '#CC6600',
  },
  delivered: {
    label: 'Delivered',
    badgeClass: 'marg-badge marg-badge-green',
    bg: '#E8FFE8',
    border: '#006600',
    headerBg: '#006600',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'marg-badge marg-badge-red',
    bg: '#FFE8E8',
    border: '#CC0000',
    headerBg: '#CC0000',
  },
}

/* ═══════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */
export default function DeliveryModule() {
  /* ── Data State ────────────────────────────────────────────────── */
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([])
  const [summary, setSummary] = useState<SummaryData>({ totalToday: 0, inTransit: 0, delivered: 0, pending: 0 })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  /* ── Dialog State ──────────────────────────────────────────────── */
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryItem | null>(null)
  const [saving, setSaving] = useState(false)

  /* ── New Delivery Form ─────────────────────────────────────────── */
  const [invoices, setInvoices] = useState<InvoiceOption[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPatientName, setNewPatientName] = useState('')
  const [newNotes, setNewNotes] = useState('')

  /* ── Assign Form ───────────────────────────────────────────────── */
  const [assignBoy, setAssignBoy] = useState('')
  const [assignCod, setAssignCod] = useState('')

  /* ─── Data Fetching ────────────────────────────────────────────── */
  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filterStatus) params.set('status', filterStatus)
      params.set('limit', '100')

      const res = await fetch(`/api/delivery?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDeliveries(data.deliveries || [])
        if (data.summary) setSummary(data.summary)
      }
    } catch {
      toast.error('Failed to fetch deliveries')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filterStatus])

  useEffect(() => { fetchDeliveries() }, [fetchDeliveries])

  /* ─── Load available invoices (without existing delivery) ──────── */
  const fetchAvailableInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/sales?limit=100&status=completed')
      if (res.ok) {
        const data = await res.json()
        // Filter invoices that already have delivery
        const deliveryInvIds = new Set(deliveries.map(d => d.invoiceId))
        const available = (data.invoices || []).filter(
          (inv: { id: string; invoiceNo: string; totalAmount: number; customer: { id: string; name: string; phone: string | null; address: string | null }; items: unknown[] }) =>
            !deliveryInvIds.has(inv.id)
        )
        setInvoices(available)
      }
    } catch {
      /* silent */
    }
  }, [deliveries])

  /* ─── Handlers ─────────────────────────────────────────────────── */
  const openNewDialog = () => {
    setSelectedInvoice('')
    setNewAddress('')
    setNewPhone('')
    setNewPatientName('')
    setNewNotes('')
    setNewDialogOpen(true)
    fetchAvailableInvoices()
  }

  const handleInvoiceSelect = (invoiceId: string) => {
    setSelectedInvoice(invoiceId)
    const inv = invoices.find(i => i.id === invoiceId)
    if (inv) {
      setNewAddress(inv.customer.address || '')
      setNewPhone(inv.customer.phone || '')
    }
  }

  const handleCreateDelivery = async () => {
    if (!selectedInvoice || !newAddress) {
      toast.error('Please select an invoice and enter address')
      return
    }
    const inv = invoices.find(i => i.id === selectedInvoice)
    if (!inv) return

    setSaving(true)
    try {
      const res = await fetch('/api/delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: selectedInvoice,
          customerId: inv.customer.id,
          patientName: newPatientName || null,
          address: newAddress,
          phone: newPhone || null,
          notes: newNotes || null,
        }),
      })
      if (res.ok) {
        toast.success('Delivery created successfully')
        setNewDialogOpen(false)
        fetchDeliveries()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to create delivery')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const openAssignDialog = (delivery: DeliveryItem) => {
    setSelectedDelivery(delivery)
    setAssignBoy(delivery.deliveryBoy || '')
    setAssignCod(delivery.codAmount != null ? String(delivery.codAmount) : String(delivery.invoice.totalAmount))
    setAssignDialogOpen(true)
  }

  const handleAssign = async () => {
    if (!selectedDelivery || !assignBoy) {
      toast.error('Delivery boy name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDelivery.id,
          deliveryBoy: assignBoy,
          codAmount: parseFloat(assignCod) || 0,
          status: 'assigned',
        }),
      })
      if (res.ok) {
        toast.success('Delivery assigned successfully')
        setAssignDialogOpen(false)
        fetchDeliveries()
      } else {
        const d = await res.json()
        toast.error(d.error || 'Failed to assign delivery')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusUpdate = async (delivery: DeliveryItem, newStatus: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: delivery.id, status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Delivery marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
        fetchDeliveries()
      } else {
        toast.error('Failed to update status')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (delivery: DeliveryItem) => {
    if (!confirm('Cancel this delivery?')) return
    await handleStatusUpdate(delivery, 'cancelled')
  }

  /* ─── Group deliveries by status ───────────────────────────────── */
  const groupedDeliveries: Record<string, DeliveryItem[]> = {
    pending: [],
    assigned: [],
    in_transit: [],
    delivered: [],
    cancelled: [],
  }
  deliveries.forEach(d => {
    if (groupedDeliveries[d.status]) {
      groupedDeliveries[d.status].push(d)
    }
  })

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* ── Panel Caption ────────────────────────────────────────── */}
      <div className="marg-panel-caption">
        <span>Delivery Management — Board</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="marg-btn marg-btn-blue" onClick={openNewDialog}>
            <Plus style={{ width: 12, height: 12 }} /> New Delivery
          </button>
          <button className="marg-btn" onClick={() => { fetchDeliveries(); toast.success('Refreshed') }}>
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1px', background: '#808080' }}>
        <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
          <div className="marg-kpi-value">{summary.totalToday}</div>
          <div className="marg-kpi-label">Today Total</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
          <div className="marg-kpi-value" style={{ color: '#CC6600' }}>{summary.inTransit}</div>
          <div className="marg-kpi-label">In Transit</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
          <div className="marg-kpi-value" style={{ color: '#006600' }}>{summary.delivered}</div>
          <div className="marg-kpi-label">Delivered</div>
        </div>
        <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
          <div className="marg-kpi-value" style={{ color: '#CC9900' }}>{summary.pending}</div>
          <div className="marg-kpi-label">Pending</div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────── */}
      <div className="marg-groupbox" style={{ margin: '2px 0 0 0', padding: '4px 6px' }}>
        <legend>Filter</legend>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Search:</span>
            <input
              className="marg-input"
              style={{ width: 200 }}
              placeholder="Customer name, invoice#..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchDeliveries()}
            />
          </div>
          <div className="marg-field" style={{ flex: '0 0 auto' }}>
            <span className="marg-label">Status:</span>
            <select
              className="marg-input"
              style={{ width: 120 }}
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <button className="marg-btn marg-btn-blue" onClick={fetchDeliveries} style={{ marginLeft: 'auto' }}>
            <Search style={{ width: 12, height: 12 }} /> Find
          </button>
        </div>
      </div>

      {/* ── Delivery Board (Kanban) ─────────────────────────────── */}
      <div className="marg-panel" style={{ flex: 1, overflow: 'auto', margin: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: '#808080', fontSize: '8pt' }}>
            Loading deliveries...
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '4px', padding: '6px', height: '100%', minHeight: 0 }}>
            {Object.entries(STATUS_CONFIG).map(([statusKey, cfg]) => (
              <div
                key={statusKey}
                style={{
                  flex: 1,
                  minWidth: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#F8F8F8',
                  border: '1px solid ' + cfg.border,
                }}
              >
                {/* Column Header */}
                <div
                  style={{
                    background: cfg.headerBg,
                    color: '#FFFFFF',
                    padding: '4px 6px',
                    fontWeight: 700,
                    fontSize: '8pt',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{cfg.label}</span>
                  <span style={{
                    background: 'rgba(255,255,255,0.3)',
                    padding: '0 6px',
                    borderRadius: 0,
                    fontSize: '7pt',
                    fontWeight: 700,
                  }}>
                    {groupedDeliveries[statusKey]?.length || 0}
                  </span>
                </div>
                {/* Cards */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
                  {(!groupedDeliveries[statusKey] || groupedDeliveries[statusKey].length === 0) && (
                    <div style={{ textAlign: 'center', color: '#C0C0C0', fontSize: '7pt', padding: '20px 4px' }}>
                      No deliveries
                    </div>
                  )}
                  {groupedDeliveries[statusKey]?.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        background: cfg.bg,
                        border: '1px solid ' + cfg.border,
                        padding: '5px 6px',
                        marginBottom: '3px',
                        fontSize: '8pt',
                      }}
                    >
                      {/* Invoice # */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700, color: '#003366', fontSize: '8pt' }}>
                          <Hash style={{ width: 9, height: 9, display: 'inline', verticalAlign: 'middle' }} />
                          {' '}{d.invoice.invoiceNo}
                        </span>
                        <span className={cfg.badgeClass}>{cfg.label}</span>
                      </div>
                      {/* Customer */}
                      <div style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <User style={{ width: 9, height: 9, color: '#808080', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{d.customer.name}</span>
                      </div>
                      {/* Address */}
                      <div style={{ marginBottom: '2px', display: 'flex', alignItems: 'flex-start', gap: 3, color: '#404040' }}>
                        <MapPin style={{ width: 9, height: 9, color: '#808080', flexShrink: 0, marginTop: 1 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.3' }}>
                          {d.address}
                        </span>
                      </div>
                      {/* Phone */}
                      {d.phone && (
                        <div style={{ marginBottom: '2px', display: 'flex', alignItems: 'center', gap: 3, color: '#404040' }}>
                          <Phone style={{ width: 9, height: 9, color: '#808080', flexShrink: 0 }} />
                          <span>{d.phone}</span>
                        </div>
                      )}
                      {/* Items & Amount */}
                      <div style={{ display: 'flex', gap: 8, marginTop: '3px', paddingTop: '3px', borderTop: '1px dashed #C0C0C0' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#808080' }}>
                          <Package style={{ width: 9, height: 9 }} /> {d.invoice._count?.items ?? 0} items
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600, color: '#003366' }}>
                          <DollarSign style={{ width: 9, height: 9 }} /> {formatINR(d.invoice.totalAmount)}
                        </span>
                      </div>
                      {/* COD Amount */}
                      {d.codAmount != null && d.codAmount > 0 && (
                        <div style={{ marginTop: '2px', fontSize: '7pt', color: '#CC6600' }}>
                          COD: {formatINR(d.codAmount)}
                        </div>
                      )}
                      {/* Delivery Boy */}
                      {d.deliveryBoy && (
                        <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: 3, color: '#336699', fontSize: '7pt' }}>
                          <Truck style={{ width: 9, height: 9 }} />
                          <span>{d.deliveryBoy}</span>
                          {d.assignedAt && <span style={{ color: '#808080' }}>({formatDateTime(d.assignedAt)})</span>}
                        </div>
                      )}
                      {/* Created At */}
                      <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: 3, color: '#C0C0C0', fontSize: '7pt' }}>
                        <Clock style={{ width: 8, height: 8 }} />
                        {formatDateTime(d.createdAt)}
                      </div>
                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: 2, marginTop: '4px', paddingTop: '3px', borderTop: '1px solid #D4D4D4' }}>
                        {statusKey === 'pending' && (
                          <>
                            <button
                              className="marg-btn marg-btn-blue"
                              style={{ fontSize: '7pt', height: 18, padding: '0 6px' }}
                              onClick={() => openAssignDialog(d)}
                            >
                              <User style={{ width: 9, height: 9 }} /> Assign
                            </button>
                            <button
                              className="marg-btn marg-btn-red"
                              style={{ fontSize: '7pt', height: 18, padding: '0 6px' }}
                              onClick={() => handleCancel(d)}
                            >
                              <XCircle style={{ width: 9, height: 9 }} />
                            </button>
                          </>
                        )}
                        {statusKey === 'assigned' && (
                          <>
                            <button
                              className="marg-btn"
                              style={{ fontSize: '7pt', height: 18, padding: '0 6px' }}
                              onClick={() => handleStatusUpdate(d, 'in_transit')}
                            >
                              <ArrowRight style={{ width: 9, height: 9 }} /> In Transit
                            </button>
                            <button
                              className="marg-btn marg-btn-green"
                              style={{ fontSize: '7pt', height: 18, padding: '0 6px' }}
                              onClick={() => handleStatusUpdate(d, 'delivered')}
                            >
                              <CheckCircle style={{ width: 9, height: 9 }} /> Delivered
                            </button>
                            <button
                              className="marg-btn marg-btn-red"
                              style={{ fontSize: '7pt', height: 18, padding: '0 6px' }}
                              onClick={() => handleCancel(d)}
                            >
                              <XCircle style={{ width: 9, height: 9 }} />
                            </button>
                          </>
                        )}
                        {statusKey === 'in_transit' && (
                          <button
                            className="marg-btn marg-btn-green"
                            style={{ fontSize: '7pt', height: 18, padding: '0 6px' }}
                            onClick={() => handleStatusUpdate(d, 'delivered')}
                          >
                            <CheckCircle style={{ width: 9, height: 9 }} /> Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          New Delivery Dialog
          ═══════════════════════════════════════════════════════════ */}
      {newDialogOpen && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setNewDialogOpen(false)}>
          <div className="marg-dialog">
            <div className="marg-dialog-titlebar">
              <span>New Delivery — Create from Invoice</span>
              <button onClick={() => setNewDialogOpen(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              <fieldset className="marg-groupbox" style={{ marginBottom: 4 }}>
                <legend>Select Invoice</legend>
                <div className="marg-field">
                  <span className="marg-label">Invoice *</span>
                  <select
                    className="marg-input"
                    value={selectedInvoice}
                    onChange={e => handleInvoiceSelect(e.target.value)}
                  >
                    <option value="">-- Select Invoice --</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNo} — {inv.customer.name} — {formatINR(inv.totalAmount)}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedInvoice && invoices.find(i => i.id === selectedInvoice) && (
                  <div style={{ fontSize: '7pt', color: '#808080', paddingLeft: 94 }}>
                    Items: {invoices.find(i => i.id === selectedInvoice)?.items?.length ?? 0}
                  </div>
                )}
              </fieldset>

              <fieldset className="marg-groupbox">
                <legend>Delivery Details</legend>
                <div className="marg-field">
                  <span className="marg-label">Patient Name</span>
                  <input className="marg-input" value={newPatientName} onChange={e => setNewPatientName(e.target.value)} placeholder="Optional" />
                </div>
                <div className="marg-field">
                  <span className="marg-label">Address *</span>
                  <input className="marg-input" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Delivery address" />
                </div>
                <div className="marg-field">
                  <span className="marg-label">Phone</span>
                  <input className="marg-input" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Contact phone" />
                </div>
                <div className="marg-field">
                  <span className="marg-label">Notes</span>
                  <input className="marg-input" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Delivery instructions" />
                </div>
              </fieldset>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setNewDialogOpen(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" onClick={handleCreateDelivery} disabled={saving}>
                {saving ? 'Creating...' : 'Create Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Assign Delivery Dialog
          ═══════════════════════════════════════════════════════════ */}
      {assignDialogOpen && selectedDelivery && (
        <div className="marg-dialog-overlay" onClick={e => e.target === e.currentTarget && setAssignDialogOpen(false)}>
          <div className="marg-dialog">
            <div className="marg-dialog-titlebar">
              <span>Assign Delivery — {selectedDelivery.invoice.invoiceNo}</span>
              <button onClick={() => setAssignDialogOpen(false)} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 8 }}>
              <div className="marg-sunken" style={{ padding: '4px 6px', marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: '8pt', color: '#003366', marginBottom: 2 }}>
                  {selectedDelivery.customer.name}
                </div>
                <div style={{ fontSize: '7pt', color: '#808080' }}>
                  Invoice: {selectedDelivery.invoice.invoiceNo} | Amount: {formatINR(selectedDelivery.invoice.totalAmount)} | Items: {selectedDelivery.invoice._count?.items ?? 0}
                </div>
              </div>
              <fieldset className="marg-groupbox">
                <legend>Assign Details</legend>
                <div className="marg-field">
                  <span className="marg-label">Delivery Boy *</span>
                  <input className="marg-input" value={assignBoy} onChange={e => setAssignBoy(e.target.value)} placeholder="Enter delivery boy name" />
                </div>
                <div className="marg-field">
                  <span className="marg-label">COD Amount</span>
                  <input className="marg-input" type="number" value={assignCod} onChange={e => setAssignCod(e.target.value)} placeholder="0.00" />
                </div>
              </fieldset>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setAssignDialogOpen(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" onClick={handleAssign} disabled={saving}>
                {saving ? 'Assigning...' : 'Assign & Mark Ready'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
