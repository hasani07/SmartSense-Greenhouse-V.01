import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()
  const { periode, stats, anomaliCount, uptime, vpd } = body

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({
      text: 'Ringkasan AI belum aktif. Tambahkan GROQ_API_KEY di Environment Variables Vercel.',
    })
  }

  const prompt = `Kamu adalah asisten penulisan laporan monitoring greenhouse melon hidroponik. Tulis ringkasan naratif dalam Bahasa Indonesia formal, 1-2 paragraf, siap ditempel ke laporan/skripsi, berdasarkan data berikut untuk periode ${periode} terakhir:

Statistik sensor (min/rata-rata/maks): ${JSON.stringify(stats)}
Jumlah titik data di luar rentang ideal per sensor: ${JSON.stringify(anomaliCount)}
Uptime perangkat 24 jam terakhir: ${uptime ?? 'tidak diketahui'}%
VPD (indikator stres tanaman) saat ini: ${vpd ?? 'tidak diketahui'} kPa

Tulis dengan gaya laporan teknis netral, sebutkan kondisi yang stabil dan yang perlu perhatian, hindari klaim berlebihan, dan jangan mengarang angka yang tidak ada di data.`

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
        max_tokens: 400,
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ text: 'Gagal membuat ringkasan (server AI merespons error).' })
    }

    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content ?? 'Tidak ada ringkasan.'
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ text: 'Gagal membuat ringkasan (koneksi ke server AI bermasalah).' })
  }
}
