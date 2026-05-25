'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import {
  Bell, BellRing, X, CheckCircle, AlertTriangle,
  AlertCircle, Info, ShoppingCart, Package, ArrowUpDown,
  Eye, ExternalLink, TrendingUp, DollarSign, Clock
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  todaySales: number
  todayInvoices: number
  lowStockCount: number
  expiringSoonCount: number
  totalMedicines: number
  totalCustomers: number
  monthlySales: { month: string; total: number; count: number }[]
  recentSales: {
    id: string
    invoiceNo: string
    date: string
    totalAmount: number
    paymentMode: string
    status: string
    customer: { name: string }
    items: { medicine: { name: string } }[]
  }[]
  topSellingMedicines: {
    name: string
    quantity: number
    revenue: number
    category: string
  }[]
  categoryWiseSales: { category: string; total: number; count: number }[]
  expiryAlerts: {
    id: string
    name: string
    batchNo: string
    expiryDate: string
    daysRemaining: number
  }[]
}

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  module: string | null
  priority: string
  isRead: boolean
  isDismissed: boolean
  referenceId: string | null
  createdAt: string
}

interface PurchaseSuggestion {
  id: string
  name: string
  category: string
  manufacturer: string
  currentStock: number
  reorderPoint: number
  reorderQty: number
  minStockLevel: number
  deficit: number
  urgency: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PIE_COLORS = ['#003366', '#336699', '#6699CC', '#996633', '#006633']

const tooltipStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #808080',
  fontSize: '8pt',
  padding: '3px 6px',
  lineHeight: '1.3',
  fontFamily: 'Tahoma, sans-serif',
}

const NOTIFICATION_PRIORITY: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }> = {
  info: { color: '#003366', bg: '#E0EEFF', border: '#80AADD', icon: Info },
  warning: { color: '#CC6600', bg: '#FFF0D0', border: '#FFB060', icon: AlertTriangle },
  critical: { color: '#CC0000', bg: '#FFE0E0', border: '#FF8080', icon: AlertCircle },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return (
    '\u20B9' +
    value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

function formatCompact(value: number): string {
  if (value >= 100000) return '\u20B9' + (value / 100000).toFixed(1) + 'L'
  if (value >= 1000) return '\u20B9' + (value / 1000).toFixed(1) + 'K'
  return '\u20B9' + value.toString()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDate()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[d.getMonth()]
  const yr = d.getFullYear().toString().slice(-2)
  return day + " " + mon + " '" + yr
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return diffMins + 'm ago'
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return diffHours + 'h ago'
  const diffDays = Math.floor(diffHours / 24)
  return diffDays + 'd ago'
}

function getPaymentBadge(mode: string): string {
  switch (mode) {
    case 'cash': return 'marg-badge marg-badge-green'
    case 'card': return 'marg-badge marg-badge-blue'
    case 'upi': return 'marg-badge marg-badge-orange'
    default: return 'marg-badge marg-badge-blue'
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'completed': return 'marg-badge marg-badge-green'
    case 'returned':
    case 'cancelled': return 'marg-badge marg-badge-red'
    default: return 'marg-badge marg-badge-blue'
  }
}

function getExpiryBadge(days: number): string {
  if (days < 30) return 'marg-badge marg-badge-red'
  if (days < 60) return 'marg-badge marg-badge-orange'
  return 'marg-badge marg-badge-blue'
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DashboardModule() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  // Purchase suggestions
  const [purchaseSuggestions, setPurchaseSuggestions] = useState<PurchaseSuggestion[]>([])
  const [purchaseTotalBelow, setPurchaseTotalBelow] = useState(0)

  // Credit overdue
  const [creditOverdueCount, setCreditOverdueCount] = useState(0)
  const [creditOverdueAmount, setCreditOverdueAmount] = useState(0)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Server error: ' + res.status)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifs(true)
    try {
      const res = await fetch('/api/notifications?isRead=false&limit=5')
      if (res.ok) {
        const json = await res.json()
        setNotifications(json.notifications || [])
        setUnreadCount(json.unreadCount ?? 0)
      }
    } catch {
      /* silent */
    } finally {
      setLoadingNotifs(false)
    }
  }, [])

  const fetchPurchaseSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/purchase-suggestions')
      if (res.ok) {
        const json = await res.json()
        setPurchaseSuggestions((json.suggestions || []).slice(0, 5))
        setPurchaseTotalBelow(json.totalItemsBelowReorder ?? 0)
      }
    } catch {
      /* silent */
    }
  }, [])

  const fetchCreditOverdue = useCallback(async () => {
    try {
      const res = await fetch('/api/customers?limit=100')
      if (res.ok) {
        const json = await res.json()
        const overdue = (json.customers || []).filter(
          (c: { balance: number; creditLimit: number }) => c.balance > c.creditLimit && c.creditLimit > 0
        )
        setCreditOverdueCount(overdue.length)
        setCreditOverdueAmount(overdue.reduce((s: number, c: { balance: number }) => s + c.balance, 0))
      }
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    fetchNotifications()
    fetchPurchaseSuggestions()
    fetchCreditOverdue()
  }, [fetchDashboard, fetchNotifications, fetchPurchaseSuggestions, fetchCreditOverdue])

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to mark as read')
    }
  }

  // ─── Loading State ───────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="marg-panel" style={{ padding: '12px 16px', textAlign: 'center', color: '#808080' }}>
        Loading...
      </div>
    )
  }

  // ─── Error State ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="marg-panel" style={{ padding: '12px 16px' }}>
        <div style={{ color: '#CC0000', fontWeight: 700 }}>Error: {error}</div>
        <button className="marg-btn" onClick={fetchDashboard} style={{ marginTop: '6px' }}>
          Retry
        </button>
      </div>
    )
  }

  const totalYearSales = data.monthlySales.reduce((s, m) => s + m.total, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* ═══════════════════════════════════════════════════════════
          Notification Panel (overlay)
          ═══════════════════════════════════════════════════════════ */}
      {notifPanelOpen && (
        <>
          <div
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 90,
            }}
            onClick={() => setNotifPanelOpen(false)}
          />
          <div
            style={{
              position: 'absolute', top: 0, right: 0, zIndex: 100,
              width: 320, maxHeight: '100%', background: '#F0F0F0',
              border: '1px solid #808080', display: 'flex', flexDirection: 'column',
              boxShadow: '2px 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {/* Title */}
            <div style={{
              background: 'linear-gradient(180deg, #004D99 0%, #003366 100%)',
              color: '#FFFFFF', padding: '4px 8px', fontWeight: 700, fontSize: '8pt',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Notifications ({unreadCount} unread)</span>
              <button
                onClick={() => setNotifPanelOpen(false)}
                style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
            {/* Actions */}
            <div style={{ padding: '4px 6px', borderBottom: '1px solid #C0C0C0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="marg-btn"
                style={{ fontSize: '7pt', height: 18, padding: '0 6px' }}
                onClick={handleMarkAllRead}
              >
                <CheckCircle style={{ width: 9, height: 9 }} /> Mark All Read
              </button>
            </div>
            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#C0C0C0', fontSize: '8pt' }}>
                  No new notifications
                </div>
              ) : (
                notifications.map(n => {
                  const pConfig = NOTIFICATION_PRIORITY[n.priority] || NOTIFICATION_PRIORITY.info
                  const IconComp = pConfig.icon
                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: '5px 8px', borderBottom: '1px solid #E8E8E8',
                        borderLeft: '3px solid ' + pConfig.color, background: pConfig.bg,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <IconComp style={{ width: 12, height: 12, color: pConfig.color, flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '8pt', color: pConfig.color, marginBottom: 1 }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: '7pt', color: '#404040', lineHeight: '1.3' }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: '7pt', color: '#C0C0C0', marginTop: 2 }}>
                            {timeAgo(n.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Top Bar: Store Summary + Notification Bell
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '3px', flex: '0 0 auto' }}>
        {/* Store Summary KPIs */}
        <div className="marg-panel" style={{ flex: 1 }}>
          <div className="marg-panel-caption">
            <span>Store Summary</span>
            <span style={{ fontSize: '7pt', fontWeight: 400 }}>
              {data.totalMedicines} Medicines &middot; {data.totalCustomers} Customers
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1px', background: '#808080' }}>
            <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
              <div className="marg-kpi-value">{formatCurrency(data.todaySales)}</div>
              <div className="marg-kpi-label">Today&apos;s Sales</div>
            </div>
            <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
              <div className="marg-kpi-value">{data.todayInvoices}</div>
              <div className="marg-kpi-label">Today&apos;s Invoices</div>
            </div>
            <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
              <div className="marg-kpi-value" style={{ color: data.lowStockCount > 0 ? '#CC0000' : '#006600' }}>
                {data.lowStockCount}
              </div>
              <div className="marg-kpi-label">Low Stock</div>
            </div>
            <div className="marg-kpi" style={{ flex: 1, textAlign: 'center' }}>
              <div className="marg-kpi-value" style={{ color: data.expiringSoonCount > 0 ? '#CC6600' : '#006600' }}>
                {data.expiringSoonCount}
              </div>
              <div className="marg-kpi-label">Expiring Soon</div>
            </div>
          </div>
        </div>

        {/* Notification Bell */}
        <div
          style={{
            width: 200, background: '#FFFFFF', border: '1px solid #808080',
            display: 'flex', flexDirection: 'column', cursor: 'pointer',
          }}
          onClick={() => { setNotifPanelOpen(!notifPanelOpen); if (!notifPanelOpen) fetchNotifications() }}
        >
          <div style={{
            background: 'linear-gradient(180deg, #5A8ABF 0%, #336699 100%)',
            color: '#FFFFFF', padding: '3px 6px', fontWeight: 700, fontSize: '8pt',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span style={{
                background: '#CC0000', color: '#FFFFFF', fontSize: '7pt', fontWeight: 700,
                padding: '0 4px', lineHeight: '14px',
              }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
            {unreadCount > 0 ? (
              <BellRing style={{ width: 16, height: 16, color: '#CC0000' }} />
            ) : (
              <Bell style={{ width: 16, height: 16, color: '#003366' }} />
            )}
            <div style={{ flex: 1, fontSize: '7pt' }}>
              {unreadCount > 0 ? (
                <span style={{ color: '#CC0000', fontWeight: 600 }}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</span>
              ) : (
                <span style={{ color: '#808080' }}>No new notifications</span>
              )}
            </div>
            <ExternalLink style={{ width: 10, height: 10, color: '#808080' }} />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Alert Strips: Expiry + Credit Overdue
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '3px', flex: '0 0 auto' }}>
        {/* Expiry Alert Strip */}
        <div
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 6px', background: '#FFF0D0', border: '1px solid #CC9900',
            fontSize: '8pt', cursor: 'pointer',
          }}
          onClick={() => toast.info('Navigate to Inventory module to view expiry alerts')}
        >
          <AlertTriangle style={{ width: 12, height: 12, color: '#CC6600', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: '#CC6600' }}>
            Expiry Alert: {data.expiringSoonCount} item{data.expiringSoonCount !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#808080', fontSize: '7pt' }}>
            expiring within 90 days
          </span>
          <Eye style={{ width: 10, height: 10, color: '#808080', marginLeft: 'auto' }} />
        </div>

        {/* Credit Overdue Alert Strip */}
        <div
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 6px', background: '#FFE8E8', border: '1px solid #CC0000',
            fontSize: '8pt', cursor: 'pointer',
          }}
          onClick={() => toast.info('Navigate to Customers module to view overdue payments')}
        >
          <AlertCircle style={{ width: 12, height: 12, color: '#CC0000', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: '#CC0000' }}>
            Credit Overdue: {creditOverdueCount} customer{creditOverdueCount !== 1 ? 's' : ''}
          </span>
          <span style={{ color: '#808080', fontSize: '7pt' }}>
            outstanding {formatCurrency(creditOverdueAmount)}
          </span>
          <Eye style={{ width: 10, height: 10, color: '#808080', marginLeft: 'auto' }} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Quick Actions Panel
          ═══════════════════════════════════════════════════════════ */}
      <div className="marg-panel" style={{ flex: '0 0 auto' }}>
        <div className="marg-panel-caption">
          <span>Quick Actions</span>
        </div>
        <div style={{ display: 'flex', gap: '2px', padding: '4px' }}>
          {[
            { label: 'New Sale (F2)', icon: ShoppingCart, action: () => toast.info('Navigate to POS module — press F2'), color: '#006600' },
            { label: 'New Purchase Order', icon: Package, action: () => toast.info('Navigate to Purchases module'), color: '#003366' },
            { label: 'Stock Adjustment', icon: ArrowUpDown, action: () => toast.info('Navigate to Inventory module'), color: '#336699' },
            { label: 'View Expiry Alerts', icon: AlertTriangle, action: () => toast.info('Navigate to Inventory module — Expiry tab'), color: '#CC6600' },
            { label: 'View Low Stock', icon: Eye, action: () => toast.info('Navigate to Inventory module — Low Stock filter'), color: '#CC0000' },
          ].map((qa) => (
            <button
              key={qa.label}
              className="marg-btn"
              style={{ flex: 1, justifyContent: 'center', gap: 3, fontSize: '7pt', height: 22, borderLeftColor: qa.color }}
              onClick={qa.action}
            >
              <qa.icon style={{ width: 11, height: 11, color: qa.color }} />
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Charts Row
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '3px', flex: '0 0 auto' }}>
        {/* Monthly Sales Trend — Bar Chart */}
        <div className="marg-panel" style={{ flex: '2', display: 'flex', flexDirection: 'column' }}>
          <div className="marg-panel-caption">
            <span>Monthly Sales Trend</span>
            <span style={{ fontSize: '7pt', fontWeight: 400 }}>
              12-Month Total: {formatCompact(totalYearSales)}
            </span>
          </div>
          <div style={{ padding: '4px 6px', height: '200px', flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.monthlySales}
                margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#D4D4D4" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: '7pt', fontFamily: 'Tahoma' }}
                  tickLine={false}
                  axisLine={{ stroke: '#808080' }}
                />
                <YAxis
                  tick={{ fontSize: '7pt', fontFamily: 'Tahoma' }}
                  tickLine={false}
                  axisLine={{ stroke: '#808080' }}
                  tickFormatter={(v: number) => formatCompact(v)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatCurrency(value), 'Sales']}
                  labelStyle={{ fontWeight: 700, fontFamily: 'Tahoma' }}
                />
                <Bar dataKey="total" fill="#003366" maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category-wise Sales — Pie Chart */}
        <div className="marg-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
          <div className="marg-panel-caption">
            <span>Category-wise Sales</span>
          </div>
          <div style={{ padding: '4px 6px', height: '160px', flex: '0 0 auto' }}>
            {data.categoryWiseSales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryWiseSales}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={56}
                    paddingAngle={1}
                    dataKey="total"
                    nameKey="category"
                    strokeWidth={1}
                    stroke="#FFFFFF"
                  >
                    {data.categoryWiseSales.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    labelStyle={{ fontWeight: 700, fontFamily: 'Tahoma' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#808080' }}>
                No category data
              </div>
            )}
          </div>
          <div style={{ padding: '2px 6px 4px', borderTop: '1px solid #D4D4D4', display: 'flex', flexWrap: 'wrap', gap: '1px 10px' }}>
            {data.categoryWiseSales.map((cat, i) => (
              <span key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '7pt', lineHeight: '14px', whiteSpace: 'nowrap' }}>
                <span style={{ width: '7px', height: '7px', background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block', flexShrink: 0, border: '1px solid #808080' }} />
                {cat.category} ({cat.count})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Recent Sales Table
          ═══════════════════════════════════════════════════════════ */}
      <div className="marg-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="marg-panel-caption">
          <span>Recent Sales</span>
          <span className="marg-badge marg-badge-blue">
            {data.recentSales.length} invoice{data.recentSales.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="marg-grid">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'center' }}>Mode</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentSales.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#808080', padding: '16px' }}>
                    No sales data available
                  </td>
                </tr>
              ) : (
                data.recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td style={{ fontFamily: 'Tahoma', fontSize: '8pt' }}>{sale.invoiceNo}</td>
                    <td>{formatDate(sale.date)}</td>
                    <td>{sale.customer?.name || 'Walk-in'}</td>
                    <td style={{ textAlign: 'center' }}>{sale.items.length}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(sale.totalAmount)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={getPaymentBadge(sale.paymentMode)}>
                        {sale.paymentMode === 'upi' ? 'UPI' : sale.paymentMode.charAt(0).toUpperCase() + sale.paymentMode.slice(1)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={getStatusBadge(sale.status)}>
                        {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Bottom Row: Top Selling + Expiry Alerts + Purchase Suggestions
          ═══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '3px', flex: '0 0 auto' }}>
        {/* Top Selling Medicines */}
        <div className="marg-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="marg-panel-caption">
            <span>Top Selling Medicines</span>
            <span style={{ fontSize: '7pt', fontWeight: 400 }}>By quantity sold</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '160px' }}>
            {data.topSellingMedicines.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#808080' }}>
                No sales data available
              </div>
            ) : (
              data.topSellingMedicines.map((med, i) => (
                <div key={med.name} style={{ display: 'flex', alignItems: 'center', padding: '2px 6px', borderBottom: '1px solid #E8E8E8', gap: '4px', lineHeight: '18px' }}>
                  <span style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < 3 ? '#003366' : '#F0F0F0', color: i < 3 ? '#FFFFFF' : '#000', fontWeight: 700, fontSize: '7pt', flexShrink: 0, border: '1px solid ' + (i < 3 ? '#002244' : '#C0C0C0') }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {med.name}
                    <span style={{ color: '#808080', marginLeft: '4px', fontSize: '7pt' }}>
                      {med.category}
                    </span>
                  </span>
                  <span style={{ color: '#808080', minWidth: '28px', textAlign: 'right', fontSize: '8pt' }}>
                    {med.quantity}
                  </span>
                  <span style={{ fontWeight: 600, color: '#003366', minWidth: '60px', textAlign: 'right', fontSize: '8pt' }}>
                    {formatCurrency(med.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expiry Alerts */}
        <div className="marg-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="marg-panel-caption">
            <span style={{ color: '#FFD700' }}>&#9888; Expiry Alerts</span>
            <span className="marg-badge marg-badge-red">
              {data.expiringSoonCount} item{data.expiringSoonCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '160px' }}>
            {data.expiryAlerts.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#808080' }}>
                No items expiring soon
              </div>
            ) : (
              data.expiryAlerts.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '2px 6px', borderBottom: '1px solid #E8E8E8', gap: '4px', lineHeight: '18px' }}>
                  <span style={{ width: '8px', height: '8px', background: item.daysRemaining < 30 ? '#CC0000' : item.daysRemaining < 60 ? '#CC6600' : '#003366', flexShrink: 0, border: '1px solid ' + (item.daysRemaining < 30 ? '#990000' : item.daysRemaining < 60 ? '#994400' : '#002244') }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                    <span style={{ color: '#808080', marginLeft: '4px', fontSize: '7pt' }}>
                      {item.batchNo}
                    </span>
                  </span>
                  <span className={getExpiryBadge(item.daysRemaining)}>
                    {item.daysRemaining} days
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Purchase Suggestions Widget */}
        <div className="marg-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="marg-panel-caption">
            <span>Purchase Suggestions</span>
            <span style={{ fontSize: '7pt', fontWeight: 400 }}>
              {purchaseTotalBelow} items need reorder
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '160px' }}>
            {purchaseSuggestions.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#808080' }}>
                All items well stocked
              </div>
            ) : (
              purchaseSuggestions.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '2px 6px', borderBottom: '1px solid #E8E8E8', gap: '4px', lineHeight: '18px' }}>
                  {/* Urgency indicator */}
                  <span style={{
                    width: '8px', height: '8px', flexShrink: 0,
                    background: item.urgency === 'critical' ? '#CC0000' : item.urgency === 'high' ? '#CC6600' : '#336699',
                    border: '1px solid ' + (item.urgency === 'critical' ? '#990000' : item.urgency === 'high' ? '#994400' : '#1A3355'),
                  }} />
                  {/* Name + Category */}
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                    <span style={{ color: '#808080', marginLeft: '4px', fontSize: '7pt' }}>
                      {item.category}
                    </span>
                  </span>
                  {/* Current stock */}
                  <span style={{ color: item.currentStock === 0 ? '#CC0000' : '#CC6600', fontWeight: 600, fontSize: '8pt', minWidth: 20, textAlign: 'right' }}>
                    {item.currentStock}
                  </span>
                  {/* Reorder qty */}
                  <span style={{ color: '#003366', fontSize: '7pt', minWidth: 24, textAlign: 'right' }}>
                    → {item.reorderQty}
                  </span>
                </div>
              ))
            )}
          </div>
          {purchaseSuggestions.length > 0 && (
            <div style={{ padding: '2px 6px', borderTop: '1px solid #D4D4D4', textAlign: 'right' }}>
              <button
                className="marg-btn"
                style={{ fontSize: '7pt', height: 16, padding: '0 4px' }}
                onClick={() => toast.info('Navigate to Purchases module for full suggestions')}
              >
                View All <ExternalLink style={{ width: 8, height: 8 }} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
