// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Sprout, Thermometer, FlaskConical, Droplets, Waves, Wind, Sun,
  MapPin, Sparkles, ExternalLink,
} from 'lucide-react'

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

// Acuan umum kondisi ideal melon hidroponik/greenhouse -- sifatnya indikatif,
// sesuaikan lagi dengan varietas dan SOP budidaya Anda sendiri.
const METRIK = [
  { key: 'suhu_air',   label: 'Suhu Air',    satuan: '°C',  desimal: 1, warna: '#0e7490', ideal: [20, 28] as [number, number] | null, Icon: Thermometer },
  { key: 'ph',         label: 'pH',          satuan: '',    desimal: 2, warna: '#7c3aed', ideal: [5.8, 6.8] as [number, number] | null, Icon: FlaskConical },
  { key: 'tds',        label: 'TDS',         satuan: 'ppm', desimal: 0, warna: '#0f766e', ideal: [400, 1200] as [number, number] | null, Icon: Droplets },
  { key: 'jarak',      label: 'Ketinggian',  satuan: 'cm',  desimal: 1, warna: '#2563eb', ideal: null, Icon: Waves },
  { key: 'suhu_udara', label: 'Suhu Udara',  satuan: '°C',  desimal: 1, warna: '#c2410c', ideal: [24, 32] as [number, number] | null, Icon: Wind },
  { key: 'hum_udara',  label: 'Kelembaban',  satuan: '%',   desimal: 1, warna: '#15803d', ideal: [50, 80] as [number, number] | null, Icon: Droplets },
  { key: 'lux',        label: 'Cahaya',      satuan: 'lux', desimal: 0, warna: '#a16207', ideal: null, Icon: Sun },
] as const

const RENTANG = [
  { key: '24h', label: '24 jam', jamMundur: 24,        bucketMenit: 1 },
  { key: '7d',  label: '7 hari', jamMundur: 24 * 7,    bucketMenit: 60 },
  { key: '30d', label: '30 hari', jamMundur: 24 * 30,  bucketMenit: 240 },
  { key: '1y',  label: '1 tahun', jamMundur: 24 * 365, bucketMenit: 1440 },
] as const

function statusMetrik(key: string, nilai: number | null | undefined) {
  const m = METRIK.find((x) => x.key === key)!
  if (nilai == null || !m.ideal) return { label: 'Normal', warna: '#6b7280', bg: '#f3f4f6' }
  const [lo, hi] = m.ideal
  if (nilai < lo || nilai > hi) return { label: 'Perlu Cek', warna: '#b45309', bg: '#fef3c7' }
  return { label: 'Optimal', warna: '#15803d', bg: '#dcfce7' }
}

function formatSumbu(iso: string, rentangKey: string) {
  const d = new Date(iso)
  if (rentangKey === '24h') return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
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
  const aktif = METRIK.find((m) => m.key === grafik)!

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

  useEffect(() => { muatGrafik() }, [rentang])
  useEffect(() => {
    muatTerbaru()
    const t = setInterval(() => { muatTerbaru(); muatGrafik() }, 30000)
    return () => clearInterval(t)
  }, [])

  const jamLabel = (iso: string) => formatSumbu(iso, rentang)
  const hero = ['suhu_air', 'ph', 'tds'].map((k) => METRIK.find((m) => m.key === k)!)

  return (
    <main style={{
      width: '100%', maxWidth: 1440, margin: '0 auto',
      padding: 'clamp(1rem, 3vw, 2.5rem)', fontFamily: 'sans-serif', background: '#f4f6f2',
    }}>

      {/* Logo bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: '#15803d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sprout color="#fff" size={20} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#14532d' }}>SmartSense</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>Greenhouse Melon</span>
      </div>

      {/* HERO */}
      <section style={{
        borderRadius: 24, padding: 'clamp(1.5rem, 4vw, 2.5rem)', marginBottom: '1.25rem',
        background: 'linear-gradient(135deg, #14532d, #15803d 60%, #4d7c0f)',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <h1 style={{ fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 700, margin: '0 0 28px' }}>Overview</h1>
        <div style={{ display: 'flex', gap: 'clamp(24px, 5vw, 56px)', flexWrap: 'wrap' }}>
          {hero.map((m) => {
            const nilai = terbaru?.[m.key as keyof Titik] as number | null | undefined
            const Icon = m.Icon
            return (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {nilai == null ? '—' : nilai.toFixed(m.desimal)}
                    <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.8 }}> {m.satuan}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{
          position: 'absolute', right: -10, top: -10, width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{ marginTop: 24, fontSize: 12, opacity: 0.75 }}>
          {waktuTerbaru
            ? `Data terakhir ${new Date(waktuTerbaru).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
            : 'Menunggu data dari perangkat'}
        </div>
      </section>

      {error && (
        <p style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', padding: 12, fontSize: 14, color: '#991b1b' }}>
          Tidak bisa mengambil data: {error}
        </p>
      )}

      {/* GRID: chart + alert */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)',
        gap: 16, marginBottom: 16,
      }}>

        {/* Growth analytics (dark card) */}
        <div style={{ borderRadius: 20, padding: 'clamp(1.25rem, 2vw, 1.75rem)', background: '#14532d', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Growth Analytics</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {RENTANG.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRentang(r.key)}
                  style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 999, cursor: 'pointer', border: 'none',
                    background: rentang === r.key ? '#fff' : 'rgba(255,255,255,0.15)',
                    color: rentang === r.key ? '#14532d' : '#fff',
                    fontWeight: rentang === r.key ? 700 : 400,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 6px' }}>
            {METRIK.map((m) => {
              const Icon = m.Icon
              return (
                <button
                  key={m.key}
                  onClick={() => setGrafik(m.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, padding: '4px 11px 4px 8px', borderRadius: 999, cursor: 'pointer',
                    border: `1px solid ${grafik === m.key ? '#fff' : 'rgba(255,255,255,0.3)'}`,
                    background: grafik === m.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: '#fff',
                  }}
                >
                  <Icon size={13} />
                  {m.label}
                </button>
              )
            })}
          </div>

          <div style={{ height: 240, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="bucket" tickFormatter={jamLabel} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} domain={['auto', 'auto']} />
                <Tooltip
                  labelFormatter={(v) => jamLabel(v as string)}
                  formatter={(v: number) => [`${v?.toFixed?.(aktif.desimal) ?? v} ${aktif.satuan}`, aktif.label]}
                  contentStyle={{ background: '#0f3d20', border: 'none', borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey={grafik} stroke="#a3e635" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {data.length === 0 && (
            <p style={{ fontSize: 12, opacity: 0.6, textAlign: 'center', marginTop: 8 }}>Belum ada data untuk rentang ini.</p>
          )}
        </div>

        {/* Rekomendasi AI */}
        <div style={{ borderRadius: 20, padding: 'clamp(1.25rem, 2vw, 1.75rem)', background: '#fef9c3', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={18} color="#b45309" />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#78350f' }}>Rekomendasi AI</span>
          </div>
          <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {loadingRekomendasi ? 'Menganalisis data sensor...' : (rekomendasi || 'Menunggu data pertama...')}
          </div>
        </div>
      </section>

      {/* Tabel status semua metrik */}
      <section style={{ borderRadius: 20, background: '#fff', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0ee', fontSize: 15, fontWeight: 600, color: '#14532d' }}>
          Status Sensor Saat Ini
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
            <thead>
              <tr style={{ color: '#9ca3af', textAlign: 'left' }}>
                <th style={{ padding: '10px 1.5rem', fontWeight: 500 }}>Sensor</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Nilai</th>
                <th style={{ padding: '10px 1.5rem', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {METRIK.map((m) => {
                const nilai = terbaru?.[m.key as keyof Titik] as number | null | undefined
                const st = statusMetrik(m.key, nilai)
                const Icon = m.Icon
                return (
                  <tr key={m.key} style={{ borderTop: '1px solid #f4f4f2' }}>
                    <td style={{ padding: '10px 1.5rem', fontWeight: 600, color: '#374151' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 8, background: `${m.warna}1a`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Icon size={14} color={m.warna} />
                        </div>
                        {m.label}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#111827' }}>
                      {nilai == null ? '—' : nilai.toFixed(m.desimal)} {m.satuan}
                    </td>
                    <td style={{ padding: '10px 1.5rem' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color: st.warna, background: st.bg }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', padding: '10px 1.5rem' }}>
          Rentang "Optimal" bersifat acuan umum untuk melon hidroponik, sesuaikan dengan SOP budidaya Anda sendiri.
        </p>
      </section>

      {/* Peta lokasi */}
      <section style={{ borderRadius: 20, border: '1px solid #e5e7eb', overflow: 'hidden', background: '#fff' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0ee', display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={16} color="#14532d" />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#14532d' }}>Lokasi Greenhouse</span>
        </div>
        <iframe
          title="Lokasi greenhouse"
          width="100%"
          height="320"
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${LOKASI.lng - 0.01}%2C${LOKASI.lat - 0.008}%2C${LOKASI.lng + 0.01}%2C${LOKASI.lat + 0.008}&layer=mapnik&marker=${LOKASI.lat}%2C${LOKASI.lng}`}
        />
        <div style={{ padding: '0.75rem 1.5rem', fontSize: 13 }}>
          <a
            href={`https://www.openstreetmap.org/?mlat=${LOKASI.lat}&mlon=${LOKASI.lng}#map=17/${LOKASI.lat}/${LOKASI.lng}`}
            target="_blank" rel="noreferrer"
            style={{ color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            Buka peta lebih besar <ExternalLink size={12} />
          </a>
        </div>
      </section>
    </main>
  )
}
