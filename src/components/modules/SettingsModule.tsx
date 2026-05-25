'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Store, CalendarDays, Monitor, Users, Percent, Printer, Plus, Pencil,
  Power, PowerOff, Save, RotateCcw, X, LogIn, LogOut,
  Banknote, CreditCard, Smartphone, Loader2
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────
interface CounterItem {
  id: string
  name: string
  code: string
  isActive: boolean
  createdAt: string
}

interface StaffMember {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: 'admin' | 'pharmacist' | 'salesman' | 'accountant'
  isActive: boolean
  lastLogin: string | null
  createdAt: string
}

interface DayBookEntry {
  id: string
  counter: string
  date: string
  openingCash: number
  totalSales: number
  actualCash: number
  difference: number
  status: 'open' | 'closed'
  openedAt: string
  closedAt: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────
function formatINR(value: number): string {
  return '\u20B9' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  admin: { label: 'Admin', cls: 'marg-badge-red' },
  pharmacist: { label: 'Pharmacist', cls: 'marg-badge-green' },
  salesman: { label: 'Salesman', cls: 'marg-badge-blue' },
  accountant: { label: 'Accountant', cls: 'marg-badge-orange' },
}

// ─── Store Profile Section ──────────────────────────────────────────────
function StoreProfileSection() {
  const [profile, setProfile] = useState({
    storeName: '', address: '', phone: '', email: '',
    gstNo: '', drugLicenseNo: '', pharmacyRegNo: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings?type=store_profile')
      .then(r => r.json())
      .then(d => { setProfile(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings?type=store_profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
      })
      if (res.ok) { /* saved */ }
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const update = (field: string, value: string) => setProfile(prev => ({ ...prev, [field]: value }))

  if (loading) {
    return <div style={{ padding: 6 }}><div className="animate-pulse" style={{ height: 160, background: '#F0F0F0' }} /></div>
  }

  return (
    <div style={{ padding: 6 }}>
      <fieldset className="marg-groupbox">
        <legend>Store Information</legend>
        <div className="marg-field">
          <span className="marg-label">Store Name:</span>
          <input className="marg-input" placeholder="PharmaCare Medical Store" value={profile.storeName} onChange={e => update('storeName', e.target.value)} />
        </div>
        <div className="marg-field">
          <span className="marg-label">Address:</span>
          <input className="marg-input" placeholder="123 Main Street, City" value={profile.address} onChange={e => update('address', e.target.value)} />
        </div>
        <div className="flex gap-2">
          <div className="marg-field flex-1">
            <span className="marg-label">Phone:</span>
            <input className="marg-input" placeholder="9876543210" value={profile.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          <div className="marg-field flex-1">
            <span className="marg-label">Email:</span>
            <input className="marg-input" placeholder="pharma@example.com" value={profile.email} onChange={e => update('email', e.target.value)} />
          </div>
        </div>
        <div className="marg-field">
          <span className="marg-label">GST No:</span>
          <input className="marg-input" placeholder="27AABCC7030Q1ZG" value={profile.gstNo} onChange={e => update('gstNo', e.target.value.toUpperCase())} />
        </div>
        <div className="marg-field">
          <span className="marg-label">DL No:</span>
          <input className="marg-input" placeholder="DL-2024-MH-12345" value={profile.drugLicenseNo} onChange={e => update('drugLicenseNo', e.target.value.toUpperCase())} />
        </div>
        <div className="marg-field">
          <span className="marg-label">Reg No:</span>
          <input className="marg-input" placeholder="REG-MH-2024-67890" value={profile.pharmacyRegNo} onChange={e => update('pharmacyRegNo', e.target.value.toUpperCase())} />
        </div>
      </fieldset>
      <div className="flex justify-end gap-1" style={{ marginTop: 6 }}>
        <button className="marg-btn" onClick={() => setProfile({ storeName: '', address: '', phone: '', email: '', gstNo: '', drugLicenseNo: '', pharmacyRegNo: '' })}>
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
        <button className="marg-btn marg-btn-blue" disabled={saving} onClick={handleSave}>
          {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><Save className="w-3 h-3" /> Save</>}
        </button>
      </div>
    </div>
  )
}

// ─── Day Management Section ─────────────────────────────────────────────
function DayManagementSection() {
  const [dayStatus, setDayStatus] = useState<'open' | 'closed' | 'none'>('none')
  const [dayBooks, setDayBooks] = useState<DayBookEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showOpenDialog, setShowOpenDialog] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [openForm, setOpenForm] = useState({ cash: '0', card: '0', upi: '0', counterId: '' })
  const [closeForm, setCloseForm] = useState({ actualCash: '0', counterId: '' })

  const fetchData = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([fetch('/api/settings?type=day_status'), fetch('/api/settings?type=day_history')])
      if (s.ok) setDayStatus((await s.json()).status || 'none')
      if (h.ok) setDayBooks(await h.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleOpen = async () => {
    setOpening(true)
    try {
      const res = await fetch('/api/settings?type=open_day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: openForm.counterId, openingCash: parseFloat(openForm.cash) || 0, openingCard: parseFloat(openForm.card) || 0, openingUPI: parseFloat(openForm.upi) || 0 }),
      })
      if (res.ok) { setDayStatus('open'); setShowOpenDialog(false); setOpenForm({ cash: '0', card: '0', upi: '0', counterId: '' }); fetchData() }
    } catch { /* silent */ }
    finally { setOpening(false) }
  }

  const handleClose = async () => {
    setClosing(true)
    try {
      const res = await fetch('/api/settings?type=close_day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterId: closeForm.counterId, actualCash: parseFloat(closeForm.actualCash) || 0 }),
      })
      if (res.ok) { setDayStatus('closed'); setShowCloseDialog(false); setCloseForm({ actualCash: '0', counterId: '' }); fetchData() }
    } catch { /* silent */ }
    finally { setClosing(false) }
  }

  return (
    <div style={{ padding: 6 }}>
      {/* Status */}
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>Day Status</legend>
        <div className="flex items-center gap-2">
          <span className={`marg-badge ${dayStatus === 'open' ? 'marg-badge-green' : dayStatus === 'closed' ? 'marg-badge-blue' : 'marg-badge-orange'}`}>
            {dayStatus === 'open' ? 'Day is Open' : dayStatus === 'closed' ? 'Day is Closed' : 'Not Started'}
          </span>
          <button className="marg-btn marg-btn-blue" disabled={dayStatus === 'open'} onClick={() => setShowOpenDialog(true)}>
            <LogIn className="w-3 h-3" /> Open Day
          </button>
          <button className="marg-btn marg-btn-red" disabled={dayStatus !== 'open'} onClick={() => setShowCloseDialog(true)}>
            <LogOut className="w-3 h-3" /> Close Day
          </button>
        </div>
      </fieldset>

      {/* Day Book History */}
      <fieldset className="marg-groupbox">
        <legend>Day Book History ({dayBooks.length})</legend>
        <div className="marg-sunken" style={{ maxHeight: 256, overflow: 'auto' }}>
          <table className="marg-grid">
            <thead>
              <tr>
                <th>Date</th><th>Counter</th><th style={{ textAlign: 'right' }}>Opening</th>
                <th style={{ textAlign: 'right' }}>Sales</th><th style={{ textAlign: 'right' }}>Actual</th>
                <th style={{ textAlign: 'right' }}>Diff</th><th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {dayBooks.map(e => (
                <tr key={e.id}>
                  <td>{formatDate(e.date)}</td>
                  <td>{e.counter}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(e.openingCash)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatINR(e.totalSales)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatINR(e.actualCash)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: e.difference < 0 ? '#CC0000' : e.difference > 0 ? '#CC6600' : '#808080' }}>
                    {e.difference < 0 ? '(' : ''}{formatINR(Math.abs(e.difference))}{e.difference < 0 ? ')' : ''}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`marg-badge ${e.status === 'closed' ? 'marg-badge-green' : 'marg-badge-orange'}`}>
                      {e.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </td>
                </tr>
              ))}
              {dayBooks.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </fieldset>

      {/* Open Day Dialog */}
      {showOpenDialog && (
        <div className="marg-dialog-overlay" onClick={() => setShowOpenDialog(false)}>
          <div className="marg-dialog" style={{ minWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="marg-dialog-titlebar">
              <span><LogIn className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />Open Day</span>
              <button className="marg-btn" style={{ padding: '0 4px', height: 16 }} onClick={() => setShowOpenDialog(false)}>
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 6 }}>
              <div className="marg-field">
                <span className="marg-label">Counter:</span>
                <select className="marg-input" value={openForm.counterId} onChange={e => setOpenForm(p => ({ ...p, counterId: e.target.value }))}>
                  <option value="">Select</option>
                  <option value="counter-1">Counter 1</option>
                  <option value="counter-2">Counter 2</option>
                  <option value="counter-3">Counter 3</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="marg-field flex-1">
                  <span className="marg-label"><Banknote className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />Cash:</span>
                  <input type="number" className="marg-input" value={openForm.cash} onChange={e => setOpenForm(p => ({ ...p, cash: e.target.value }))} />
                </div>
                <div className="marg-field flex-1">
                  <span className="marg-label"><CreditCard className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />Card:</span>
                  <input type="number" className="marg-input" value={openForm.card} onChange={e => setOpenForm(p => ({ ...p, card: e.target.value }))} />
                </div>
                <div className="marg-field flex-1">
                  <span className="marg-label"><Smartphone className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />UPI:</span>
                  <input type="number" className="marg-input" value={openForm.upi} onChange={e => setOpenForm(p => ({ ...p, upi: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setShowOpenDialog(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" disabled={!openForm.counterId || opening} onClick={handleOpen}>
                {opening ? 'Opening...' : <><LogIn className="w-3 h-3" /> Open Day</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Day Dialog */}
      {showCloseDialog && (
        <div className="marg-dialog-overlay" onClick={() => setShowCloseDialog(false)}>
          <div className="marg-dialog" style={{ minWidth: 350 }} onClick={e => e.stopPropagation()}>
            <div className="marg-dialog-titlebar">
              <span><LogOut className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />Close Day</span>
              <button className="marg-btn" style={{ padding: '0 4px', height: 16 }} onClick={() => setShowCloseDialog(false)}>
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 6 }}>
              <div className="marg-field">
                <span className="marg-label">Counter:</span>
                <select className="marg-input" value={closeForm.counterId} onChange={e => setCloseForm(p => ({ ...p, counterId: e.target.value }))}>
                  <option value="">Select</option>
                  <option value="counter-1">Counter 1</option>
                  <option value="counter-2">Counter 2</option>
                  <option value="counter-3">Counter 3</option>
                </select>
              </div>
              <div className="marg-field">
                <span className="marg-label">Actual Cash:</span>
                <input type="number" className="marg-input" value={closeForm.actualCash} onChange={e => setCloseForm(p => ({ ...p, actualCash: e.target.value }))} />
              </div>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setShowCloseDialog(false)}>Cancel</button>
              <button className="marg-btn marg-btn-red" disabled={!closeForm.counterId || closing} onClick={handleClose}>
                {closing ? 'Closing...' : <><LogOut className="w-3 h-3" /> Close Day</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Counter Management Section ─────────────────────────────────────────
function CounterManagementSection() {
  const [counters, setCounters] = useState<CounterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<CounterItem | null>(null)
  const [form, setForm] = useState({ name: '', code: '' })

  const fetchCounters = useCallback(async () => {
    try {
      const res = await fetch('/api/settings?type=counters')
      if (res.ok) setCounters(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchCounters() }, [fetchCounters])

  const handleSave = async () => {
    const url = editing ? `/api/settings?type=counters&id=${editing.id}` : '/api/settings?type=counters'
    try {
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (res.ok) { setShowDialog(false); setEditing(null); setForm({ name: '', code: '' }); fetchCounters() }
    } catch { /* silent */ }
  }

  const toggleActive = async (c: CounterItem) => {
    try {
      const res = await fetch(`/api/settings?type=counters&id=${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !c.isActive }) })
      if (res.ok) fetchCounters()
    } catch { /* silent */ }
  }

  return (
    <div style={{ padding: 6 }}>
      <fieldset className="marg-groupbox">
        <legend>
          Billing Counters ({counters.length})
          <button className="marg-btn marg-btn-blue" style={{ marginLeft: 8, padding: '0 6px', height: 16 }} onClick={() => { setEditing(null); setForm({ name: '', code: '' }); setShowDialog(true) }}>
            <Plus className="w-3 h-3" /> Add Counter
          </button>
        </legend>
        <table className="marg-grid">
          <thead>
            <tr><th>Name</th><th>Code</th><th style={{ textAlign: 'center' }}>Status</th><th>Created</th><th style={{ textAlign: 'center' }}>Actions</th></tr>
          </thead>
          <tbody>
            {counters.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}><Monitor className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />{c.name}</td>
                <td style={{ fontFamily: 'monospace' }}>{c.code}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`marg-badge ${c.isActive ? 'marg-badge-green' : 'marg-badge-orange'}`}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{formatDate(c.createdAt)}</td>
                <td style={{ textAlign: 'center' }}>
                  <div className="flex items-center justify-center gap-0">
                    <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} onClick={() => { setEditing(c); setForm({ name: c.name, code: c.code }); setShowDialog(true) }}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} onClick={() => toggleActive(c)}>
                      {c.isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {counters.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No counters configured</td></tr>}
          </tbody>
        </table>
      </fieldset>

      {showDialog && (
        <div className="marg-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="marg-dialog" style={{ minWidth: 350 }} onClick={e => e.stopPropagation()}>
            <div className="marg-dialog-titlebar">
              <span>{editing ? 'Edit Counter' : 'Add Counter'}</span>
              <button className="marg-btn" style={{ padding: '0 4px', height: 16 }} onClick={() => setShowDialog(false)}>
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 6 }}>
              <div className="marg-field">
                <span className="marg-label">Name:</span>
                <input className="marg-input" placeholder="e.g., Main Counter" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="marg-field">
                <span className="marg-label">Code:</span>
                <input className="marg-input" placeholder="e.g., CTR-01" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
              </div>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setShowDialog(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" disabled={!form.name || !form.code} onClick={handleSave}>
                <Save className="w-3 h-3" /> {editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Staff Management Section ────────────────────────────────────────────
function StaffManagementSection() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'salesman' as string, password: '' })

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/settings?type=staff')
      if (res.ok) setStaff(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { fetchStaff() }, [fetchStaff])

  const handleSave = async () => {
    const url = editing ? `/api/settings?type=staff&id=${editing.id}` : '/api/settings?type=staff'
    const body: Record<string, string> = { ...form }
    if (editing && !body.password) delete body.password

    try {
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { setShowDialog(false); setEditing(null); setForm({ name: '', email: '', phone: '', role: 'salesman', password: '' }); fetchStaff() }
    } catch { /* silent */ }
  }

  const toggleStatus = async (m: StaffMember) => {
    try {
      const res = await fetch(`/api/settings?type=staff&id=${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !m.isActive }) })
      if (res.ok) fetchStaff()
    } catch { /* silent */ }
  }

  return (
    <div style={{ padding: 6 }}>
      <fieldset className="marg-groupbox">
        <legend>
          Staff Members ({staff.length})
          <button className="marg-btn marg-btn-blue" style={{ marginLeft: 8, padding: '0 6px', height: 16 }} onClick={() => { setEditing(null); setForm({ name: '', email: '', phone: '', role: 'salesman', password: '' }); setShowDialog(true) }}>
            <Plus className="w-3 h-3" /> Add Staff
          </button>
        </legend>
        <div className="marg-sunken" style={{ maxHeight: 320, overflow: 'auto' }}>
          <table className="marg-grid">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th style={{ textAlign: 'center' }}>Role</th><th style={{ textAlign: 'center' }}>Last Login</th><th style={{ textAlign: 'center' }}>Status</th><th style={{ textAlign: 'center' }}>Actions</th></tr>
            </thead>
            <tbody>
              {staff.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>
                    <span className="marg-sunken" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 18, marginRight: 4, fontSize: '7pt', fontWeight: 700 }}>
                      {m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                    {m.name}
                  </td>
                  <td style={{ color: '#808080' }}>{m.email || '\u2014'}</td>
                  <td>{m.phone || '\u2014'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`marg-badge ${ROLE_CONFIG[m.role]?.cls || 'marg-badge marg-badge-blue'}`}>
                      {ROLE_CONFIG[m.role]?.label || m.role}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', color: '#808080' }}>
                    {m.lastLogin ? formatDate(m.lastLogin) : 'Never'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`marg-badge ${m.isActive ? 'marg-badge-green' : 'marg-badge-orange'}`}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="flex items-center justify-center gap-0">
                      <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} onClick={() => { setEditing(m); setForm({ name: m.name, email: m.email || '', phone: m.phone || '', role: m.role, password: '' }); setShowDialog(true) }}>
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button className="marg-btn" style={{ padding: '0 4px', height: 18 }} onClick={() => toggleStatus(m)}>
                        {m.isActive ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 16, color: '#808080' }}>No staff found</td></tr>}
            </tbody>
          </table>
        </div>
      </fieldset>

      {showDialog && (
        <div className="marg-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="marg-dialog" style={{ minWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="marg-dialog-titlebar">
              <span>{editing ? 'Edit Staff' : 'Add Staff'}</span>
              <button className="marg-btn" style={{ padding: '0 4px', height: 16 }} onClick={() => setShowDialog(false)}>
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="marg-dialog-body" style={{ padding: 6 }}>
              <div className="marg-field">
                <span className="marg-label">Full Name:</span>
                <input className="marg-input" placeholder="Enter name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <div className="marg-field flex-1">
                  <span className="marg-label">Email:</span>
                  <input className="marg-input" placeholder="email@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="marg-field flex-1">
                  <span className="marg-label">Phone:</span>
                  <input className="marg-input" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="marg-field">
                <span className="marg-label">Role:</span>
                <select className="marg-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="salesman">Salesman</option>
                  <option value="accountant">Accountant</option>
                </select>
              </div>
              <div className="marg-field">
                <span className="marg-label">Password{editing && <span style={{ fontWeight: 400, color: '#808080' }}> (blank=keep)</span>}:</span>
                <input type="password" className="marg-input" placeholder={editing ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'Enter password'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>
            <div className="marg-dialog-footer">
              <button className="marg-btn" onClick={() => setShowDialog(false)}>Cancel</button>
              <button className="marg-btn marg-btn-blue" disabled={!form.name || (!editing && !form.password)} onClick={handleSave}>
                <Save className="w-3 h-3" /> {editing ? 'Update' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tax Settings Section ───────────────────────────────────────────────
function TaxSettingsSection() {
  const [tax, setTax] = useState({ defaultGstRate: '5', gstCalculationMode: 'exclusive', roundOffMode: 'nearest' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings?type=tax_settings')
      .then(r => r.json())
      .then(d => { setTax({ defaultGstRate: String(d.defaultGstRate || 5), gstCalculationMode: d.gstCalculationMode || 'exclusive', roundOffMode: d.roundOffMode || 'nearest' }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings?type=tax_settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tax, defaultGstRate: parseFloat(tax.defaultGstRate) }),
      })
      if (res.ok) { /* saved */ }
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 6 }}><div className="animate-pulse" style={{ height: 128, background: '#F0F0F0' }} /></div>

  return (
    <div style={{ padding: 6 }}>
      <fieldset className="marg-groupbox">
        <legend>Tax Configuration</legend>
        <div className="marg-field">
          <span className="marg-label">Default GST Rate:</span>
          <select className="marg-input" style={{ width: 100 }} value={tax.defaultGstRate} onChange={v => setTax(p => ({ ...p, defaultGstRate: v.target.value }))}>
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18">18%</option>
            <option value="28">28%</option>
          </select>
        </div>
        <div className="marg-field">
          <span className="marg-label">Calculation Mode:</span>
          <select className="marg-input" style={{ width: 180 }} value={tax.gstCalculationMode} onChange={v => setTax(p => ({ ...p, gstCalculationMode: v.target.value }))}>
            <option value="exclusive">Exclusive (Add GST)</option>
            <option value="inclusive">Inclusive (GST included)</option>
          </select>
        </div>
        <div className="marg-field">
          <span className="marg-label">Round-off Mode:</span>
          <select className="marg-input" style={{ width: 140 }} value={tax.roundOffMode} onChange={v => setTax(p => ({ ...p, roundOffMode: v.target.value }))}>
            <option value="nearest">Nearest</option>
            <option value="up">Round Up</option>
            <option value="down">Round Down</option>
          </select>
        </div>
      </fieldset>
      <div className="flex justify-end gap-1" style={{ marginTop: 6 }}>
        <button className="marg-btn marg-btn-blue" disabled={saving} onClick={handleSave}>
          {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><Save className="w-3 h-3" /> Save</>}
        </button>
      </div>
    </div>
  )
}

// ─── Print Settings Section ─────────────────────────────────────────────
function PrintSettingsSection() {
  const [print, setPrint] = useState({
    invoiceHeader: '', invoiceFooter: 'Thank you for shopping with us!',
    printAlignment: 'center' as string, billFormat: 'thermal' as string,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings?type=print_settings')
      .then(r => r.json())
      .then(d => {
        if (d) setPrint({ invoiceHeader: d.invoiceHeader || '', invoiceFooter: d.invoiceFooter || 'Thank you for shopping with us!', printAlignment: d.printAlignment || 'center', billFormat: d.billFormat || 'thermal' })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings?type=print_settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(print),
      })
      if (res.ok) { /* saved */ }
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 6 }}><div className="animate-pulse" style={{ height: 128, background: '#F0F0F0' }} /></div>

  return (
    <div style={{ padding: 6 }}>
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>Print Configuration</legend>
        <div className="marg-field">
          <span className="marg-label">Header Text:</span>
          <input className="marg-input" placeholder="Invoice header line" value={print.invoiceHeader} onChange={e => setPrint(p => ({ ...p, invoiceHeader: e.target.value }))} />
        </div>
        <div className="marg-field">
          <span className="marg-label">Footer Text:</span>
          <input className="marg-input" placeholder="Thank you message" value={print.invoiceFooter} onChange={e => setPrint(p => ({ ...p, invoiceFooter: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <div className="marg-field flex-1">
            <span className="marg-label">Alignment:</span>
            <select className="marg-input" value={print.printAlignment} onChange={e => setPrint(p => ({ ...p, printAlignment: e.target.value }))}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div className="marg-field flex-1">
            <span className="marg-label">Bill Format:</span>
            <select className="marg-input" value={print.billFormat} onChange={e => setPrint(p => ({ ...p, billFormat: e.target.value }))}>
              <option value="thermal">Thermal (80mm)</option>
              <option value="a4">A4 Full Page</option>
              <option value="half_page">Half Page (A5)</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* Preview */}
      <fieldset className="marg-groupbox" style={{ marginBottom: 6 }}>
        <legend>Bill Preview</legend>
        <div style={{
          border: '1px solid #808080', background: '#FFFFFF', padding: 10, textAlign: print.printAlignment as 'left' | 'center' | 'right',
          fontFamily: 'monospace', fontSize: '8pt', lineHeight: '1.6',
          maxWidth: print.billFormat === 'thermal' ? 280 : '100%',
          margin: '0 auto',
        }}>
          <div style={{ fontWeight: 700, fontSize: '9pt', marginBottom: 4 }}>{print.invoiceHeader || 'Your Store Name'}</div>
          <div style={{ borderBottom: '1px dashed #808080', margin: '4px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Invoice: INV-001</span><span>Date: {new Date().toLocaleDateString('en-IN')}</span>
          </div>
          <div>Item 1 \u00D7 2 = \u20B9200.00</div>
          <div>Item 2 \u00D7 1 = \u20B9150.00</div>
          <div style={{ borderTop: '1px solid #808080', marginTop: 4, paddingTop: 4, fontWeight: 700 }}>
            Total: \u20B9350.00
          </div>
          <div style={{ marginTop: 8, color: '#808080' }}>{print.invoiceFooter}</div>
        </div>
      </fieldset>

      <div className="flex justify-end gap-1">
        <button className="marg-btn" onClick={() => window.print()}>
          <Printer className="w-3 h-3" /> Test Print
        </button>
        <button className="marg-btn marg-btn-blue" disabled={saving} onClick={handleSave}>
          {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><Save className="w-3 h-3" /> Save</>}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────
export default function SettingsModule() {
  const [activeTab, setActiveTab] = useState('store_profile')

  const tabs = [
    { key: 'store_profile', label: 'Store Profile', icon: Store },
    { key: 'day_mgmt', label: 'Day Mgmt', icon: CalendarDays },
    { key: 'counters', label: 'Counters', icon: Monitor },
    { key: 'staff', label: 'Staff', icon: Users },
    { key: 'tax', label: 'Tax', icon: Percent },
    { key: 'print', label: 'Print', icon: Printer },
  ]

  return (
    <div className="marg-panel flex flex-col h-full">
      {/* Panel Caption */}
      <div className="marg-panel-caption">
        <span>
          <Store className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />
          Settings
        </span>
      </div>

      {/* Tab Strip */}
      <div className="marg-tabstrip">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              className={`marg-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <Icon className="w-3 h-3 inline mr-1" style={{ verticalAlign: 'middle' }} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto" style={{ background: '#FFFFFF' }}>
        {activeTab === 'store_profile' && <StoreProfileSection />}
        {activeTab === 'day_mgmt' && <DayManagementSection />}
        {activeTab === 'counters' && <CounterManagementSection />}
        {activeTab === 'staff' && <StaffManagementSection />}
        {activeTab === 'tax' && <TaxSettingsSection />}
        {activeTab === 'print' && <PrintSettingsSection />}
      </div>

      {/* Status Bar */}
      <div className="marg-statusbar">
        <span className="sb-section">Settings: {tabs.find(t => t.key === activeTab)?.label}</span>
        <span className="sb-section" style={{ marginLeft: 'auto' }}>{new Date().toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}
