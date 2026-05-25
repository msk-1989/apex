import { create } from 'zustand'

export type ModuleId =
  | 'dashboard'
  | 'pos'
  | 'medicines'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'reports'
  | 'schemes'
  | 'claims'
  | 'delivery'
  | 'commissions'
  | 'gstReports'
  | 'accounting'
  | 'settings'

interface NavState {
  activeModule: ModuleId
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  setActiveModule: (module: ModuleId) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
}

export const useNavStore = create<NavState>((set) => ({
  activeModule: 'dashboard',
  sidebarOpen: true,
  sidebarCollapsed: false,
  setActiveModule: (module) => set({ activeModule: module }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))
