import { NextResponse } from 'next/server'

const LAT = -7.713542
const LNG = 110.440141

export async function GET() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=temperature_2m,relative_humidity_2m,weathercode`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ error: true })

    const data = await res.json()
    return NextResponse.json({
      suhu: data.current?.temperature_2m ?? null,
      kelembaban: data.current?.relative_humidity_2m ?? null,
      kode: data.current?.weathercode ?? null,
    })
  } catch {
    return NextResponse.json({ error: true })
  }
}
