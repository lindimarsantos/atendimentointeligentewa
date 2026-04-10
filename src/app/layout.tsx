import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { DashboardLayout } from '@/components/layout/DashboardLayout'

export const metadata: Metadata = {
  title: 'Atendimento Inteligente WA',
  description: 'Dashboard de atendimento via WhatsApp com IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </AuthProvider>
      </body>
    </html>
  )
}
