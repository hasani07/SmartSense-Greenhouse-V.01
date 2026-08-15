// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Titik = {
  bucket: string
  jarak: number | null
  lux: number | null
  suhu_udara: number | null
  hum_udara: number | null
  suhu_air: number | null
  tds: number | null
  ph: number | null
}

const LOKASI = { lat: -7.713542, lng: 110.440141 }

const METRIK = [
  { key: 'suhu_air',   label: 'Suhu air',   satuan: '°C',  desimal: 1, warna: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  { key: 'ph',         label: 'pH',         satuan: '',    desimal: 2, warna: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { key: 'tds',        label: 'TDS',        satuan: 'ppm', desimal: 0, warna: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  { key: 'jarak',      label: 'Ketinggian', satuan: 'cm',  desimal: 1, warna: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'suhu_udara', label: 'Suhu udara', satuan: '°C',  desimal: 1, warna: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  { key: 'hum_udara',  label: 'Kelembaban', satuan: '%',   desimal: 1, warna: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'lux',        label: 'Cahaya',     satuan: 'lux', desimal: 0, warna: '#a16207', bg: '#fefce8', border: '#fde68a' },
] as const

const RENTANG = [
  { key: '24h', label: '24 jam terakhir', jamMundur: 24,        bucketMenit: 5 },
  { key: '7d',  label: '7 hari terakhir', jamMundur: 24 * 7,    bucketMenit: 60 },
  { key: '30d', label: '30 hari terakhir', jamMundur: 24 * 30,  bucketMenit: 240 },
  { key: '1y',  label: '1 tahun terakhir', jamMundur: 24 * 365, bucketMenit: 1440 },
] as const

function formatSumbu(iso: string, rentangKey: string) {
  const d = new Date(iso)
  if (rentangKey === '24h') {
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

export default function Dashboard() {
  const [data, setData] = useState<Titik[]>([])
  const [grafik, setGrafik] = useState<string>('suhu_air')
  const [rentang, setRentang] = useState<string>('24h')
  const [error, setError] = useState<string | null>(null)
  const [rekomendasi, setRekomendasi] = useState<string>('')
  const [loadingRekomendasi, setLoadingRekomendasi] = useState(false)
  const [terbaru, setTerbaru] = useState<Titik | null>(null)
  const [waktuTerbaru, setWaktuTerbaru] = useState<string | null>(null)

  const rentangAktif = RENTANG.find((r) => r.key === rentang)!

  async function muatGrafik() {
    const start = new Date(Date.now() - rentangAktif.jamMundur * 3600 * 1000).toISOString()

    const { data, error } = await supabase.rpc('readings_bucketed', {
      p_device_id: 'esp32-01',
      p_start: start,
      p_bucket_minutes: rentangAktif.bucketMenit,
    })

    if (error) { setError(error.message); return }
    setError(null)
    setData(data ?? [])
  }

  async function muatTerbaru() {
    const { data, error } = await supabase
      .from('readings')
      .select('*')
      .eq('device_id', 'esp32-01')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return
    setTerbaru(data)
    setWaktuTerbaru(data.created_at)
    mintaRekomendasi(data)
  }

  async function mintaRekomendasi(r: any) {
    setLoadingRekomendasi(true)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r),
      })
      const json = await res.json()
      setRekomendasi(json.text)
    } catch {
      setRekomendasi('Gagal memuat rekomendasi.')
    } finally {
      setLoadingRekomendasi(false)
    }
  }

  useEffect(() => {
    muatGrafik()
  }, [rentang])

  useEffect(() => {
    muatTerbaru()
    const t = setInterval(() => { muatTerbaru(); muatGrafik() }, 30000)
    return () => clearInterval(t)
  }, [])

  const aktif = METRIK.find((m) => m.key === grafik)!
  const jamLabel = (iso: string) => formatSumbu(iso, rentang)

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#14532d', margin: 0 }}>
          🌿 SmartSense Monitoring Greenhouse v.01
        </h1>
        <span style={{ fontSize: 13, color: '#78716c' }}>
          {waktuTerbaru
            ? `Data terakhir ${new Date(waktuTerbaru).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
            : 'Menunggu data dari perangkat'}
        </span>
      </header>

      {error && (
        <p style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', padding: 12, fontSize: 14, color: '#991b1b' }}>
          Tidak bisa mengambil data: {error}
        </p>
      )}

      {/* Kartu rekomendasi AI */}
      <section style={{
        marginBottom: '1.5rem', borderRadius: 16, padding: '1.25rem 1.5rem',
        background: 'linear-gradient(135deg, #ecfdf5, #f0fdfa)', border: '1px solid #a7f3d0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#065f46' }}>Rekomendasi AI</span>
        </div>
        <div style={{ fontSize: 14, color: '#134e4a', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
          {loadingRekomendasi ? 'Menganalisis data sensor...' : (rekomendasi || 'Menunggu data pertama...')}
        </div>
      </section>

      {/* Kartu nilai terbaru */}
      <section style={{
        marginBottom: '1.5rem', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12,
      }}>
        {METRIK.map((m) => {
          const nilai = terbaru?.[m.key as keyof Titik] as number | null | undefined
          const dipilih = grafik === m.key
          return (
            <button
              key={m.key}
              onClick={() => setGrafik(m.key)}
              style={{
                textAlign: 'left', borderRadius: 12, padding: '1rem', cursor: 'pointer',
                border: `2px solid ${dipilih ? m.warna : m.border}`,
                background: m.bg,
                transform: dipilih ? 'scale(1.03)' : 'scale(1)',
                transition: 'transform 0.15s',
              }}
            >
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: m.warna, fontWeight: 600, opacity: 0.75 }}>
                {m.label}
              </div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700, color: m.warna }}>
                {nilai == null ? '—' : nilai.toFixed(m.desimal)}
                <span style={{ marginLeft: 4, fontSize: 13, fontWeight: 400, opacity: 0.7 }}>{m.satuan}</span>
              </div>
            </button>
          )
        })}
      </section>

      {/* Grafik metrik terpilih */}
      <section style={{ borderRadius: 16, border: `1px solid ${aktif.border}`, padding: '1rem 1.25rem', marginBottom: '1.5rem', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: aktif.warna, margin: 0 }}>
            {aktif.label} — {rentangAktif.label}
          </h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {RENTANG.map((r) => (
              <button
                key={r.key}
                onClick={() => setRentang(r.key)}
                style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${rentang === r.key ? aktif.warna : '#e5e5e0'}`,
                  background: rentang === r.key ? aktif.warna : '#fff',
                  color: rentang === r.key ? '#fff' : '#666',
                }}
              >
                {r.label.replace(' terakhir', '')}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={jamLabel} tick={{ fontSize: 12 }} minTickGap={40} />
              <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
              <Tooltip
                labelFormatter={(v) => jamLabel(v as string)}
                formatter={(v: number) => [`${v?.toFixed?.(aktif.desimal) ?? v} ${aktif.satuan}`, aktif.label]}
              />
              <Line
                type="monotone"
                dataKey={grafik}
                stroke={aktif.warna}
                strokeWidth={2.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {data.length === 0 && (
          <p style={{ fontSize: 13, color: '#a3a39c', textAlign: 'center', marginTop: 12 }}>
            Belum ada data untuk rentang ini.
          </p>
        )}
      </section>

      {/* Peta lokasi greenhouse */}
      <section style={{ borderRadius: 16, border: '1px solid #d9d9d3', overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#44443f', margin: 0 }}>📍 Lokasi greenhouse</h2>
        </div>
        <iframe
          title="Lokasi greenhouse"
          width="100%"
          height="320"
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${LOKASI.lng - 0.01}%2C${LOKASI.lat - 0.008}%2C${LOKASI.lng + 0.01}%2C${LOKASI.lat + 0.008}&layer=mapnik&marker=${LOKASI.lat}%2C${LOKASI.lng}`}
        />
        <div style={{ padding: '0.75rem 1.25rem', fontSize: 13 }}>
          <a
            href={`https://www.openstreetmap.org/?mlat=${LOKASI.lat}&mlon=${LOKASI.lng}#map=17/${LOKASI.lat}/${LOKASI.lng}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#2563eb' }}
          >
            Buka peta lebih besar
          </a>
        </div>
      </section>
    </main>
  )
}
