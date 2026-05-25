'use client'

import dynamic from 'next/dynamic'
import { AppLayout } from '@/components/layout/AppLayout'
import { useNavStore, type ModuleId } from '@/store/nav-store'

const modules: Record<ModuleId, React.ComponentType> = {
  dashboard: dynamic(() => import('@/components/modules/DashboardModule'), { ssr: false }),
  pos: dynamic(() => import('@/components/modules/POSModule'), { ssr: false }),
  medicines: dynamic(() => import('@/components/modules/MedicinesModule'), { ssr: false }),
  inventory: dynamic(() => import('@/components/modules/InventoryModule'), { ssr: false }),
  purchases: dynamic(() => import('@/components/modules/PurchasesModule'), { ssr: false }),
  customers: dynamic(() => import('@/components/modules/CustomersModule'), { ssr: false }),
  reports: dynamic(() => import('@/components/modules/ReportsModule'), { ssr: false }),
  schemes: dynamic(() => import('@/components/modules/SchemesModule'), { ssr: false }),
  claims: dynamic(() => import('@/components/modules/ClaimsModule'), { ssr: false }),
  delivery: dynamic(() => import('@/components/modules/DeliveryModule'), { ssr: false }),
  commissions: dynamic(() => import('@/components/modules/CommissionModule'), { ssr: false }),
  gstReports: dynamic(() => import('@/components/modules/GstReportsModule'), { ssr: false }),
  accounting: dynamic(() => import('@/components/modules/AccountingModule'), { ssr: false }),
  settings: dynamic(() => import('@/components/modules/SettingsModule'), { ssr: false }),
}

export default function Home() {
  const { activeModule } = useNavStore()
  const Mod = modules[activeModule]
  return <AppLayout>{Mod ? <Mod /> : null}</AppLayout>
}
