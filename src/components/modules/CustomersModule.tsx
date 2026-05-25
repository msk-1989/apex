'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users, Search, ChevronLeft, ChevronRight, Plus, Eye, Pencil,
  X, Trash2, RefreshCw, Printer, Loader2, CheckCircle2
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────
interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  gstNo?: string
  dlNo?: string
  creditLimit: number
  balance: number
  loyaltyPts: number
  type: string
  createdAt: string
  _count?: { salesInvoices: number }
}

interface CustomerForm {
  name: string
  phone: string
  email: string
  address: string
  gstNo: string
  dlNo: string
  type: string
  creditLimit: number
}

// ─── Helpers ────────────────────────────────────────────────────────────
function formatINR(value: number): string {
  return '\u20B9' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ─── Type Badge ─────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    retail: 'marg-badge-green',
    wholesale: 'marg-badge-blue',
    institutional: 'marg-badge-orange',
  }
  return <span className={`marg-badge ${map[type] || 'marg-badge marg-badge-blue'}`}>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
}

// ─── Component ──────────────────────────────────────────────────────────
export default function CustomersModule() {
  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  // Form Dialog
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>({
    name: '', phone: '', email: '', address: '',
    gstNo: '', dlNo: '', type: 'retail', creditLimit: 0,
  })

  // Detail Dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // ─── Data Fetching ───────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(limit))
      if (searchQuery) params.set('search', searchQuery)
      if (typeFilter) params.set('type', typeFilter)

      const res = await fetch(`/api/customers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalItems(data.pagination?.total || 0)
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [page, searchQuery, typeFilter])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { setPage(1) }, [searchQuery, typeFilter])

  // ─── Summary ─────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    total: totalItems,
    retail: customers.filter(c => c.type === 'retail').length,
    wholesale: customers.filter(c => c.type === 'wholesale').length,
    institutional: customers.filter(c => c.type === 'institutional').length,
  }), [customers, totalItems])

  // ─── Form Helpers ────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingCustomer(null)
    setForm({ name: '', phone: '', email: '', address: '', gstNo: '', dlNo: '', type: 'retail', creditLimit: 0 })
    setFormOpen(true)
  }

  const openEdit = (c: Customer) => {
    setEditingCustomer(c)
    setForm({
      name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '',
      gstNo: c.gstNo || '', dlNo: c.dlNo || '', type: c.type, creditLimit: c.creditLimit,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) return

    setSaving(true)
    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers'
      const method = editingCustomer ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined, address: form.address.trim() || undefined,
          gstNo: form.gstNo.trim() || undefined, dlNo: form.dlNo.trim() || undefined,
          type: form.type, creditLimit: form.creditLimit || 0,
        }),
      })
      if (res.ok) {
        setFormOpen(false)
        fetchCustomers()
      }
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  // ─── Detail View ─────────────────────────────────────────────────────
  const openDetail = async (c: Customer) => {
    setSelectedCustomer(c)
    setDetailOpen(true)
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/sales?customerId=${c.id}&limit=10`)
      if (res.ok) setPurchaseHistory((await res.json()).invoices || [])
    } catch { setPurchaseHistory([]) }
    finally { setLoadingHistory(false) }
  }

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="marg-panel flex flex-col h-full">
      {/* Panel Caption */}
      <div className="marg-panel-caption">
        <span>Customer Master — List</span>
        <div className="flex items-center gap-1">
          <button className="marg-btn marg-btn-blue" onClick={openCreate}>
            <Plus className="w-3 h-3" /> New
          </button>
          <button className="marg-btn">
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button className="marg-btn marg-btn-red">
            <Trash2 className="w-3 h-3" /> Delete
          </button>
          <button className="marg-btn marg-btn-red">
            <X className="w-3 h-3" /> Close
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-1 py-1 border-b border-[#808080] bg-white">
        <span style={{ fontWeight: 600, color: '#003366', whiteSpace: 'nowrap' }}>Search:</span>
        <div className="relative flex-1" style={{ maxWidth: 220 }}>
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#808080]" />
          <input
            className="marg-input"
            style={{ paddingLeft: 18 }}
            placeholder="Name, phone, GST..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <span style={{ fontWeight: 600, color: '#003366', whiteSpace: 'nowrap' }}>Type:</span>
        <select
          className="marg-input"
          style={{ width: 110 }}
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
          <option value="institutional">Institutional</option>
        </select>
        <button className="marg-btn marg-btn-blue">
          <Search className="w-3 h-3" /> Find
        </button>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto">
        <table className="marg-grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th style={{ textAlign: 'center' }}>Type</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th style={{ textAlign: 'right' }}>Credit Limit</th>
              <th>GST #</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}>
                      <div className="animate-pulse" style={{ height: 14, background: '#F0F0F0', width: j === 0 ? 120 : 60 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#808080' }}>
                  <Users style={{ width: 24, height: 24, margin: '0 auto 8px', opacity: 0.3 }} />
                  <div>No customers found</div>
                </td>
              </tr>
            ) : customers.map(c => (
              <tr key={c.id} className="cursor-pointer" onClick={() => openDetail(c)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: '#808080' }}>{c._count?.salesInvoices || 0} purchases</div>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{c.phone || '\u2014'}</td>
                <td>{c.email || '\u2014'}</td>
                <td style={{ textAlign: 'center' }}><TypeBadge type={c.type} /></td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: c.balance > 0 ? '#CC0000' : '#006600' }}>
                  {formatINR(c.balance)}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{c.creditLimit > 0 ? formatINR(c.creditLimit) : '\u2014'}</td>
                <td style={{ fontFamily: 'monospace', color: '#808080' }}>{c.gstNo ? c.gstNo.slice(0, 15) + '...' : '\u2014'}</td>
                <td style={{ textAlign: 'center' }}>
                  <div className="flex items-center justify-center gap-0" onClick={e => e.stopPropagation()}>
                    <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} onClick={() => openDetail(c)}>
                      <Eye className="w-3 h-3" />
                    </button>
                    <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} onClick={() => openEdit(c)}>
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      <div className="marg-pager">
        <span style={{ color: '#808080' }}>
          Records: {(page - 1) * limit + 1}\u2013{Math.min(page * limit, totalItems)} of {totalItems}
        </span>
        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
          <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-3 h-3" /> Prev
          </button>
          <span style={{ padding: '0 6px' }}>Page {page} of {totalPages}</span>
          <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="marg-statusbar">
        <span className="sb-section">Total: {totalItems}</span>
        <span className="sb-section">Retail: {summary.retail}</span>
        <span className="sb-section">Wholesale: {summary.wholesale}</span>
        <span className="sb-section">Institutional: {summary.institutional}</span>
        <span className="sb-section" style={{ marginLeft: 'auto' }}>{new Date().toLocaleString('en-IN')}</span>
      </div>

      {/* ─── Add/Edit Customer Dialog ─────────────────────────────────── */}
      {formOpen && (
        <div className="marg-dialog-overlay" onClick={() => setFormOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="marg-dialog-titlebar">
              <span>
                {editingCustomer
                  ? <><Pencil className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />Edit Customer</>
                  : <><Plus className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />New Customer</>
                }
              </span>
              <button className="marg-btn" style={{ padding: '0 4px', height: 16 }} onClick={() => setFormOpen(false)}>
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="marg-dialog-body" style={{ padding: 6 }}>
              {/* Personal Details */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
                <legend>Personal Details</legend>
                <div className="marg-field">
                  <span className="marg-label">Name *</span>
                  <input className="marg-input" placeholder="Customer name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <div className="marg-field flex-1">
                    <span className="marg-label">Phone *</span>
                    <input className="marg-input" placeholder="Phone number" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="marg-field flex-1">
                    <span className="marg-label">Email</span>
                    <input className="marg-input" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
              </fieldset>

              {/* Address & Licenses */}
              <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
                <legend>Address &amp; Licenses</legend>
                <div className="marg-field">
                  <span className="marg-label">Address</span>
                  <input className="marg-input" placeholder="Full address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <div className="marg-field flex-1">
                    <span className="marg-label">GST No</span>
                    <input className="marg-input" placeholder="27AABCC7030Q1ZG" value={form.gstNo} onChange={e => setForm(f => ({ ...f, gstNo: e.target.value.toUpperCase() }))} />
                  </div>
                  <div className="marg-field flex-1">
                    <span className="marg-label">DL No</span>
                    <input className="marg-input" placeholder="DL-2024-MH-12345" value={form.dlNo} onChange={e => setForm(f => ({ ...f, dlNo: e.target.value.toUpperCase() }))} />
                  </div>
                </div>
              </fieldset>

              {/* Classification */}
              <fieldset className="marg-groupbox">
                <legend>Classification</legend>
                <div className="flex gap-2">
                  <div className="marg-field flex-1">
                    <span className="marg-label">Type</span>
                    <select className="marg-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="institutional">Institutional</option>
                    </select>
                  </div>
                  <div className="marg-field flex-1">
                    <span className="marg-label">Credit Limit</span>
                    <input type="number" className="marg-input" placeholder="0" value={form.creditLimit || ''} onChange={e => setForm(f => ({ ...f, creditLimit: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setFormOpen(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" disabled={saving || !form.name.trim() || !form.phone.trim()} onClick={handleSave}>
                {saving
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                  : <><CheckCircle2 className="w-3 h-3" /> {editingCustomer ? 'Update' : 'Save'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail Dialog ────────────────────────────────────────────── */}
      {detailOpen && selectedCustomer && (
        <div className="marg-dialog-overlay" onClick={() => setDetailOpen(false)}>
          <div className="marg-dialog" style={{ minWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="marg-dialog-titlebar">
              <span>
                <Users className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />
                Customer Details \u2014 {selectedCustomer.name} <TypeBadge type={selectedCustomer.type} />
              </span>
              <button className="marg-btn" style={{ padding: '0 4px', height: 16 }} onClick={() => setDetailOpen(false)}>
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="marg-dialog-body" style={{ padding: 6 }}>
              {/* Customer Info */}
              <div className="flex gap-2" style={{ marginBottom: 6 }}>
                <fieldset className="marg-groupbox flex-1">
                  <legend>Contact Info</legend>
                  {selectedCustomer.phone && (
                    <div className="marg-field">
                      <span className="marg-label">Phone:</span>
                      <span style={{ fontFamily: 'monospace' }}>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.email && (
                    <div className="marg-field">
                      <span className="marg-label">Email:</span>
                      <span>{selectedCustomer.email}</span>
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="marg-field">
                      <span className="marg-label">Address:</span>
                      <span>{selectedCustomer.address}</span>
                    </div>
                  )}
                  <div className="marg-field">
                    <span className="marg-label">Since:</span>
                    <span>{formatDate(selectedCustomer.createdAt)}</span>
                  </div>
                </fieldset>

                <fieldset className="marg-groupbox flex-1">
                  <legend>Financial Info</legend>
                  <div className="marg-field">
                    <span className="marg-label">Balance:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: selectedCustomer.balance > 0 ? '#CC0000' : '#006600' }}>
                      {formatINR(selectedCustomer.balance)}
                    </span>
                  </div>
                  <div className="marg-field">
                    <span className="marg-label">Credit Limit:</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatINR(selectedCustomer.creditLimit)}</span>
                  </div>
                  <div className="marg-field">
                    <span className="marg-label">Loyalty Pts:</span>
                    <span style={{ fontWeight: 600 }}>{selectedCustomer.loyaltyPts} pts</span>
                  </div>
                  {selectedCustomer.gstNo && (
                    <div className="marg-field">
                      <span className="marg-label">GST:</span>
                      <span style={{ fontFamily: 'monospace' }}>{selectedCustomer.gstNo}</span>
                    </div>
                  )}
                  {selectedCustomer.dlNo && (
                    <div className="marg-field">
                      <span className="marg-label">DL:</span>
                      <span style={{ fontFamily: 'monospace' }}>{selectedCustomer.dlNo}</span>
                    </div>
                  )}
                </fieldset>
              </div>

              {/* Purchase History */}
              <fieldset className="marg-groupbox">
                <legend>Purchase History ({selectedCustomer._count?.salesInvoices || 0})</legend>
                {loadingHistory ? (
                  <div style={{ textAlign: 'center', padding: 16, color: '#808080' }}>Loading...</div>
                ) : purchaseHistory.length > 0 ? (
                  <div className="marg-sunken" style={{ maxHeight: 192, overflow: 'auto' }}>
                    <table className="marg-grid">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th style={{ textAlign: 'center' }}>Payment</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseHistory.map((inv: any) => (
                          <tr key={inv.id}>
                            <td style={{ fontFamily: 'monospace' }}>{inv.invoiceNo}</td>
                            <td>{formatDate(inv.date)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(inv.totalAmount)}</td>
                            <td style={{ textAlign: 'center' }}>{inv.paymentMode}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`marg-badge ${inv.status === 'completed' ? 'marg-badge-green' : 'marg-badge-orange'}`}>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No purchase history found</div>
                )}
              </fieldset>
            </div>

            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => { setDetailOpen(false); openEdit(selectedCustomer) }}>
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button className="marg-btn marg-btn-blue">
                <Printer className="w-3 h-3" /> Print
              </button>
              <button className="marg-btn" onClick={() => setDetailOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
