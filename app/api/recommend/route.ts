import { NextResponse } from 'next/server'

// VPD (Vapor Pressure Deficit) -- rumus Tetens, sama seperti di dashboard
function hitungVPD(suhu: number | null | undefined, rh: number | null | undefined): number | null {
  if (suhu == null || rh == null) return null
  const svp = 0.6108 * Math.exp((17.27 * suhu) / (suhu + 237.3))
  return Number((svp * (1 - rh / 100)).toFixed(2))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { suhu_air, ph, tds, suhu_udara, hum_udara, lux, jarak, rentangIdeal } = body
  const vpd = hitungVPD(suhu_udara, hum_udara)

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({
      text: 'Rekomendasi AI belum aktif. Tambahkan GROQ_API_KEY di Environment Variables Vercel.',
    })
  }

  function fmtRentang(key: string) {
    const r = rentangIdeal?.[key]
    return r ? `${r[0]} - ${r[1]}` : 'tidak ditentukan'
  }

  const prompt = `Kamu asisten monitoring greenhouse akuaponik/hidroponik. Berdasarkan data sensor DAN rentang ideal yang SUDAH DITENTUKAN PENGGUNA di bawah ini, beri MAKSIMAL 3 rekomendasi paling prioritas dalam bahasa Indonesia, format list bernomor, singkat dan actionable (1-2 kalimat per poin), tanpa basa-basi.

PENTING:
- Nilai "rentang ideal" di bawah adalah acuan RESMI yang harus kamu pakai untuk menilai normal/tidaknya suatu sensor -- JANGAN pakai asumsi umummu sendiri soal sayuran/tanaman pada umumnya, walaupun asumsimu berbeda dari rentang ini.
- STRICT: maksimal 3 poin. Kalau lebih dari 3 sensor bermasalah, pilih 3 yang paling mendesak saja, jangan sebutkan semuanya.
- Setiap poin harus selesai dalam 1-2 kalimat, jangan bertele-tele.

Suhu air: ${suhu_air} C (rentang ideal: ${fmtRentang('suhu_air')})
pH: ${ph} (rentang ideal: ${fmtRentang('ph')})
TDS: ${tds} ppm (rentang ideal: ${fmtRentang('tds')})
Suhu udara: ${suhu_udara} C (rentang ideal: ${fmtRentang('suhu_udara')})
Kelembaban udara: ${hum_udara} % (rentang ideal: ${fmtRentang('hum_udara')})
Cahaya: ${lux} lux
Ketinggian air: ${jarak} cm
VPD (indikator stres tanaman): ${vpd ?? 'tidak dapat dihitung, data suhu/kelembaban udara belum ada'} kPa (rentang ideal: ${fmtRentang('vpd')})

Kalau semua nilai ada dalam rentang ideal yang diberikan, katakan kondisi baik dan beri satu tips perawatan ringan.`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 700,
        reasoning_effort: 'low',
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
