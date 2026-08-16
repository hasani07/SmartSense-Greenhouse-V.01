import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WIMA FARM - Greenhouse Melon',
  description: 'Dashboard monitoring sensor greenhouse melon WIMA FARM real-time',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  themeColor: '#15803d',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
