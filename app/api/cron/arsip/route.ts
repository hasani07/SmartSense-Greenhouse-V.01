import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Route ini pakai service_role key (akses penuh, bukan anon key)
// karena perlu bisa DELETE data tanpa dibatasi RLS. JANGAN pernah
// pakai service_role key di kode frontend/client -- hanya di sini,
// di kode server yang jalan di Vercel.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AMBANG_PERSEN = 80   // mulai arsip kalau database sudah kepakai segini %
const SIMPAN_HARI = 7      // data yang lebih baru dari ini TETAP disimpan di database

export async function GET(req: Request) {
  const url = new URL(req.url)
  const paksa = url.searchParams.get('paksa') === '1'
  const secretQuery = url.searchParams.get('secret')

  // Keamanan: hanya boleh dipanggil oleh Vercel Cron (header otomatis),
  // atau manual lewat browser dengan ?secret=... untuk keperluan testing.
  const authHeader = req.headers.get('authorization')
  const cocokHeader = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`
  const cocokQuery = process.env.CRON_SECRET && secretQuery === process.env.CRON_SECRET
  if (process.env.CRON_SECRET && !cocokHeader && !cocokQuery) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: persenData, error: errPersen } = await supabaseAdmin.rpc('ukuran_database_persen')
    if (errPersen) throw errPersen
    const persen = persenData as number

    if (!paksa && persen < AMBANG_PERSEN) {
      return NextResponse.json({ status: 'aman', persen_terpakai: persen, ambang: AMBANG_PERSEN })
    }

    const batasWaktu = new Date(Date.now() - SIMPAN_HARI * 24 * 3600 * 1000).toISOString()

    const { data: dataLama, error: errSelect } = await supabaseAdmin
      .from('readings')
      .select('*')
      .lt('created_at', batasWaktu)
      .order('created_at', { ascending: true })

    if (errSelect) throw errSelect

    if (!dataLama || dataLama.length === 0) {
      return NextResponse.json({ status: 'penuh_tapi_tidak_ada_data_lama', persen_terpakai: persen })
    }

    // Susun jadi CSV
    const kolom = Object.keys(dataLama[0])
    const header = kolom.join(',')
    const baris = dataLama.map((r: any) => kolom.map((k) => r[k] ?? '').join(',')).join('\n')
    const csv = header + '\n' + baris

    const namaFile = `arsip-readings-${new Date().toISOString().slice(0, 10)}-${Date.now()}.csv`

    const { error: errUpload } = await supabaseAdmin.storage
      .from('backups')
      .upload(namaFile, csv, { contentType: 'text/csv', upsert: true })

    if (errUpload) throw errUpload

    const idLama = dataLama.map((r: any) => r.id)
    const { error: errDelete } = await supabaseAdmin
      .from('readings')
      .delete()
      .in('id', idLama)

    if (errDelete) throw errDelete

    return NextResponse.json({
      status: 'diarsipkan',
      persen_sebelum: persen,
      jumlah_baris_diarsip: dataLama.length,
      file: namaFile,
      simpan_hari_terakhir: SIMPAN_HARI,
    })
  } catch (err: any) {
    return NextResponse.json({ status: 'error', pesan: err.message }, { status: 500 })
  }
}
