import { NextResponse } from 'next/server'

// VPD (Vapor Pressure Deficit) -- rumus Tetens, sama seperti di dashboard
function hitungVPD(suhu: number | null | undefined, rh: number | null | undefined): number | null {
  if (suhu == null || rh == null) return null
  const svp = 0.6108 * Math.exp((17.27 * suhu) / (suhu + 237.3))
  return Number((svp * (1 - rh / 100)).toFixed(2))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { suhu_air, ph, tds, suhu_udara, hum_udara, lux, jarak } = body
  const vpd = hitungVPD(suhu_udara, hum_udara)

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({
      text: 'Rekomendasi AI belum aktif. Tambahkan GROQ_API_KEY di Environment Variables Vercel.',
    })
  }

  const prompt = `Kamu asisten monitoring greenhouse akuaponik/hidroponik. Berdasarkan data sensor berikut, beri 2-3 rekomendasi singkat dan actionable dalam bahasa Indonesia, format list bernomor, tanpa basa-basi:

Suhu air: ${suhu_air} C
pH: ${ph}
TDS: ${tds} ppm
Suhu udara: ${suhu_udara} C
Kelembaban udara: ${hum_udara} %
Cahaya: ${lux} lux
Ketinggian air: ${jarak} cm
VPD (indikator stres tanaman, acuan umum optimal 0.4-1.6 kPa): ${vpd ?? 'tidak dapat dihitung, data suhu/kelembaban udara belum ada'} kPa

Kalau semua nilai dalam rentang wajar untuk sayuran umum, katakan kondisi baik dan beri satu tips perawatan ringan.`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ text: 'Gagal memuat rekomendasi (server AI merespons error).' }, { status: 200 })
    }

    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content ?? 'Tidak ada rekomendasi.'
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ text: 'Gagal memuat rekomendasi (koneksi ke server AI bermasalah).' }, { status: 200 })
  }
}
