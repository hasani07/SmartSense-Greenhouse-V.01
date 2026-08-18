import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Pakai service_role key karena perlu baca info sistem (ukuran database)
// dan daftar file di bucket privat 'backups'. Hanya dipakai server-side.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AMBANG_PERSEN = 80

export async function GET() {
  try {
    const { data: infoData, error: errInfo } = await supabaseAdmin.rpc('ukuran_database_info')
    if (errInfo) throw errInfo
    const info = infoData && infoData[0] ? infoData[0] : { mb_terpakai: null, persen: null }

    const { data: files, error: errList } = await supabaseAdmin.storage
      .from('backups')
      .list('', { sortBy: { column: 'created_at', order: 'desc' }, limit: 1 })
    if (errList) throw errList

    const terbaru = files && files.length > 0 ? files[0] : null

    return NextResponse.json({
      mb_terpakai: info.mb_terpakai,
      persen: info.persen,
      ambang: AMBANG_PERSEN,
      backup_terakhir: terbaru ? { nama: terbaru.name, waktu: terbaru.created_at } : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
