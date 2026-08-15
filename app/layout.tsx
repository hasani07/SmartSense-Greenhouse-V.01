import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SmartSense Monitoring Greenhouse v.01',
  description: 'Dashboard monitoring sensor kualitas air dan lingkungan greenhouse real-time',
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
