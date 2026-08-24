/**
 * Seed de QUESTÕES placeholder para o quiz (ContrataPJ Academy).
 *
 * Cria um pequeno banco de questões DUMMY (enunciado genérico + 4 alternativas,
 * 1 correta) para cada módulo PUBLICADO, só para validar o fluxo ponta-a-ponta
 * (concluir aulas -> "Fazer teste" -> passar >=80% -> certificado em
 * /certificados). NÃO são questões reais — troque pelo banco definitivo via CMS
 * (Fase 6) quando existir.
 *
 * Idempotente: por padrão, PULA módulos que já têm questões (não duplica). Use
 * `--reset` para APAGAR as questões existentes dos módulos-alvo e recriar (o
 * ON DELETE CASCADE de question_options limpa as alternativas junto).
 *
 * A geração (`buildSeedQuestions`) é PURA (sem I/O), para o teste.
 *
 * Uso:
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   npx tsx --import ./wspoly.mjs scripts/seed-questions.ts             # aplica
 *
 *   npx tsx --import ./wspoly.mjs scripts/seed-questions.ts --dry-run   # só mostra
 *   npx tsx --import ./wspoly.mjs scripts/seed-questions.ts --reset     # recria
 *   MODULE_ORDEM=1 npx tsx --import ./wspoly.mjs scripts/seed-questions.ts  # só 1 módulo
 *
 * Precisa do service_role porque question_options.correta é protegida por RLS
 * (só-autor) — o service_role ignora RLS. Rode com --import ./wspoly.mjs (o mesmo
 * polyfill de WebSocket usado no seed-lessons).
 */

/** Quantas questões por módulo o seed placeholder cria. */
export const QUESTIONS_PER_MODULE = 5

/** Quantas alternativas por questão. */
export const OPTIONS_PER_QUESTION = 4

export interface SeedOption {
  texto: string
  correta: boolean
}

export interface SeedQuestion {
  enunciado: string
  options: SeedOption[]
}

/**
 * Gera `count` questões dummy para um módulo. PURA e determinística: mesma
 * entrada -> mesma saída, sem rede. Cada questão tem `OPTIONS_PER_QUESTION`
 * alternativas e EXATAMENTE UMA correta (a 1ª — a ordem no banco é irrelevante,
 * o cliente embaralha a exibição). O texto referencia o módulo para dar contexto.
 */
export function buildSeedQuestions(
  moduleTitulo: string,
  count: number = QUESTIONS_PER_MODULE,
): SeedQuestion[] {
  const questions: SeedQuestion[] = []
  for (let i = 1; i <= count; i++) {
    const options: SeedOption[] = []
    for (let j = 1; j <= OPTIONS_PER_QUESTION; j++) {
      options.push({
        texto:
          j === 1
            ? `Alternativa correta da questão ${i} (${moduleTitulo})`
            : `Alternativa incorreta ${j} da questão ${i} (${moduleTitulo})`,
        correta: j === 1,
      })
    }
    questions.push({
      enunciado: `[Placeholder] Questão ${i} do módulo "${moduleTitulo}" — marque a alternativa correta.`,
      options,
    })
  }
  return questions
}

/** Executa o seed contra o Supabase usando service_role (bypassa RLS). */
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const reset = process.argv.includes('--reset')
  const onlyOrdem = process.env.MODULE_ORDEM ? Number(process.env.MODULE_ORDEM) : null

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (o seed grava a coluna protegida question_options.correta).',
    )
  }

  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1) Módulos-alvo: publicados (ou só o MODULE_ORDEM informado).
  let q = db.from('modules').select('id, ordem, titulo').eq('publicado', true)
  if (onlyOrdem != null) q = q.eq('ordem', onlyOrdem)
  const { data: mods, error: mErr } = await q.order('ordem', { ascending: true })
  if (mErr) throw mErr
  if (!mods || mods.length === 0) {
    console.log('Nenhum módulo publicado encontrado — nada a semear. (Rode o seed de aulas antes.)')
    return
  }

  console.log(
    `Alvo: ${mods.length} módulo(s) publicado(s)` +
      (onlyOrdem != null ? ` (ordem ${onlyOrdem})` : '') +
      `. ${QUESTIONS_PER_MODULE} questões x ${OPTIONS_PER_QUESTION} alternativas cada.`,
  )

  let created = 0
  let skipped = 0

  for (const m of mods) {
    // Idempotência: quantas questões o módulo já tem.
    const { count: existing, error: cErr } = await db
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', m.id)
    if (cErr) throw cErr

    if (existing && existing > 0) {
      if (!reset) {
        console.log(`  módulo ${m.ordem} "${m.titulo}": já tem ${existing} questão(ões) — pulado (use --reset para recriar).`)
        skipped++
        continue
      }
      if (!dryRun) {
        // CASCADE apaga as question_options junto.
        const { error: dErr } = await db.from('questions').delete().eq('module_id', m.id)
        if (dErr) throw dErr
      }
      console.log(`  módulo ${m.ordem} "${m.titulo}": --reset removeu ${existing} questão(ões) existentes.`)
    }

    const seed = buildSeedQuestions(m.titulo)

    if (dryRun) {
      console.log(`  módulo ${m.ordem} "${m.titulo}": geraria ${seed.length} questões (dry-run).`)
      continue
    }

    // 2) Insere as questões e recupera os ids.
    const { data: insertedQs, error: qErr } = await db
      .from('questions')
      .insert(seed.map((s) => ({ module_id: m.id, enunciado: s.enunciado })))
      .select('id')
    if (qErr) throw qErr
    if (!insertedQs || insertedQs.length !== seed.length) {
      throw new Error(`módulo ${m.ordem}: esperava ${seed.length} questões inseridas, veio ${insertedQs?.length ?? 0}.`)
    }

    // 3) Insere as alternativas de cada questão (mesma ordem da geração).
    const optionRows = seed.flatMap((s, idx) =>
      s.options.map((o) => ({
        question_id: insertedQs[idx].id,
        texto: o.texto,
        correta: o.correta,
      })),
    )
    const { error: oErr } = await db.from('question_options').insert(optionRows)
    if (oErr) throw oErr

    console.log(`  módulo ${m.ordem} "${m.titulo}": ${seed.length} questões + ${optionRows.length} alternativas.`)
    created++
  }

  console.log(
    dryRun
      ? '--dry-run: nada gravado.'
      : `Seed de questões concluído: ${created} módulo(s) semeado(s), ${skipped} pulado(s).`,
  )
}

// Só executa quando rodado diretamente (não ao ser importado pelo teste).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
