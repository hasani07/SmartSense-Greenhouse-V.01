import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SmartSense Greenhouse Melon',
  description: ''Dashboard monitoring sensor greenhouse melon real-time',
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
