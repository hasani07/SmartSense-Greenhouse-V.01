// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Sprout, Thermometer, FlaskConical, Droplets, Waves, Wind, Sun, Moon,
  MapPin, Sparkles, ExternalLink, Wifi, WifiOff, AlertTriangle, Download, Gauge,
  GitCompare, History,
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

type Stats = Record<string, number | null>

const LOKASI = { lat: -7.713542, lng: 110.440141 }

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

function metrikByKey(key: string) {
  return METRIK.find((m) => m.key === key)
}

function statusMetrik(key: string, nilai: number | null | undefined) {
  const m = metrikByKey(key)!
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

function fmt(v: number | null | undefined, desimal: number) {
  return v == null ? '—' : v.toFixed(desimal)
}

function hitungVPD(suhu: number | null | undefined, rh: number | null | undefined): number | null {
  if (suhu == null || rh == null) return null
  const svp = 0.6108 * Math.exp((17.27 * suhu) / (suhu + 237.3))
  return Number((svp * (1 - rh / 100)).toFixed(2))
}
function statusVPD(v: number | null) {
  if (v == null) return { label: 'Normal', warna: '#6b7280', bg: '#f3f4f6' }
  if (v < 0.4 || v > 1.6) return { label: 'Perlu Cek', warna: '#b45309', bg: '#fef3c7' }
  return { label: 'Optimal', warna: '#15803d', bg: '#dcfce7' }
}

function prediksiTren(nilai: number[], jumlahPrediksi: number): number[] {
  const n = nilai.length
  if (n < 4) return []
  const xs = nilai.map((_, i) => i)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = nilai.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * nilai[i], 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const penyebut = n * sumXX - sumX * sumX
  const slope = penyebut !== 0 ? (n * sumXY - sumX * sumY) / penyebut : 0
  const intercept = (sumY - slope * sumX) / n
  const lastX = xs[n - 1]
  const hasil: number[] = []
  for (let i = 1; i <= jumlahPrediksi; i++) hasil.push(slope * (lastX + i) + intercept)
  return hasil
}

function warnaHeatmap(nilai: number | null, m: (typeof METRIK)[number], semuaNilai: number[]) {
  if (nilai == null) return '#e5e7eb'
  if (m.ideal) {
    const [lo, hi] = m.ideal
    return nilai >= lo && nilai <= hi ? '#4ade80' : '#fb923c'
  }
  if (semuaNilai.length === 0) return '#93c5fd'
  const min = Math.min(...semuaNilai)
  const max = Math.max(...semuaNilai)
  const tNorm = max > min ? (nilai - min) / (max - min) : 0.5
  return `rgba(37, 99, 235, ${0.25 + tNorm * 0.65})`
}

export default function Dashboard() {
  const [data, setData] = useState<Titik[]>([])
  const [kemarin, setKemarin] = useState<Titik[]>([])
  const [tampilkanKemarin, setTampilkanKemarin] = useState(false)
  const [pembanding, setPembanding] = useState<string>('')
  const [stats, setStats] = useState<Stats>({})
  const [heatmap, setHeatmap] = useState<Titik[]>([])
  const [macet, setMacet] = useState<Record<string, boolean>>({})
  const [grafik, setGrafik] = useState<string>('suhu_air')
  const [rentang, setRentang] = useState<string>('24h')
  const [error, setError] = useState<string | null>(null)
  const [rekomendasi, setRekomendasi] = useState<string>('')
  const [loadingRekomendasi, setLoadingRekomendasi] = useState(false)
  const [terbaru, setTerbaru] = useState<Titik | null>(null)
  const [waktuTerbaru, setWaktuTerbaru] = useState<string | null>(null)
  const [dark, setDark] = useState(false)
  const [uptime, setUptime] = useState<number | null>(null)
  const [live, setLive] = useState(false)
  const [mengekspor, setMengekspor] = useState(false)
  const [jamSekarang, setJamSekarang] = useState<Date | null>(null)

  useEffect(() => {
    setJamSekarang(new Date())
    const iv = setInterval(() => setJamSekarang(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('dashboard-dark')
    if (saved === '1') setDark(true)
  }, [])

  function toggleDark() {
    setDark((d) => {
      localStorage.setItem('dashboard-dark', !d ? '1' : '0')
      return !d
    })
  }

  const rentangAktif = RENTANG.find((r) => r.key === rentang)!
  const aktif = metrikByKey(grafik)!

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

  async function muatKemarin() {
    if (rentang !== '24h') { setKemarin([]); return }
    const start = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const { data, error } = await supabase.rpc('readings_bucketed', {
      p_device_id: 'esp32-01',
      p_start: start,
      p_bucket_minutes: 1,
    })
    if (error || !data) { setKemarin([]); return }
    const batas = Date.now() - 24 * 3600 * 1000
    const digeser = data
      .filter((d: any) => new Date(d.bucket).getTime() < batas)
      .map((d: any) => ({ ...d, bucket: new Date(new Date(d.bucket).getTime() + 24 * 3600 * 1000).toISOString() }))
    setKemarin(digeser)
  }

  async function muatStats() {
    const start = new Date(Date.now() - rentangAktif.jamMundur * 3600 * 1000).toISOString()
    const { data, error } = await supabase.rpc('readings_stats', {
      p_device_id: 'esp32-01',
      p_start: start,
    })
    if (error || !data || data.length === 0) return
    setStats(data[0])
  }

  async function muatHeatmap() {
    const start = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
    const { data, error } = await supabase.rpc('readings_bucketed', {
      p_device_id: 'esp32-01',
      p_start: start,
      p_bucket_minutes: 1440,
    })
    if (error) return
    setHeatmap(data ?? [])
  }

  async function muatCekMacet() {
    const { data, error } = await supabase
      .from('readings')
      .select('suhu_air, ph, tds, jarak, suhu_udara, hum_udara, lux')
      .eq('device_id', 'esp32-01')
      .order('created_at', { ascending: false })
      .limit(8)
    if (error || !data || data.length < 8) { setMacet({}); return }
    const hasil: Record<string, boolean> = {}
    METRIK.forEach((m) => {
      const nilai = data.map((r: any) => r[m.key]).filter((v: any) => v != null)
      hasil[m.key] = nilai.length === 8 && nilai.every((v: number) => v === nilai[0])
    })
    setMacet(hasil)
  }

  async function muatUptime() {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count, error } = await supabase
      .from('readings')
      .select('id', { count: 'exact', head: true })
      .eq('device_id', 'esp32-01')
      .gte('created_at', since)
    if (error || count == null) return
    const perkiraanTotal = 24 * 60
    setUptime(Math.min(100, Math.round((count / perkiraanTotal) * 100)))
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

  async function eksporCSV() {
    setMengekspor(true)
    try {
      const start = new Date(Date.now() - rentangAktif.jamMundur * 3600 * 1000).toISOString()
      const { data, error } = await supabase
        .from('readings')
        .select('created_at, suhu_air, ph, tds, jarak, suhu_udara, hum_udara, lux')
        .eq('device_id', 'esp32-01')
        .gte('created_at', start)
        .order('created_at', { ascending: true })
        .limit(5000)

      if (error || !data || data.length === 0) {
        alert('Tidak ada data untuk diekspor pada rentang ini.')
        return
      }

      const header = 'Waktu,Suhu Air (C),pH,TDS (ppm),Ketinggian (cm),Suhu Udara (C),Kelembaban (%),Cahaya (lux)\n'
      const baris = data.map((r) => [
        new Date(r.created_at).toLocaleString('id-ID'),
        r.suhu_air ?? '', r.ph ?? '', r.tds ?? '', r.jarak ?? '', r.suhu_udara ?? '', r.hum_udara ?? '', r.lux ?? '',
      ].join(',')).join('\n')

      const blob = new Blob([header + baris], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `smartsense-greenhouse-${rentang}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setMengekspor(false)
    }
  }

  useEffect(() => { muatGrafik(); muatStats(); muatKemarin() }, [rentang])
  useEffect(() => { muatKemarin() }, [tampilkanKemarin])

  useEffect(() => {
    muatTerbaru()
    muatUptime()
    muatCekMacet()
    muatHeatmap()
    const t = setInterval(() => {
      muatTerbaru(); muatGrafik(); muatStats(); muatUptime(); muatCekMacet()
    }, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('readings-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'readings', filter: 'device_id=eq.esp32-01' },
        (payload) => {
          const baru = payload.new as Titik
          setTerbaru(baru)
          setWaktuTerbaru((baru as any).created_at)
          mintaRekomendasi(baru)
          muatGrafik()
          muatStats()
          muatUptime()
          muatCekMacet()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setLive(true)
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setLive(false)
      })

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentang])

  const jamLabel = (iso: string) => formatSumbu(iso, rentang)
  const hero = ['suhu_air', 'ph', 'tds'].map((k) => metrikByKey(k)!)

  const online = waktuTerbaru ? (Date.now() - new Date(waktuTerbaru).getTime()) < 3 * 60 * 1000 : false

  const nilaiVPD = hitungVPD(terbaru?.suhu_udara ?? null, terbaru?.hum_udara ?? null)
  const stVPD = statusVPD(nilaiVPD)
  const anomaliVPD = stVPD.label === 'Perlu Cek'

  // Gabungkan data hari ini + overlay kemarin + garis prediksi
  const dataUntukChart = (() => {
    const kemarinMap = new Map<string, number | null>()
    kemarin.forEach((k) => kemarinMap.set(k.bucket, (k as any)[grafik] ?? null))

    const base = data.map((d) => ({
      ...d,
      kemarinNilai: kemarinMap.get(d.bucket) ?? null,
      prediksi: null as number | null,
    }))

    const valid = data.filter((d) => (d as any)[grafik] != null)
    const window = valid.slice(-10).map((d) => (d as any)[grafik] as number)
    const prediksiArr = prediksiTren(window, 3)
    if (prediksiArr.length === 0 || base.length === 0) return base

    const last = data[data.length - 1]
    const bucketMs = rentangAktif.bucketMenit * 60000
    const lastTime = new Date(last.bucket).getTime()
    base[base.length - 1] = { ...base[base.length - 1], prediksi: (last as any)[grafik] }
    prediksiArr.forEach((v, i) => {
      base.push({
        bucket: new Date(lastTime + (i + 1) * bucketMs).toISOString(),
        jarak: null, lux: null, suhu_udara: null, hum_udara: null, suhu_air: null, tds: null, ph: null,
        kemarinNilai: null, prediksi: v,
      } as any)
    })
    return base
  })()

  // Riwayat anomali untuk metrik yang sedang ditampilkan di grafik
  const riwayatAnomali = (() => {
    if (!aktif.ideal) return []
    const [lo, hi] = aktif.ideal
    const hasil: { mulai: string; selesai: string; min: number; max: number }[] = []
    let sedang: { mulai: string; selesai: string; min: number; max: number } | null = null
    data.forEach((d) => {
      const v = (d as any)[grafik] as number | null
      const buruk = v != null && (v < lo || v > hi)
      if (buruk) {
        if (!sedang) sedang = { mulai: d.bucket, selesai: d.bucket, min: v as number, max: v as number }
        else {
          sedang.selesai = d.bucket
          sedang.min = Math.min(sedang.min, v as number)
          sedang.max = Math.max(sedang.max, v as number)
        }
      } else if (sedang) {
        hasil.push(sedang)
        sedang = null
      }
    })
    if (sedang) hasil.push(sedang)
    return hasil.reverse()
  })()

  const t = dark
    ? { bg: '#0b1210', card: '#111c17', border: '#1f2b25', text: '#e5e7eb', sub: '#9ca3af', headRow: '#6b7280', rowBorder: '#1f2b25' }
    : { bg: '#f4f6f2', card: '#ffffff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', headRow: '#9ca3af', rowBorder: '#f4f4f2' }

  return (
    <div style={{ background: t.bg, minHeight: '100vh', transition: 'background 0.2s' }}>
      <main style={{
        width: '100%', maxWidth: 1440, margin: '0 auto',
        padding: 'clamp(1rem, 3vw, 2.5rem)', fontFamily: 'sans-serif',
      }}>

        {/* Logo bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#15803d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sprout color="#fff" size={20} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: dark ? '#e5e7eb' : '#14532d' }}>WIMA FARM</span>
          <span style={{ fontSize: 13, color: t.sub }}>Greenhouse Melon</span>

          {jamSekarang && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: t.sub, fontWeight: 500 }}>
              {jamSekarang.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}
              {jamSekarang.toLocaleTimeString('id-ID')}
            </span>
          )}

          <button
            onClick={toggleDark}
            style={{
              width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${t.border}`, background: t.card,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Ganti mode gelap/terang"
          >
            {dark ? <Sun size={16} color="#facc15" /> : <Moon size={16} color="#374151" />}
          </button>
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
              const anomali = statusMetrik(m.key, nilai).label === 'Perlu Cek'
              return (
                <div key={m.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: anomali ? '8px 16px 8px 8px' : 0,
                  borderRadius: 14,
                  background: anomali ? 'rgba(248,113,113,0.16)' : 'transparent',
                  border: anomali ? '1px solid rgba(248,113,113,0.4)' : '1px solid transparent',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: anomali ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={20} color={anomali ? '#fecaca' : '#fff'} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {m.label}
                      {anomali && <AlertTriangle size={12} color="#fecaca" />}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: anomali ? '#fecaca' : '#fff' }}>
                      {fmt(nilai, m.desimal)}
                      <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.8 }}> {m.satuan}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: anomaliVPD ? '8px 16px 8px 8px' : 0,
              borderRadius: 14,
              background: anomaliVPD ? 'rgba(248,113,113,0.16)' : 'transparent',
              border: anomaliVPD ? '1px solid rgba(248,113,113,0.4)' : '1px solid transparent',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: anomaliVPD ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Gauge size={20} color={anomaliVPD ? '#fecaca' : '#fff'} />
              </div>
              <div>
                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  VPD
                  {anomaliVPD && <AlertTriangle size={12} color="#fecaca" />}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: anomaliVPD ? '#fecaca' : '#fff' }}>
                  {fmt(nilaiVPD, 2)}
                  <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.8 }}> kPa</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            position: 'absolute', right: -10, top: -10, width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }} />

          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, opacity: 0.9, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
              background: online ? 'rgba(163,230,53,0.2)' : 'rgba(248,113,113,0.2)',
              color: online ? '#a3e635' : '#fca5a5', fontWeight: 600,
            }}>
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? 'Online' : 'Offline'}
            </span>
            {live && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
                background: 'rgba(163,230,53,0.15)', color: '#a3e635', fontWeight: 600,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#a3e635', display: 'inline-block' }} />
                Live
              </span>
            )}
            {uptime != null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.15)', fontWeight: 600,
              }}>
                Uptime 24 jam: {uptime}%
              </span>
            )}
            <span style={{ opacity: 0.75 }}>
              {waktuTerbaru
                ? `Data terakhir ${new Date(waktuTerbaru).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                : 'Menunggu data dari perangkat'}
            </span>
          </div>
        </section>

        {error && (
          <p style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', padding: 12, fontSize: 14, color: '#991b1b' }}>
            Tidak bisa mengambil data: {error}
          </p>
        )}

        {/* GRID: chart + alert */}
        <section className="chart-alert-grid" style={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)',
          gap: 16, marginBottom: 16,
        }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '4px 0 8px', fontSize: 11 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <GitCompare size={12} />
                Bandingkan:
                <select
                  value={pembanding}
                  onChange={(e) => setPembanding(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, fontSize: 11, padding: '2px 6px' }}
                >
                  <option value="" style={{ color: '#000' }}>Tanpa perbandingan</option>
                  {METRIK.filter((m) => m.key !== grafik).map((m) => (
                    <option key={m.key} value={m.key} style={{ color: '#000' }}>{m.label}</option>
                  ))}
                </select>
              </label>
              {rentang === '24h' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={tampilkanKemarin} onChange={(e) => setTampilkanKemarin(e.target.checked)} />
                  vs kemarin
                </label>
              )}
            </div>

            <div style={{ height: 240, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataUntukChart} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="bucket" tickFormatter={jamLabel} tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} minTickGap={40} />
                  <YAxis yAxisId="kiri" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} domain={['auto', 'auto']} />
                  {pembanding && (
                    <YAxis yAxisId="kanan" orientation="right" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.6)' }} domain={['auto', 'auto']} />
                  )}
                  <Tooltip
                    labelFormatter={(v) => jamLabel(v as string)}
                    formatter={(v: number, nama: string) => {
                      if (nama === 'prediksi') return [`${v?.toFixed?.(aktif.desimal) ?? v} ${aktif.satuan}`, `${aktif.label} (prediksi)`]
                      if (nama === 'kemarinNilai') return [`${v?.toFixed?.(aktif.desimal) ?? v} ${aktif.satuan}`, `${aktif.label} (kemarin)`]
                      if (nama === pembanding) {
                        const mb = metrikByKey(pembanding)!
                        return [`${v?.toFixed?.(mb.desimal) ?? v} ${mb.satuan}`, mb.label]
                      }
                      return [`${v?.toFixed?.(aktif.desimal) ?? v} ${aktif.satuan}`, aktif.label]
                    }}
                    contentStyle={{ background: '#0f3d20', border: 'none', borderRadius: 8, fontSize: 12 }}
                  />
                  <Line yAxisId="kiri" type="monotone" dataKey={grafik} stroke="#a3e635" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
                  <Line yAxisId="kiri" type="monotone" dataKey="prediksi" stroke="#facc15" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls isAnimationActive={false} />
                  {tampilkanKemarin && (
                    <Line yAxisId="kiri" type="monotone" dataKey="kemarinNilai" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="2 4" dot={false} connectNulls isAnimationActive={false} />
                  )}
                  {pembanding && (
                    <Line yAxisId="kanan" type="monotone" dataKey={pembanding} stroke="#38bdf8" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {data.length === 0 && (
              <p style={{ fontSize: 12, opacity: 0.6, textAlign: 'center', marginTop: 8 }}>Belum ada data untuk rentang ini.</p>
            )}
            <p style={{ fontSize: 10, opacity: 0.55, marginTop: 6 }}>
              Kuning putus-putus: prediksi tren linear sederhana (bukan AI/ML). Abu-abu putus-putus: data kemarin di jam yang sama. Biru: metrik pembanding (sumbu kanan).
            </p>
          </div>

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

        {/* Riwayat anomali */}
        <section style={{ borderRadius: 20, background: t.card, border: `1px solid ${t.border}`, padding: '1.25rem 1.5rem', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <History size={16} color={dark ? '#e5e7eb' : '#14532d'} />
            <span style={{ fontSize: 15, fontWeight: 600, color: dark ? '#e5e7eb' : '#14532d' }}>
              Riwayat Anomali -- {aktif.label}
            </span>
            <span style={{ fontWeight: 400, fontSize: 12, color: t.sub }}>({rentangAktif.label} terakhir)</span>
          </div>
          {!aktif.ideal ? (
            <p style={{ fontSize: 13, color: t.sub }}>Metrik ini tidak punya rentang ideal terdefinisi, riwayat anomali tidak berlaku.</p>
          ) : riwayatAnomali.length === 0 ? (
            <p style={{ fontSize: 13, color: '#15803d' }}>Tidak ada anomali pada rentang ini -- kondisi stabil.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riwayatAnomali.slice(0, 10).map((a, i) => (
                <li key={i} style={{
                  fontSize: 12, padding: '8px 12px', borderRadius: 8,
                  background: dark ? 'rgba(180,83,9,0.12)' : '#fffbeb', color: dark ? '#fcd34d' : '#92400e',
                  display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6,
                }}>
                  <span>{jamLabel(a.mulai)} -- {jamLabel(a.selesai)}</span>
                  <span>Min {fmt(a.min, aktif.desimal)} / Maks {fmt(a.max, aktif.desimal)} {aktif.satuan}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tabel status + statistik */}
        <section style={{ borderRadius: 20, background: t.card, border: `1px solid ${t.border}`, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{
            padding: '1rem 1.5rem', borderBottom: `1px solid ${t.rowBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: dark ? '#e5e7eb' : '#14532d' }}>
              Status &amp; Statistik Sensor <span style={{ fontWeight: 400, fontSize: 12, color: t.sub }}>({rentangAktif.label} terakhir)</span>
            </span>
            <button
              onClick={eksporCSV}
              disabled={mengekspor}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                padding: '6px 12px', borderRadius: 8, cursor: mengekspor ? 'default' : 'pointer',
                border: `1px solid ${t.border}`, background: dark ? '#1f2b25' : '#f0fdf4',
                color: dark ? '#a3e635' : '#15803d', opacity: mengekspor ? 0.6 : 1,
              }}
            >
              <Download size={13} />
              {mengekspor ? 'Menyiapkan...' : 'Ekspor CSV'}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
              <thead>
                <tr style={{ color: t.headRow, textAlign: 'left' }}>
                  <th style={{ padding: '10px 1.5rem', fontWeight: 500 }}>Sensor</th>
                  <th style={{ padding: '10px 12px', fontWeight: 500 }}>Saat Ini</th>
                  <th style={{ padding: '10px 12px', fontWeight: 500 }}>Min</th>
                  <th style={{ padding: '10px 12px', fontWeight: 500 }}>Rata-rata</th>
                  <th style={{ padding: '10px 12px', fontWeight: 500 }}>Maks</th>
                  <th style={{ padding: '10px 1.5rem', fontWeight: 500 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {METRIK.map((m) => {
                  const nilai = terbaru?.[m.key as keyof Titik] as number | null | undefined
                  const st = statusMetrik(m.key, nilai)
                  const Icon = m.Icon
                  const min = stats[`${m.key}_min`]
                  const avg = stats[`${m.key}_avg`]
                  const max = stats[`${m.key}_max`]
                  const isMacet = macet[m.key]
                  return (
                    <tr key={m.key} style={{
                      borderTop: `1px solid ${t.rowBorder}`,
                      background: st.label === 'Perlu Cek' ? (dark ? 'rgba(180,83,9,0.15)' : '#fffbeb') : 'transparent',
                    }}>
                      <td style={{ padding: '10px 1.5rem', fontWeight: 600, color: t.text }}>
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
                      <td style={{ padding: '10px 12px', color: t.text, fontWeight: 600 }}>{fmt(nilai, m.desimal)} {m.satuan}</td>
                      <td style={{ padding: '10px 12px', color: t.sub }}>{fmt(min, m.desimal)}</td>
                      <td style={{ padding: '10px 12px', color: t.sub }}>{fmt(avg, m.desimal)}</td>
                      <td style={{ padding: '10px 12px', color: t.sub }}>{fmt(max, m.desimal)}</td>
                      <td style={{ padding: '10px 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color: st.warna, background: st.bg }}>
                            {st.label}
                          </span>
                          {isMacet && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                              color: '#b91c1c', background: '#fee2e2', display: 'inline-flex', alignItems: 'center', gap: 3,
                            }}>
                              <AlertTriangle size={10} /> Mungkin macet
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: t.sub, padding: '10px 1.5rem' }}>
            Rentang "Optimal", VPD, prediksi tren, dan deteksi "mungkin macet" bersifat acuan/heuristik umum -- sesuaikan dengan SOP budidaya dan kondisi alat Anda sendiri.
          </p>
        </section>

        {/* Heatmap kalender */}
        <section style={{ borderRadius: 20, background: t.card, border: `1px solid ${t.border}`, padding: '1.25rem 1.5rem', marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: dark ? '#e5e7eb' : '#14532d' }}>
              Peta Kalender -- {aktif.label}
            </span>
            <span style={{ fontWeight: 400, fontSize: 12, color: t.sub, marginLeft: 6 }}>
              (rata-rata harian, 90 hari terakhir)
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {heatmap.map((h) => {
              const nilai = (h as any)[grafik] as number | null
              const semuaNilai = heatmap.map((x) => (x as any)[grafik]).filter((v: any) => v != null) as number[]
              return (
                <div
                  key={h.bucket}
                  title={`${new Date(h.bucket).toLocaleDateString('id-ID')}: ${fmt(nilai, aktif.desimal)} ${aktif.satuan}`}
                  style={{ width: 13, height: 13, borderRadius: 3, background: warnaHeatmap(nilai, aktif, semuaNilai) }}
                />
              )
            })}
          </div>
          {heatmap.length === 0 && (
            <p style={{ fontSize: 12, color: t.sub, marginTop: 8 }}>Belum cukup data untuk peta kalender.</p>
          )}
        </section>

        {/* Peta lokasi */}
        <section style={{ borderRadius: 20, border: `1px solid ${t.border}`, overflow: 'hidden', background: t.card }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: `1px solid ${t.rowBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color={dark ? '#a3e635' : '#14532d'} />
            <span style={{ fontSize: 15, fontWeight: 600, color: dark ? '#e5e7eb' : '#14532d' }}>Lokasi Greenhouse</span>
          </div>
          <div style={{ position: 'relative' }}>
            <iframe
              title="Lokasi greenhouse"
              width="100%"
              height="320"
              style={{ border: 0, display: 'block', pointerEvents: 'none' }}
              loading="lazy"
              tabIndex={-1}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${LOKASI.lng - 0.01}%2C${LOKASI.lat - 0.008}%2C${LOKASI.lng + 0.01}%2C${LOKASI.lat + 0.008}&layer=mapnik&marker=${LOKASI.lat}%2C${LOKASI.lng}`}
            />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${LOKASI.lat}%2C${LOKASI.lng}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Buka lokasi di Google Maps"
              style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
            />
          </div>
          <div style={{ padding: '0.75rem 1.5rem', fontSize: 13 }}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${LOKASI.lat}%2C${LOKASI.lng}`}
              target="_blank" rel="noreferrer"
              style={{ color: dark ? '#a3e635' : '#15803d', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              Buka di Google Maps <ExternalLink size={12} />
            </a>
          </div>
        </section>
      </main>

      <style jsx>{`
        @media (max-width: 768px) {
          .chart-alert-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          table td, table th {
            padding-left: 1rem !important;
            padding-right: 0.6rem !important;
          }
        }
      `}</style>
    </div>
  )
}
