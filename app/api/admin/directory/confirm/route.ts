import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkAnyAuth } from '@/app/lib/session-token';
import { normalizeSohName, buildSearchText } from '@/app/lib/directory/normalize';
import type { MappedDirectoryRow } from '@/app/lib/import/validate-directory';
import { autoMergeProvisionals } from '@/app/lib/directory/merge-provisional';

interface ConfirmBody {
  jobId: number;
  // Хэрэглэгч одоогоор хийсэн override-уудыг (rowId → action) дамжуулна.
  // Жишээ: { '12': 'apply_new', '13': 'merge_existing', '14': 'skip' }
  overrides?: Record<string, 'apply_new' | 'merge_existing' | 'skip'>;
}

// Preview мөрүүдийг бодит бичлэг рүү хувирган бичнэ.
// status === 'NEW_RECORD' -> insert hoa_directory
// status === 'MATCHED' -> hoa_directory шинэчлэх (зөөлөн merge — хоосон талбаруудыг нөхөх)
// status === 'DUPLICATE' -> default skip; зөвхөн override 'apply_new' эсвэл 'merge_existing' үед хийнэ
// status === 'ERROR' -> зөвхөн override-той бол хийгдэнэ.
export async function POST(req: NextRequest) {
  const auth = await checkAnyAuth('admin', 'superadmin');
  if (!auth.valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: ConfirmBody = await req.json();
    if (!body.jobId) return NextResponse.json({ error: 'jobId шаардлагатай' }, { status: 400 });

    const overrides = body.overrides || {};

    // Job-ыг шалгах
    const { data: job, error: jobError } = await supabaseAdmin
      .from('directory_import_jobs')
      .select('id, status')
      .eq('id', body.jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job олдсонгүй' }, { status: 404 });
    }
    if (job.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Энэ job аль хэдийн дууссан' }, { status: 400 });
    }

    // Preview мөрүүд татах
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('directory_import_rows')
      .select('id, row_number, mapped_json, status, suggested_directory_id, error_message')
      .eq('import_job_id', body.jobId)
      .order('row_number', { ascending: true });

    if (rowsError) {
      return NextResponse.json({ error: 'Preview мөр татахад алдаа гарлаа' }, { status: 500 });
    }

    let imported = 0;
    let skipped = 0;
    let merged = 0;
    let errors = 0;

    for (const row of rows || []) {
      const override = overrides[String(row.id)];
      const status = row.status as string;
      const mapped = row.mapped_json as (MappedDirectoryRow & { normalized_name?: string }) | null;

      // Action шийдвэрлэх
      let action: 'create' | 'merge' | 'skip' = 'skip';
      if (override === 'skip') action = 'skip';
      else if (override === 'apply_new') action = 'create';
      else if (override === 'merge_existing') action = 'merge';
      else if (status === 'NEW_RECORD') action = 'create';
      else if (status === 'MATCHED') action = 'merge';
      else if (status === 'DUPLICATE') action = 'skip';
      else if (status === 'ERROR') action = 'skip';

      if (!mapped && action !== 'skip') {
        skipped++;
        await supabaseAdmin.from('directory_import_rows').update({ status: 'SKIPPED' }).eq('id', row.id);
        continue;
      }

      if (action === 'skip') {
        skipped++;
        continue;
      }

      const normalized = normalizeSohName(mapped!.officialName);
      const searchText = buildSearchText({
        officialName: mapped!.officialName,
        displayName: mapped!.displayName,
        aliases: mapped!.aliases,
        district: mapped!.district,
        khoroo: mapped!.khoroo,
        address: mapped!.address,
        sohCode: mapped!.sohCode,
      });

      try {
        if (action === 'create') {
          const insertData = {
            official_name: mapped!.officialName,
            normalized_name: normalized,
            display_name: mapped!.displayName,
            district: mapped!.district,
            khoroo: mapped!.khoroo,
            address: mapped!.address,
            phone: mapped!.phone,
            soh_code: mapped!.sohCode,
            building_count: mapped!.buildingCount,
            unit_count: mapped!.unitCount,
            status: mapped!.status,
            search_text: searchText,
            source: 'import',
          };
          const { data: created, error: createErr } = await supabaseAdmin
            .from('hoa_directory')
            .insert(insertData)
            .select('id')
            .single();

          if (createErr) {
            // Магадгүй UNIQUE normalized_name давхцал — fallback merge
            const { data: existing } = await supabaseAdmin
              .from('hoa_directory')
              .select('id')
              .eq('normalized_name', normalized)
              .single();
            if (existing?.id) {
              await mergeIntoDirectory(existing.id as number, mapped!, searchText);
              merged++;
              await supabaseAdmin
                .from('directory_import_rows')
                .update({ status: 'MATCHED', suggested_directory_id: existing.id })
                .eq('id', row.id);
              continue;
            }
            errors++;
            await supabaseAdmin
              .from('directory_import_rows')
              .update({ status: 'ERROR', error_message: createErr.message })
              .eq('id', row.id);
            continue;
          }

          if (created?.id) {
            await insertAliases(created.id as number, mapped!.aliases);
          }
          imported++;
          await supabaseAdmin
            .from('directory_import_rows')
            .update({ status: 'NEW_RECORD', suggested_directory_id: created?.id ?? null })
            .eq('id', row.id);
          continue;
        }

        if (action === 'merge') {
          let targetId = row.suggested_directory_id as number | null;
          if (!targetId) {
            const { data: existing } = await supabaseAdmin
              .from('hoa_directory')
              .select('id')
              .eq('normalized_name', normalized)
              .single();
            targetId = existing?.id as number | undefined ?? null;
          }
          if (!targetId) {
            // Merge target байхгүй — create дахь fallback хийнэ
            const insertData = {
              official_name: mapped!.officialName,
              normalized_name: normalized,
              display_name: mapped!.displayName,
              district: mapped!.district,
              khoroo: mapped!.khoroo,
              address: mapped!.address,
              phone: mapped!.phone,
              soh_code: mapped!.sohCode,
              building_count: mapped!.buildingCount,
              unit_count: mapped!.unitCount,
              status: mapped!.status,
              search_text: searchText,
              source: 'import',
            };
            const { data: created } = await supabaseAdmin
              .from('hoa_directory')
              .insert(insertData)
              .select('id')
              .single();
            if (created?.id) {
              await insertAliases(created.id as number, mapped!.aliases);
              imported++;
              await supabaseAdmin
                .from('directory_import_rows')
                .update({ status: 'NEW_RECORD', suggested_directory_id: created.id })
                .eq('id', row.id);
            }
            continue;
          }
          await mergeIntoDirectory(targetId, mapped!, searchText);
          merged++;
          await supabaseAdmin
            .from('directory_import_rows')
            .update({ status: 'MATCHED', suggested_directory_id: targetId })
            .eq('id', row.id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        errors++;
        await supabaseAdmin
          .from('directory_import_rows')
          .update({ status: 'ERROR', error_message: msg })
          .eq('id', row.id);
      }
    }

    await supabaseAdmin
      .from('directory_import_jobs')
      .update({
        status: 'COMPLETED',
        imported_rows: imported,
        skipped_rows: skipped,
        summary_json: {
          imported,
          merged,
          skipped,
          errors,
        },
      })
      .eq('id', body.jobId);

    // Импортын дараа provisional → directory auto-merge оролдох (high confidence-д)
    let autoMerge: Awaited<ReturnType<typeof autoMergeProvisionals>> | null = null;
    if (imported > 0 || merged > 0) {
      try {
        autoMerge = await autoMergeProvisionals({ mergedBy: `import:job:${body.jobId}` });
      } catch (e) {
        console.error('[directory/confirm] auto-merge error', e);
      }
    }

    return NextResponse.json({ imported, merged, skipped, errors, autoMerge });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[directory/confirm] unexpected:', msg);
    return NextResponse.json({ error: 'Серверийн алдаа' }, { status: 500 });
  }
}

async function insertAliases(directoryId: number, aliases: string[]) {
  if (!aliases || aliases.length === 0) return;
  const rows = aliases
    .map((a) => a.trim())
    .filter(Boolean)
    .map((alias) => ({
      directory_id: directoryId,
      alias,
      normalized_alias: normalizeSohName(alias),
    }))
    .filter((r) => r.normalized_alias);
  if (rows.length === 0) return;
  await supabaseAdmin.from('hoa_directory_aliases').upsert(rows, {
    onConflict: 'directory_id,normalized_alias',
    ignoreDuplicates: true,
  });
}

async function mergeIntoDirectory(directoryId: number, mapped: MappedDirectoryRow, searchText: string) {
  // Хоосон талбаруудыг нөхөж шинэчлэх (одоо байгааг overwrite хийхгүй)
  const { data: current } = await supabaseAdmin
    .from('hoa_directory')
    .select('display_name, district, khoroo, address, phone, soh_code, building_count, unit_count')
    .eq('id', directoryId)
    .single();

  const update: Record<string, unknown> = { search_text: searchText };
  if (!current?.display_name && mapped.displayName) update.display_name = mapped.displayName;
  if (!current?.district && mapped.district) update.district = mapped.district;
  if (!current?.khoroo && mapped.khoroo) update.khoroo = mapped.khoroo;
  if (!current?.address && mapped.address) update.address = mapped.address;
  if (!current?.phone && mapped.phone) update.phone = mapped.phone;
  if (!current?.soh_code && mapped.sohCode) update.soh_code = mapped.sohCode;
  if (!current?.building_count && mapped.buildingCount) update.building_count = mapped.buildingCount;
  if (!current?.unit_count && mapped.unitCount) update.unit_count = mapped.unitCount;

  await supabaseAdmin.from('hoa_directory').update(update).eq('id', directoryId);
  await insertAliases(directoryId, mapped.aliases);
}
