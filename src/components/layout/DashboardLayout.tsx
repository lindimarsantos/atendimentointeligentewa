import { Sidebar } from './Sidebar'
import { ToastContainer } from '@/components/ui/Toast'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="pl-60 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
      <ToastContainer />
    </div>
  )
}
