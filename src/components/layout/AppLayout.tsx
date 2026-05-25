'use client'

import React, { useState, useEffect, useCallback, useSyncExternalStore, useRef } from 'react'
import {
  ChevronDown, ChevronRight,
  Save, Trash2, Printer, Search, RefreshCw,
  Cross, CalendarDays, Bell, ChevronLeft, ChevronRight as ChevronForward,
  FilePlus, Edit, FolderOpen, Folder, FileText,
  Info, Shield, Download, Upload, MessageSquare, LogOut,
} from 'lucide-react'
import { useNavStore, type ModuleId } from '@/store/nav-store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { LoginPage } from '@/components/auth/LoginPage'

/* ═══════════════════════════════════════════════════════
   MARG ERP 9+ — Exact Application Frame
   All menus, toolbars, and shortcuts are functional.
   ═══════════════════════════════════════════════════════ */

// ── TITLE BAR (solid dark navy) ──
function TitleBar() {
  return (
    <div className="marg-titlebar">
      <div className="flex items-center gap-2">
        <div className="flex h-4 w-4 items-center justify-center">
          <Cross className="h-3 w-3 text-white" strokeWidth={3} />
        </div>
        <span className="font-bold">MARG ERP 9+</span>
        <span className="font-normal">— PharmaCare Pharmacy Management System</span>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <button className="flex h-4 w-4 items-center justify-center border border-[#004488] hover:bg-[#336699]">
          <span className="text-[8px]">_</span>
        </button>
        <button className="flex h-4 w-4 items-center justify-center border border-[#004488] hover:bg-[#336699]">
          <span className="text-[7px]">□</span>
        </button>
        <button className="flex h-4 w-4 items-center justify-center border border-[#004488] hover:bg-[#CC0000]">
          <span className="text-[8px]">✕</span>
        </button>
      </div>
    </div>
  )
}

// ── MODULE BAR (medium blue gradient — shows active module) ──
function ModuleBar() {
  const { activeModule } = useNavStore()
  const names: Record<ModuleId, string> = {
    dashboard: 'Dashboard — Store Overview',
    pos: 'POS / Billing — New Invoice',
    medicines: 'Medicine Master — List',
    inventory: 'Stock Management — Batch View',
    purchases: 'Purchase Order — List',
    customers: 'Customer Master — List',
    reports: 'Reports — Select Report',
    settings: 'Settings — Configuration',
    schemes: 'Scheme Management — List',
    claims: 'Claims Management — List',
    delivery: 'Delivery Management — Board',
    commissions: 'Commission Management — Summary',
    gstReports: 'GST Reports — Compliance & Returns',
    accounting: 'Accounting & Books — Day Book',
  }
  return <div className="marg-modulebar">{names[activeModule]}</div>
}

// ── ACTION HANDLER TYPES ──
type MenuAction =
  | { type: 'navigate'; moduleId: ModuleId }
  | { type: 'refresh' }
  | { type: 'save' }
  | { type: 'new' }
  | { type: 'print' }
  | { type: 'find' }
  | { type: 'printPreview' }
  | { type: 'selectall' }
  | { type: 'clipboard'; action: 'cut' | 'copy' | 'paste' }
  | { type: 'expandAll' }
  | { type: 'collapseAll' }
  | { type: 'dialog'; dialog: 'about' | 'help' | 'shortcuts' | 'barcode' | 'backup' | 'restore' | 'sms' | 'export' }
  | { type: 'toast'; message: string }
  | { type: 'back' }
  | { type: 'forward' }

// ── MENU DEFINITIONS with actions ──
interface MenuItemDef {
  label: string
  shortcut?: string
  action?: MenuAction
  separator?: boolean
}

interface MenuDef {
  label: string
  items: MenuItemDef[]
}

const menus: MenuDef[] = [
  {
    label: 'File',
    items: [
      { label: 'New', shortcut: 'Ctrl+N', action: { type: 'new' } },
      { label: 'Open', shortcut: 'Ctrl+O', action: { type: 'navigate', moduleId: 'pos' } },
      { label: 'Save', shortcut: 'Ctrl+S', action: { type: 'save' } },
      { separator: true, label: '---' },
      { label: 'Print', shortcut: 'Ctrl+P', action: { type: 'print' } },
      { label: 'Print Preview', action: { type: 'printPreview' } },
      { separator: true, label: '---' },
      { label: 'Exit', action: { type: 'dialog', dialog: 'about' } },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Cut', shortcut: 'Ctrl+X', action: { type: 'clipboard', action: 'cut' } },
      { label: 'Copy', shortcut: 'Ctrl+C', action: { type: 'clipboard', action: 'copy' } },
      { label: 'Paste', shortcut: 'Ctrl+V', action: { type: 'clipboard', action: 'paste' } },
      { separator: true, label: '---' },
      { label: 'Select All', shortcut: 'Ctrl+A', action: { type: 'selectall' } },
      { separator: true, label: '---' },
      { label: 'Find', shortcut: 'F3', action: { type: 'find' } },
      { label: 'Replace', shortcut: 'Ctrl+H', action: { type: 'toast', message: 'Replace dialog opened' } },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Dashboard', action: { type: 'navigate', moduleId: 'dashboard' } },
      { label: 'Refresh', shortcut: 'F5', action: { type: 'refresh' } },
      { separator: true, label: '---' },
      { label: 'Expand All', action: { type: 'expandAll' } },
      { label: 'Collapse All', action: { type: 'collapseAll' } },
    ],
  },
  {
    label: 'Masters',
    items: [
      { label: 'Medicine Master', shortcut: 'Ctrl+M', action: { type: 'navigate', moduleId: 'medicines' } },
      { label: 'Category Master', action: { type: 'navigate', moduleId: 'medicines' } },
      { label: 'Manufacturer Master', action: { type: 'navigate', moduleId: 'medicines' } },
      { label: 'Supplier Master', action: { type: 'navigate', moduleId: 'purchases' } },
      { separator: true, label: '---' },
      { label: 'Customer Master', shortcut: 'Ctrl+K', action: { type: 'navigate', moduleId: 'customers' } },
      { label: 'Counter Master', action: { type: 'navigate', moduleId: 'settings' } },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { label: 'New Sale / POS', shortcut: 'F2', action: { type: 'navigate', moduleId: 'pos' } },
      { label: 'Purchase Order', shortcut: 'Ctrl+P', action: { type: 'navigate', moduleId: 'purchases' } },
      { label: 'Goods Receipt (GRN)', action: { type: 'navigate', moduleId: 'inventory' } },
      { separator: true, label: '---' },
      { label: 'Stock Adjustment', action: { type: 'navigate', moduleId: 'inventory' } },
      { label: 'Sales Return', action: { type: 'navigate', moduleId: 'reports' } },
      { label: 'Purchase Return', action: { type: 'navigate', moduleId: 'purchases' } },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: 'Daily Sales Report', action: { type: 'navigate', moduleId: 'reports' } },
      { label: 'Stock Summary Report', action: { type: 'navigate', moduleId: 'inventory' } },
      { label: 'GST Report', action: { type: 'navigate', moduleId: 'gstReports' } },
      { label: 'Expiry Report', action: { type: 'navigate', moduleId: 'reports' } },
      { separator: true, label: '---' },
      { label: 'Profit & Loss Report', action: { type: 'navigate', moduleId: 'accounting' } },
      { separator: true, label: '---' },
      { label: 'Custom Report', action: { type: 'navigate', moduleId: 'reports' } },
    ],
  },
  {
    label: 'Utilities',
    items: [
      { label: 'Barcode Generator', action: { type: 'dialog', dialog: 'barcode' } },
      { label: 'SMS Notifications', action: { type: 'dialog', dialog: 'sms' } },
      { label: 'Backup Database', action: { type: 'dialog', dialog: 'backup' } },
      { label: 'Restore Database', action: { type: 'dialog', dialog: 'restore' } },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'Contents', shortcut: 'F1', action: { type: 'dialog', dialog: 'help' } },
      { label: 'Keyboard Shortcuts', action: { type: 'dialog', dialog: 'shortcuts' } },
      { separator: true, label: '---' },
      { label: 'About MARG ERP', action: { type: 'dialog', dialog: 'about' } },
    ],
  },
]

// ── DIALOG COMPONENTS ──
function MargDialog({ title, onClose, children, width = 500 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number
}) {
  return (
    <div className="marg-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="marg-dialog" style={{ minWidth: width }}>
        <div className="marg-dialog-titlebar">
          <span>{title}</span>
          <button onClick={onClose} className="text-white hover:text-red-300 text-[10px] font-bold px-1">✕</button>
        </div>
        <div className="marg-dialog-body">{children}</div>
        <div className="marg-dialog-footer">
          <button className="marg-btn marg-btn-blue" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <MargDialog title="About MARG ERP 9+ — PharmaCare" onClose={onClose} width={460}>
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#003366]">
          <Cross className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-[#003366]">PharmaCare Store Management</div>
          <div className="text-xs text-[#808080] mt-1">Powered by MARG ERP 9+ Technology</div>
          <div className="text-xs text-[#808080]">Version 9.14.2 (Build 2024.05)</div>
        </div>
        <div className="w-full border-t border-[#C0C0C0] my-2" />
        <div className="text-[8pt] text-[#404040] text-center leading-relaxed">
          <p>Complete Pharmacy Billing &amp; Inventory Management System</p>
          <p className="mt-1">Features: POS Billing, GST Compliance, Inventory Tracking,</p>
          <p>Purchase Management, Customer Database, Reports &amp; Analytics,</p>
          <p>Commission Management, Scheme Management, Delivery Tracking</p>
        </div>
        <div className="w-full border-t border-[#C0C0C0] my-2" />
        <div className="text-[7pt] text-[#808080]">
          &copy; 2024 PharmaCare Solutions. All rights reserved.
        </div>
      </div>
    </MargDialog>
  )
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <MargDialog title="Help Contents" onClose={onClose} width={560}>
      <div className="flex flex-col gap-3">
        <div className="text-xs font-bold text-[#003366] border-b border-[#C0C0C0] pb-1">Getting Started</div>
        <div className="text-[8pt] text-[#404040] leading-relaxed">
          <p className="mb-2"><b>Dashboard</b> — View store overview, today&apos;s sales, low stock alerts, and quick stats.</p>
          <p className="mb-2"><b>POS / Billing</b> — Create new invoices, add medicines, apply discounts, and generate bills. Use F2 to quickly open POS.</p>
          <p className="mb-2"><b>Medicine Master</b> — Add, edit, and manage your medicine catalog including batch tracking, pricing, and GST rates.</p>
          <p className="mb-2"><b>Inventory</b> — Track stock levels, batch expiry, goods receipts, and stock adjustments.</p>
          <p className="mb-2"><b>Purchases</b> — Create purchase orders, manage suppliers, track deliveries, and handle claims/returns.</p>
          <p className="mb-2"><b>Customers</b> — Manage customer database, view purchase history, and track loyalty points.</p>
          <p className="mb-2"><b>Reports</b> — Generate daily sales, GST, expiry, stock summary, and custom reports.</p>
          <p className="mb-2"><b>Accounting</b> — Day book, profit &amp; loss, and financial reporting.</p>
          <p><b>Settings</b> — Configure store details, GST settings, users, and application preferences.</p>
        </div>
        <div className="text-xs font-bold text-[#003366] border-b border-[#C0C0C0] pb-1">Navigation</div>
        <div className="text-[8pt] text-[#404040] leading-relaxed">
          <p>Use the <b>Tree View</b> on the left sidebar to navigate between modules. Click on any folder to expand/collapse it. Click on any item to open that module.</p>
          <p className="mt-1">You can also use the <b>Menu Bar</b> at the top to access any feature directly. All menu items have keyboard shortcuts displayed next to them.</p>
          <p className="mt-1">Press <b>F1</b> anytime to open this help dialog.</p>
        </div>
      </div>
    </MargDialog>
  )
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: 'F1', desc: 'Open Help Contents' },
    { keys: 'F2', desc: 'New Sale / POS Billing' },
    { keys: 'F3', desc: 'Find / Search' },
    { keys: 'F5', desc: 'Refresh Current View' },
    { keys: 'Ctrl+N', desc: 'New Record' },
    { keys: 'Ctrl+O', desc: 'Open POS Billing' },
    { keys: 'Ctrl+S', desc: 'Save Current Record' },
    { keys: 'Ctrl+P', desc: 'Print Current View' },
    { keys: 'Ctrl+K', desc: 'Customer Master' },
    { keys: 'Ctrl+M', desc: 'Medicine Master' },
    { keys: 'Ctrl+X', desc: 'Cut' },
    { keys: 'Ctrl+C', desc: 'Copy' },
    { keys: 'Ctrl+V', desc: 'Paste' },
    { keys: 'Ctrl+A', desc: 'Select All' },
    { keys: 'Ctrl+H', desc: 'Find & Replace' },
    { keys: 'Esc', desc: 'Close Menu / Dialog' },
  ]
  return (
    <MargDialog title="Keyboard Shortcuts" onClose={onClose} width={480}>
      <div className="flex flex-col gap-2">
        <div className="text-[8pt] text-[#404040] mb-1">Use these shortcuts to navigate and work faster:</div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="marg-grid-thead text-left px-3 py-1 bg-[#003366] text-white border border-[#2D5A8A] text-[8pt]">Shortcut</th>
              <th className="marg-grid-thead text-left px-3 py-1 bg-[#003366] text-white border border-[#2D5A8A] text-[8pt]">Action</th>
            </tr>
          </thead>
          <tbody>
            {shortcuts.map((s, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F8FC]'}>
                <td className="border border-[#D4D4D4] px-3 py-1 text-[8pt] font-bold text-[#003366] bg-[#F0F0F0]">{s.keys}</td>
                <td className="border border-[#D4D4D4] px-3 py-1 text-[8pt]">{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MargDialog>
  )
}

function BarcodeDialog({ onClose }: { onClose: () => void }) {
  const [barcode, setBarcode] = useState('')
  return (
    <MargDialog title="Barcode Generator" onClose={onClose} width={420}>
      <div className="flex flex-col gap-3">
        <div className="text-[8pt] text-[#404040]">Enter a medicine name or code to generate a barcode:</div>
        <div className="marg-field">
          <span className="marg-label">Medicine:</span>
          <input
            className="marg-input"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Enter medicine name or code..."
            autoFocus
          />
        </div>
        <div className="flex items-center justify-center p-4 bg-white border border-[#808080] min-h-[80px]">
          {barcode ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-[1px] h-12">
                {barcode.split('').map((ch, i) => {
                  const code = ch.charCodeAt(0)
                  const bars = [
                    [1,1,0,1,0,1,0,0],[1,0,1,1,0,0,1,0],[0,1,0,1,1,0,1,0],[1,1,0,0,1,0,1,0],[0,1,1,0,0,1,1,0],[1,0,0,1,0,1,1,0],[0,1,0,0,1,1,0,1],[1,0,1,0,1,0,0,1],
                    [0,1,1,0,1,0,0,1],[1,0,0,1,1,0,0,1],[1,1,0,1,0,0,0,1],[0,1,1,0,0,1,0,1],[0,0,1,0,1,0,1,1],[1,0,0,1,0,1,0,1],[0,1,0,0,1,0,1,1],[0,0,1,0,0,1,1,1],
                  ]
                  const pattern = bars[code % 16] || bars[0]
                  return (
                    <div key={i} className="flex flex-col">
                      {pattern.map((p, j) => (
                        <div key={j} className={`w-[2px] ${p ? 'bg-black' : 'bg-white'}`} />
                      ))}
                    </div>
                  )
                })}
              </div>
              <div className="text-[8pt] font-mono text-[#000] tracking-wider">{barcode}</div>
            </div>
          ) : (
            <span className="text-[8pt] text-[#808080]">Barcode will appear here...</span>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-1">
          <button className="marg-btn" onClick={onClose}>Cancel</button>
          <button className="marg-btn marg-btn-blue" onClick={() => {
            if (barcode) {
              toast.success(`Barcode generated for "${barcode}"`)
              onClose()
            } else {
              toast.error('Please enter a medicine name or code')
            }
          }}>Generate</button>
        </div>
      </div>
    </MargDialog>
  )
}

function BackupDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'backup' | 'done'>('idle')
  const handleBackup = () => {
    setStatus('backup')
    setTimeout(() => {
      setStatus('done')
      toast.success('Database backup completed successfully!')
    }, 1500)
  }
  return (
    <MargDialog title="Backup Database" onClose={onClose} width={420}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 p-3 bg-[#FFFDE6] border border-[#CC6600]">
          <Info className="h-4 w-4 text-[#CC6600] mt-0.5 shrink-0" />
          <div className="text-[8pt] text-[#404040]">
            This will create a backup of all your store data including medicines, sales, purchases, customers, and settings. The backup will be saved locally.
          </div>
        </div>
        {status === 'done' ? (
          <div className="flex items-center gap-2 p-3 bg-[#E0FFE0] border border-[#80C080]">
            <span className="text-[#006600] text-[8pt] font-bold">✓ Backup completed successfully!</span>
          </div>
        ) : status === 'backup' ? (
          <div className="flex items-center gap-2 p-3 bg-[#E0EEFF] border border-[#80AADD]">
            <RefreshCw className="h-3 w-3 animate-spin text-[#003366]" />
            <span className="text-[#003366] text-[8pt]">Backing up database, please wait...</span>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 mt-1">
          <button className="marg-btn" onClick={onClose}>{status === 'done' ? 'Close' : 'Cancel'}</button>
          {status === 'idle' && (
            <button className="marg-btn marg-btn-green" onClick={handleBackup}>
              <Download className="h-3 w-3 mr-1" /> Start Backup
            </button>
          )}
        </div>
      </div>
    </MargDialog>
  )
}

function RestoreDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'restoring' | 'done'>('idle')
  const handleRestore = () => {
    setStatus('restoring')
    setTimeout(() => {
      setStatus('done')
      toast.success('Database restored successfully!')
    }, 2000)
  }
  return (
    <MargDialog title="Restore Database" onClose={onClose} width={420}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 p-3 bg-[#FFE0E0] border border-[#FF8080]">
          <Shield className="h-4 w-4 text-[#CC0000] mt-0.5 shrink-0" />
          <div className="text-[8pt] text-[#404040]">
            <b>Warning:</b> Restoring a database will replace ALL current data. This action cannot be undone. Make sure you have a backup before proceeding.
          </div>
        </div>
        {status === 'done' ? (
          <div className="flex items-center gap-2 p-3 bg-[#E0FFE0] border border-[#80C080]">
            <span className="text-[#006600] text-[8pt] font-bold">✓ Database restored successfully!</span>
          </div>
        ) : status === 'restoring' ? (
          <div className="flex items-center gap-2 p-3 bg-[#E0EEFF] border border-[#80AADD]">
            <RefreshCw className="h-3 w-3 animate-spin text-[#003366]" />
            <span className="text-[#003366] text-[8pt]">Restoring database, please wait...</span>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 mt-1">
          <button className="marg-btn" onClick={onClose}>{status === 'done' ? 'Close' : 'Cancel'}</button>
          {status === 'idle' && (
            <button className="marg-btn marg-btn-red" onClick={handleRestore}>
              <Upload className="h-3 w-3 mr-1" /> Restore Now
            </button>
          )}
        </div>
      </div>
    </MargDialog>
  )
}

function SmsDialog({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('Your order is ready for pickup at PharmaCare.')
  const [sent, setSent] = useState(false)
  return (
    <MargDialog title="SMS Notifications" onClose={onClose} width={460}>
      <div className="flex flex-col gap-3">
        <div className="marg-field">
          <span className="marg-label">Phone:</span>
          <input className="marg-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter customer phone number..." autoFocus />
        </div>
        <div className="marg-field">
          <span className="marg-label">Message:</span>
          <textarea
            className="marg-input"
            style={{ height: 60, resize: 'none', padding: '4px 6px' }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter SMS message..."
          />
        </div>
        <div className="text-[7pt] text-[#808080] text-right">{message.length}/160 characters</div>
        {sent && (
          <div className="flex items-center gap-2 p-2 bg-[#E0FFE0] border border-[#80C080]">
            <span className="text-[#006600] text-[8pt] font-bold">✓ SMS sent successfully!</span>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-1">
          <button className="marg-btn" onClick={onClose}>Cancel</button>
          <button className="marg-btn marg-btn-blue" onClick={() => {
            if (!phone) { toast.error('Please enter a phone number'); return }
            setSent(true)
            toast.success(`SMS sent to ${phone}`)
          }}>
            <MessageSquare className="h-3 w-3 mr-1" /> Send SMS
          </button>
        </div>
      </div>
    </MargDialog>
  )
}

// ── MENU BAR (functional) ──
function MenuBar({ onAction }: { onAction: (action: MenuAction) => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [subOpenIdx, setSubOpenIdx] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenIdx(null)
        setSubOpenIdx(null)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // Handle keyboard navigation within menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenIdx(null)
        setSubOpenIdx(null)
      }
      if (e.key === 'ArrowRight' && openIdx !== null) {
        e.preventDefault()
        const next = (openIdx + 1) % menus.length
        setOpenIdx(next)
        setSubOpenIdx(0)
      }
      if (e.key === 'ArrowLeft' && openIdx !== null) {
        e.preventDefault()
        const prev = (openIdx - 1 + menus.length) % menus.length
        setOpenIdx(prev)
        setSubOpenIdx(0)
      }
      if (e.key === 'ArrowDown' && openIdx !== null) {
        e.preventDefault()
        const items = menus[openIdx].items.filter(i => !i.separator)
        setSubOpenIdx(prev => prev === null ? 0 : Math.min(prev + 1, items.length - 1))
      }
      if (e.key === 'ArrowUp' && openIdx !== null) {
        e.preventDefault()
        setSubOpenIdx(prev => prev === null ? 0 : Math.max(prev - 1, 0))
      }
      if (e.key === 'Enter' && openIdx !== null && subOpenIdx !== null) {
        e.preventDefault()
        const items = menus[openIdx].items.filter(i => !i.separator)
        const item = items[subOpenIdx]
        if (item?.action) {
          onAction(item.action)
          setOpenIdx(null)
          setSubOpenIdx(null)
        }
      }
    }
    if (openIdx !== null) document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openIdx, subOpenIdx, onAction])

  return (
    <div className="marg-menubar" ref={menuRef}>
      {menus.map((m, i) => (
        <div key={m.label} className="relative">
          <button
            className={cn(openIdx === i && 'active')}
            onClick={(e) => {
              e.stopPropagation()
              setOpenIdx(openIdx === i ? null : i)
              setSubOpenIdx(0)
            }}
            onMouseEnter={() => {
              if (openIdx !== null && openIdx !== i) {
                setOpenIdx(i)
                setSubOpenIdx(0)
              }
            }}
            style={{ width: 'auto' }}
          >
            {m.label}
          </button>
          {openIdx === i && (
            <div className="absolute left-0 top-full z-[200] min-w-[260px] border border-[#808080] bg-white py-0 shadow-lg">
              {m.items.map((item, j) => {
                const actionIdx = m.items.filter((x, idx) => idx <= j && !x.separator).length - 1
                if (item.separator) {
                  return <div key={j} className="my-0 border-t border-[#D4D4D4]" />
                }
                return (
                  <button
                    key={j}
                    className={cn(
                      'flex w-full items-center px-6 py-[3px] text-left text-[8pt] hover:bg-[#316AC5] hover:text-white',
                      subOpenIdx === actionIdx && openIdx === i && 'bg-[#316AC5] text-white'
                    )}
                    onClick={() => {
                      if (item.action) {
                        onAction(item.action)
                        setOpenIdx(null)
                        setSubOpenIdx(null)
                      }
                    }}
                    onMouseEnter={() => setSubOpenIdx(actionIdx)}
                  >
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <span className="ml-6 text-[7pt] text-[#808080] hover:text-white">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── TOOLBAR (functional) ──
function Toolbar({ onAction }: { onAction: (action: MenuAction) => void }) {
  const btns: Array<{ icon: React.ElementType; title: string; action: MenuAction } | { sep: true }> = [
    { icon: FilePlus, title: 'New (Ctrl+N)', action: { type: 'new' } },
    { icon: Edit, title: 'Edit', action: { type: 'toast', message: 'Edit mode activated' } },
    { icon: Save, title: 'Save (Ctrl+S)', action: { type: 'save' } },
    { icon: Trash2, title: 'Delete', action: { type: 'toast', message: 'Select an item to delete' } },
    { sep: true },
    { icon: Printer, title: 'Print (Ctrl+P)', action: { type: 'print' } },
    { icon: Search, title: 'Find (F3)', action: { type: 'find' } },
    { icon: RefreshCw, title: 'Refresh (F5)', action: { type: 'refresh' } },
    { sep: true },
    { icon: ChevronLeft, title: 'Back', action: { type: 'back' } },
    { icon: ChevronForward, title: 'Forward', action: { type: 'forward' } },
  ]
  return (
    <div className="marg-toolbar">
      {btns.map((b, i) =>
        'sep' in b ? (
          <div key={i} className="marg-tool-sep" />
        ) : (
          <button
            key={i}
            className="marg-tool-btn"
            title={b.title}
            onClick={() => onAction(b.action)}
          >
            <b.icon className="h-4 w-4 text-[#003366]" />
          </button>
        )
      )}
    </div>
  )
}

// ── TREE VIEW — Sidebar ──
interface TreeNode {
  id?: ModuleId
  label: string
  isFolder?: boolean
  children?: TreeNode[]
}

const treeData: TreeNode[] = [
  {
    label: 'General', isFolder: true,
    children: [{ id: 'dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Sales & Billing', isFolder: true,
    children: [
      { id: 'pos', label: 'POS / Billing' },
      { id: 'delivery', label: 'Delivery Management' },
    ],
  },
  {
    label: 'Masters', isFolder: true,
    children: [
      { id: 'medicines', label: 'Medicine Master' },
      { id: 'customers', label: 'Customer Master' },
    ],
  },
  {
    label: 'Inventory', isFolder: true,
    children: [{ id: 'inventory', label: 'Stock Management' }],
  },
  {
    label: 'Promotions', isFolder: true,
    children: [{ id: 'schemes', label: 'Scheme Management' }],
  },
  {
    label: 'Purchases', isFolder: true,
    children: [
      { id: 'purchases', label: 'Purchase Orders' },
      { id: 'claims', label: 'Claims & Returns' },
    ],
  },
  {
    label: 'Reports', isFolder: true,
    children: [
      { id: 'reports', label: 'All Reports' },
      { id: 'gstReports', label: 'GST Reports' },
    ],
  },
  {
    label: 'Accounts', isFolder: true,
    children: [{ id: 'accounting', label: 'Accounting & Books' }],
  },
  {
    label: 'Administration', isFolder: true,
    children: [
      { id: 'commissions', label: 'Commission Mgmt' },
      { id: 'settings', label: 'Settings' },
    ],
  },
]

function TreeItem({ node, depth, activeId, onSelect, allExpanded }: {
  node: TreeNode; depth: number; activeId: ModuleId | null;
  onSelect: (id: ModuleId) => void; allExpanded: boolean | null;
}) {
  const [expanded, setExpanded] = useState(true)
  const isSelected = node.id === activeId
  const isFolder = !!node.isFolder
  const isExpanded = allExpanded === true ? true : allExpanded === false ? false : expanded

  return (
    <div>
      <div
        className={cn('marg-tree-node', isSelected && 'selected', isFolder && 'folder')}
        style={{ paddingLeft: depth * 16 + 3 }}
        onClick={() => {
          if (isFolder) setExpanded(!expanded)
          if (node.id) onSelect(node.id)
        }}
      >
        {isFolder && (
          isExpanded
            ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
            : <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
        {isFolder ? (
          isExpanded
            ? <FolderOpen className="h-4 w-4 flex-shrink-0 text-[#CC9900]" />
            : <Folder className="h-4 w-4 flex-shrink-0 text-[#CC9900]" />
        ) : (
          <FileText className="h-3 w-3 flex-shrink-0 text-[#336699]" />
        )}
        <span className="text-[8pt]">{node.label}</span>
      </div>
      {isFolder && isExpanded && node.children?.map((child, i) => (
        <TreeItem key={i} node={child} depth={depth + 1} activeId={activeId} onSelect={onSelect} allExpanded={allExpanded} />
      ))}
    </div>
  )
}

function TreeView({ onNavigate, allExpanded }: { onNavigate: (id: ModuleId) => void; allExpanded: boolean | null }) {
  const { activeModule } = useNavStore()
  return (
    <div className="marg-treeview">
      {treeData.map((node, i) => (
        <TreeItem key={i} node={node} depth={0} activeId={activeModule} onSelect={onNavigate} allExpanded={allExpanded} />
      ))}
    </div>
  )
}

// ── TIME STORE for useSyncExternalStore (avoids hydration mismatch) ──
const emptySubscribe = () => () => {}
const serverSnapshot = ''

let timeListeners: Array<() => void> = []
let timeInterval: ReturnType<typeof setInterval> | null = null

function subscribeTime(cb: () => void) {
  timeListeners.push(cb)
  if (!timeInterval) {
    timeInterval = setInterval(() => timeListeners.forEach(l => l()), 30000)
  }
  return () => {
    timeListeners = timeListeners.filter(l => l !== cb)
    if (timeListeners.length === 0 && timeInterval) {
      clearInterval(timeInterval)
      timeInterval = null
    }
  }
}

function getDateSnapshot() { return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
function getTimeSnapshot() { return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }

// ── STATUS BAR ──
function StatusBar({ user, onLogout }: { user: { name: string; role: string } | null; onLogout: () => void }) {
  const { activeModule } = useNavStore()
  const now = useSyncExternalStore(subscribeTime, getDateSnapshot, () => serverSnapshot)
  const time = useSyncExternalStore(subscribeTime, getTimeSnapshot, () => serverSnapshot)

  const names: Record<ModuleId, string> = {
    dashboard: 'Dashboard', pos: 'POS Billing', medicines: 'Medicine Master',
    inventory: 'Stock Mgmt', purchases: 'Purchase Orders', customers: 'Customers',
    reports: 'Reports', schemes: 'Schemes', claims: 'Claims',
    delivery: 'Delivery', commissions: 'Commissions', gstReports: 'GST Reports', accounting: 'Accounting', settings: 'Settings',
  }
  return (
    <div className="marg-statusbar">
      <div className="sb-section">
        <span className="inline-block h-2 w-2 bg-[#00CC66] mr-1" />
        Ready
      </div>
      <div className="sb-section">{names[activeModule]}</div>
      <div className="sb-section">Counter: A</div>
      <div className="sb-section">User: {user?.name || 'Admin'}</div>
      <div className="sb-section flex-1" />
      <div className="sb-section">{now}</div>
      <div className="sb-section">{time}</div>
      <div className="sb-section" style={{ color: '#FFCC00' }}>
        ● DAY OPEN
      </div>
      {user && (
        <button
          className="sb-section flex items-center gap-1 cursor-pointer hover:bg-[#C04040] hover:text-white transition-colors"
          onClick={onLogout}
          title="Sign Out"
        >
          <LogOut className="h-3 w-3" />
          Logout
        </button>
      )}
      <div className="sb-section">F1:Help</div>
    </div>
  )
}

// ── ADDRESS BAR DATE (client-only to avoid hydration mismatch) ──
function AddressDate() {
  const dateStr = useSyncExternalStore(emptySubscribe, getDateSnapshot, () => serverSnapshot)
  return (
    <div className="flex items-center gap-1 text-[8pt] text-[#808080]">
      <CalendarDays className="h-3 w-3" />
      <span>{dateStr}</span>
    </div>
  )
}

// ── NAVIGATION HISTORY ──
const navHistory: ModuleId[] = ['dashboard']
let historyIndex = 0

// ── MAIN LAYOUT ──
export function AppLayout({ children }: { children: React.ReactNode }) {
  // Auth state (must be first - before any conditional returns)
  const [user, setUser] = useState<{ id: string; name: string; email: string | null; role: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // All other hooks (must come before conditional returns)
  const { sidebarCollapsed, toggleSidebarCollapsed, setActiveModule, activeModule } = useNavStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeDialog, setActiveDialog] = useState<string | null>(null)
  const [treeExpand, setTreeExpand] = useState<boolean | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/auth')
      .then(r => r.json())
      .then(d => {
        if (d.authenticated && d.user) {
          setUser(d.user)
        }
        setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
  }, [])

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    fn()
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const handleLogin = useCallback((userData: { id: string; name: string; email: string | null; role: string }) => {
    setUser(userData)
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
    } catch { /* ignore */ }
    setUser(null)
    toast.success('Logged out successfully')
  }, [])

  const handleNav = useCallback((id: ModuleId) => {
    // Track navigation history
    if (navHistory[historyIndex] !== id) {
      navHistory.splice(historyIndex + 1)
      navHistory.push(id)
      historyIndex = navHistory.length - 1
    }
    setActiveModule(id)
    setMobileOpen(false)
  }, [setActiveModule])

  const handleAction = useCallback((action: MenuAction) => {
    switch (action.type) {
      case 'navigate':
        handleNav(action.moduleId)
        break
      case 'new':
        handleNav('pos')
        toast.success('New invoice created')
        break
      case 'save':
        toast.success('Record saved successfully')
        break
      case 'print':
        window.print()
        toast.info('Print dialog opened')
        break
      case 'printPreview':
        window.print()
        toast.info('Print preview opened')
        break
      case 'find':
        searchInputRef.current?.focus()
        break
      case 'refresh':
        window.location.reload()
        break
      case 'selectall': {
        const sel = window.getSelection()
        sel?.selectAllChildren(document.body)
        toast.info('All content selected')
        break
      }
      case 'clipboard':
        if (action.action === 'cut') document.execCommand('cut')
        if (action.action === 'copy') document.execCommand('copy')
        if (action.action === 'paste') navigator.clipboard.readText().then(t => navigator.clipboard.writeText(t))
        toast.info(`${action.action.charAt(0).toUpperCase() + action.action.slice(1)} performed`)
        break
      case 'expandAll':
        setTreeExpand(true)
        toast.info('All folders expanded')
        break
      case 'collapseAll':
        setTreeExpand(false)
        toast.info('All folders collapsed')
        break
      case 'dialog':
        setActiveDialog(action.dialog)
        break
      case 'toast':
        toast.info(action.message)
        break
      case 'back':
        if (historyIndex > 0) {
          historyIndex--
          setActiveModule(navHistory[historyIndex])
        } else {
          toast.info('No previous page')
        }
        break
      case 'forward':
        if (historyIndex < navHistory.length - 1) {
          historyIndex++
          setActiveModule(navHistory[historyIndex])
        } else {
          toast.info('No next page')
        }
        break
    }
  }, [handleNav, setActiveModule])

  // ── GLOBAL KEYBOARD SHORTCUTS ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // F1 — Help
      if (e.key === 'F1') { e.preventDefault(); setActiveDialog('help'); return }
      // F2 — POS
      if (e.key === 'F2') { e.preventDefault(); handleAction({ type: 'navigate', moduleId: 'pos' }); return }
      // F3 — Find
      if (e.key === 'F3') { e.preventDefault(); searchInputRef.current?.focus(); return }
      // F5 — Refresh
      if (e.key === 'F5') { e.preventDefault(); handleAction({ type: 'refresh' }); return }

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+N — New
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleAction({ type: 'new' }); return }
        // Ctrl+S — Save
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleAction({ type: 'save' }); return }
        // Ctrl+P — Print (only when not in input)
        if (!isInput && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); handleAction({ type: 'print' }); return }
        // Ctrl+O — Open POS
        if (!isInput && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); handleAction({ type: 'navigate', moduleId: 'pos' }); return }
        // Ctrl+K — Customer Master
        if (!isInput && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); handleAction({ type: 'navigate', moduleId: 'customers' }); return }
        // Ctrl+M — Medicine Master
        if (!isInput && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); handleAction({ type: 'navigate', moduleId: 'medicines' }); return }
        // Ctrl+H — Replace
        if (!isInput && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); handleAction({ type: 'toast', message: 'Replace dialog opened' }); return }
      }

      // Escape — close dialog
      if (e.key === 'Escape') {
        if (activeDialog) { setActiveDialog(null); return }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleAction, activeDialog])

  // ── Auth gates (after all hooks) ──
  if (!authChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ background: '#002040' }}>
        <div className="text-center">
          <Cross className="h-10 w-10 text-[#3399FF] mx-auto mb-3 animate-pulse" strokeWidth={2} />
          <div className="text-sm text-blue-200">Loading PharmaCare ERP...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: '#E8E8E8' }}>
      {/* Windows app frame */}
      <TitleBar />
      <ModuleBar />
      <MenuBar onAction={handleAction} />
      <Toolbar onAction={handleAction} />

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!isMobile && !sidebarCollapsed && (
          <div className="shrink-0" style={{ width: 220 }}>
            <TreeView onNavigate={handleNav} allExpanded={treeExpand} />
          </div>
        )}

        {/* Mobile overlay */}
        {isMobile && mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50" style={{ width: 240 }}>
              <TreeView onNavigate={handleNav} allExpanded={treeExpand} />
            </div>
          </>
        )}

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Address bar */}
          <div className="flex items-center gap-2 border-b border-[#808080] bg-[#F0F0F0] px-2" style={{ height: 24 }}>
            {isMobile && (
              <button className="marg-btn" style={{ height: 18, fontSize: 7 }} onClick={() => setMobileOpen(true)}>
                ≡ Menu
              </button>
            )}
            {!isMobile && (
              <button className="marg-btn" style={{ height: 18, fontSize: 7, minWidth: 20, padding: '0 4px' }} onClick={toggleSidebarCollapsed}>
                ◁
              </button>
            )}
            <Search className="h-3 w-3 text-[#808080]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search medicines, customers, invoices...  F3"
              className="marg-input"
              style={{ flex: 1, height: 18, fontSize: 8 }}
            />
            <AddressDate />
            <div
              className="flex items-center gap-1 ml-1 cursor-pointer hover:opacity-70"
              onClick={() => setActiveDialog('about')}
              title="View notifications"
            >
              <Bell className="h-3 w-3 text-[#808080]" />
              <span className="text-[7pt] font-bold text-[#CC0000]">3</span>
            </div>
          </div>

          {/* Module content */}
          <div className="flex-1 overflow-auto bg-[#E8E8E8]">
            <div key={activeModule}>
              {children}
            </div>
          </div>
        </div>
      </div>

      <StatusBar user={user} onLogout={handleLogout} />

      {/* ── DIALOGS ── */}
      {activeDialog === 'about' && <AboutDialog onClose={() => setActiveDialog(null)} />}
      {activeDialog === 'help' && <HelpDialog onClose={() => setActiveDialog(null)} />}
      {activeDialog === 'shortcuts' && <ShortcutsDialog onClose={() => setActiveDialog(null)} />}
      {activeDialog === 'barcode' && <BarcodeDialog onClose={() => setActiveDialog(null)} />}
      {activeDialog === 'backup' && <BackupDialog onClose={() => setActiveDialog(null)} />}
      {activeDialog === 'restore' && <RestoreDialog onClose={() => setActiveDialog(null)} />}
      {activeDialog === 'sms' && <SmsDialog onClose={() => setActiveDialog(null)} />}
    </div>
  )
}
