import { CATEGORIAS_PADRAO, db } from './db'
import { addMes, dataNoMes, normalizar, uid } from './format'
import { recorrenteAtivo } from './mes'
import { ASSINATURAS_CONHECIDAS, categoriaPorPalavra, contemPalavra, traduzirCategoriaDoBanco } from './categorizacao'
import { bancoDaConta, mesmoBanco } from './visao'
import type { TransacaoBruta, FonteImport } from './importadores'
import type { Categoria, Conta, Dados, Lancamento, Parcelado, Recorrente, Regra } from './types'

export type Acao = 'avulso' | 'parcelado' | 'assinatura'

export interface LinhaRevisao {
  id: string
  t: TransacaoBruta
  incluir: boolean
  acao: Acao
  categoriaId?: string
  categoriaSugerida?: string
  aviso?: string // por que veio desmarcado / observação
  sugestaoAssinatura?: boolean
}

/**
 * Categoria sugerida que ainda não existe: o id provisório é "nova:<Nome>" e ela só é
 * criada de verdade quando o usuário confirma a importação (e só se for usada).
 */
export const PREFIXO_NOVA = 'nova:'
export const ehNova = (id?: string) => !!id && id.startsWith(PREFIXO_NOVA)

/** Categorias padrão que o usuário ainda não tem, oferecidas na revisão como "(nova)". */
export function categoriasNovasDisponiveis(existentes: Categoria[]): Categoria[] {
  const tem = new Set(existentes.map((c) => normalizar(c.nome)))
  return CATEGORIAS_PADRAO.filter((c) => !tem.has(normalizar(c.nome))).map((c) => ({ ...c, id: PREFIXO_NOVA + c.nome }))
}

/**
 * Categoria sugerida para um item, nesta ordem:
 *  1) regra criada pelo usuário  2) mesmo estabelecimento já lançado antes
 *  3) palavra-chave do estabelecimento  4) categoria que o banco informou no arquivo
 * Devolve o id de uma categoria existente ou "nova:<Nome>" quando a sugerida ainda não existe.
 */
export function sugerirCategoria(desc: string, dados: Pick<Dados, 'categorias' | 'regras' | 'lancamentos'>, categoriaBanco?: string): string | undefined {
  const n = normalizar(desc)
  const regra = [...dados.regras].sort((a, b) => b.contem.length - a.contem.length).find((r) => n.includes(normalizar(r.contem)))
  if (regra && dados.categorias.some((c) => c.id === regra.categoriaId)) return regra.categoriaId
  const anterior = dados.lancamentos.find((l) => l.categoriaId && normalizar(l.descricao) === n)
  if (anterior) return anterior.categoriaId
  const nome = categoriaPorPalavra(desc) ?? traduzirCategoriaDoBanco(categoriaBanco)
  if (!nome) return undefined
  const c = dados.categorias.find((c) => normalizar(c.nome) === normalizar(nome))
  return c ? c.id : PREFIXO_NOVA + nome
}

const parecido = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b) * 0.1

export function analisar(trans: TransacaoBruta[], dados: Dados): LinhaRevisao[] {
  const hashes = new Set(dados.lancamentos.map((l) => l.importHash).filter(Boolean))
  return trans.map((t) => {
    const n = normalizar(t.descBase)
    const categoriaId = sugerirCategoria(t.descBase, dados, t.categoriaBanco)
    let incluir = !t.ignorarPadrao
    let aviso = t.ignorarPadrao ? `Ignorado por padrão: ${t.ignorarPadrao}` : undefined
    let acao: Acao = t.parcela ? 'parcelado' : 'avulso'

    if (hashes.has(t.hash)) { incluir = false; aviso = 'Já importado antes' }

    // assinatura já cadastrada?
    const mes = t.data.slice(0, 7)
    const chave = n.split(/[^a-z0-9]+/).find((w) => w.length >= 4) ?? n
    const recJa = dados.recorrentes.find((r) => {
      const rn = normalizar(r.descricao)
      return r.tipo !== 'receita' && (rn.includes(chave) || (rn.length >= 4 && n.includes(rn))) &&
        parecido(r.valor, t.valor) && (recorrenteAtivo(r, mes) || recorrenteAtivo(r, addMes(mes, 1)))
    })
    if (incluir && t.tipo === 'despesa' && !t.parcela && recJa) { incluir = false; aviso = `Já cadastrada como recorrente (“${recJa.descricao}”)` }

    // sugestão de assinatura: nome conhecido ou repete em meses diferentes com valor parecido
    let sugestaoAssinatura = false
    if (t.tipo === 'despesa' && !t.parcela && !recJa) {
      const conhecida = ASSINATURAS_CONHECIDAS.some((p) => contemPalavra(n, p))
      const repeteNoArquivo = trans.some((o) => o !== t && normalizar(o.descBase) === n && o.data.slice(0, 7) !== mes && parecido(o.valor, t.valor))
      const repeteAntes = dados.lancamentos.some((l) => l.importHash !== t.hash && normalizar(l.descricao) === n &&
        !(l.dataOriginal ?? l.data).startsWith(mes) && parecido(l.valor, t.valor))
      sugestaoAssinatura = conhecida || repeteNoArquivo || repeteAntes
      if (sugestaoAssinatura && incluir) acao = 'assinatura'
    }

    // parcelado já existente (fatura anterior importada)?
    if (t.parcela && incluir) {
      const existe = dados.parcelados.some((p) => normalizar(p.descricao) === n && parecido(p.valorParcela, t.valor) && p.parcelas === t.parcela!.total)
      if (existe) { incluir = false; aviso = 'Compra parcelada já cadastrada' }
    }

    return { id: uid(), t, incluir, acao, categoriaId, categoriaSugerida: categoriaId, aviso, sugestaoAssinatura }
  })
}

const COR_BANCO: Record<string, string> = {
  'Nubank': '#820ad1', 'Inter': '#ff7a00', 'Itaú': '#ec7000', 'Bradesco': '#cc092f', 'Santander': '#ec0000',
  'C6 Bank': '#242424', 'Banco do Brasil': '#f8d117', 'Caixa': '#005ca9', 'PicPay': '#21c25e', 'Mercado Pago': '#00b1ea',
}

/**
 * Conta/cartão onde a importação vai cair: uma existente do mesmo banco e tipo; se o banco é conhecido
 * e não existe, cria "<Banco> Cartão/Conta"; senão usa a primeira do tipo (o usuário pode trocar na revisão).
 */
export function contaDestino(fonte: FonteImport, contas: Conta[], banco?: string): { contaId: string } | { nova: Conta } {
  const tipo = fonte === 'cartao' ? 'cartao' : 'conta'
  const doTipo = contas.filter((c) => c.tipo === tipo)
  if (banco) {
    const achada = doTipo.find((c) => mesmoBanco(bancoDaConta(c), banco))
    if (achada) return { contaId: achada.id }
  } else if (doTipo.length) return { contaId: doTipo[0].id }
  const nome = banco ? `${banco} ${fonte === 'cartao' ? 'Cartão' : 'Conta'}` : fonte === 'cartao' ? 'Cartão de crédito' : 'Conta corrente'
  // só é gravada quando o usuário confirma a importação
  return { nova: { id: uid(), nome, tipo, banco, cor: (banco && COR_BANCO[banco]) || '#64748b', diaVencimento: fonte === 'cartao' ? 10 : undefined } }
}

export interface ResumoImport {
  avulsos: number; parcelados: number; assinaturas: number; regras: number
  categoriasCriadas: string[] // ex.: ["🍔 Alimentação", "🚗 Transporte"]
  mesPrincipal?: string // mês com mais itens importados (para abrir o extrato)
}

export async function salvarImportacao(linhas: LinhaRevisao[], opts: { fonte: FonteImport; contaId: string; contaNova?: Conta; mesFatura?: string; dados: Dados }): Promise<ResumoImport> {
  const { fonte, contaId, contaNova, mesFatura, dados } = opts
  if (contaNova && contaNova.id === contaId) await db.contas.add(contaNova)
  const conta = contaNova?.id === contaId ? contaNova : dados.contas.find((c) => c.id === contaId)
  const venc = conta?.diaVencimento ?? 10
  const sel = linhas.filter((l) => l.incluir)

  // cria só as categorias sugeridas ("nova:…") que foram de fato usadas
  const novas: Categoria[] = []
  const idReal = new Map<string, string>()
  for (const l of sel) {
    if (!ehNova(l.categoriaId) || idReal.has(l.categoriaId!)) continue
    const nome = l.categoriaId!.slice(PREFIXO_NOVA.length)
    const padrao = CATEGORIAS_PADRAO.find((c) => c.nome === nome)
    const c: Categoria = { emoji: '🏷️', cor: '#64748b', ...padrao, nome, id: uid() }
    novas.push(c)
    idReal.set(l.categoriaId!, c.id)
  }
  const cat = (id?: string) => (id && idReal.get(id)) || (ehNova(id) ? undefined : id)

  const lancamentos: Lancamento[] = []
  const parcelados: Parcelado[] = []
  const recorrentes: Recorrente[] = []
  const chavesParc = new Set(dados.parcelados.map((p) => p.importKey).filter(Boolean))

  const mesCobranca = (t: TransacaoBruta) => (fonte === 'cartao' && mesFatura ? mesFatura : t.data.slice(0, 7))

  for (const l of sel) {
    const t = l.t
    if (l.acao === 'parcelado' && t.parcela) {
      const primeiroMes = addMes(mesCobranca(t), -(t.parcela.n - 1))
      const importKey = `${normalizar(t.descBase)}|${t.valor}|${t.parcela.total}|${primeiroMes}`
      if (chavesParc.has(importKey)) continue
      chavesParc.add(importKey)
      parcelados.push({ id: uid(), descricao: t.descBase, valorParcela: t.valor, parcelas: t.parcela.total, primeiroMes, categoriaId: cat(l.categoriaId), contaId, pagos: {}, importKey })
    } else if (l.acao === 'assinatura') {
      const n = normalizar(t.descBase)
      const mes = mesCobranca(t)
      const ja = recorrentes.find((r) => normalizar(r.descricao) === n)
      if (ja) { if (mes < ja.inicio) ja.inicio = mes; continue }
      recorrentes.push({ id: uid(), tipo: 'assinatura', descricao: t.descBase, valor: t.valor, frequencia: 'mensal', dia: Number(t.data.slice(8, 10)), inicio: mes, categoriaId: cat(l.categoriaId), contaId, pagos: {} })
    } else {
      const cartao = fonte === 'cartao' && mesFatura
      lancamentos.push({
        id: uid(), tipo: t.tipo, descricao: t.descricao, valor: t.valor,
        data: cartao ? dataNoMes(mesFatura!, venc) : t.data,
        dataOriginal: cartao ? t.data : undefined,
        categoriaId: cat(l.categoriaId), contaId, importHash: t.hash,
      })
    }
  }

  // aprende regras: quando o usuário trocou a categoria sugerida
  const regras: Regra[] = []
  const existentes = new Set(dados.regras.map((r) => normalizar(r.contem)))
  for (const l of sel) {
    if (!l.categoriaId || l.categoriaId === l.categoriaSugerida) continue
    const contem = normalizar(l.t.descBase).replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim()
    if (contem.length < 3 || existentes.has(contem)) continue
    existentes.add(contem)
    const real = cat(l.categoriaId)
    if (real) regras.push({ id: uid(), contem, categoriaId: real })
  }

  await db.transaction('rw', [db.categorias, db.lancamentos, db.parcelados, db.recorrentes, db.regras], async () => {
    if (novas.length) await db.categorias.bulkAdd(novas)
    if (lancamentos.length) await db.lancamentos.bulkAdd(lancamentos)
    if (parcelados.length) await db.parcelados.bulkAdd(parcelados)
    if (recorrentes.length) await db.recorrentes.bulkAdd(recorrentes)
    if (regras.length) await db.regras.bulkAdd(regras)
  })
  const meses = new Map<string, number>()
  for (const l of lancamentos) meses.set(l.data.slice(0, 7), (meses.get(l.data.slice(0, 7)) ?? 0) + 1)
  const mesPrincipal = [...meses.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? (fonte === 'cartao' ? mesFatura : undefined)
  return {
    avulsos: lancamentos.length, parcelados: parcelados.length, assinaturas: recorrentes.length, regras: regras.length,
    categoriasCriadas: novas.map((c) => `${c.emoji} ${c.nome}`),
    mesPrincipal,
  }
}
