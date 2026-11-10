import { db } from './db'
import { addMes, dataNoMes, normalizar, uid } from './format'
import { recorrenteAtivo } from './mes'
import type { TransacaoBruta, FonteImport } from './nubank'
import type { Conta, Dados, Lancamento, Parcelado, Recorrente, Regra } from './types'

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

// palavras-chave → nome da categoria padrão
const PALAVRAS: Record<string, string[]> = {
  'Assinaturas': ['netflix', 'spotify', 'disney', 'hbo', 'hbomax', 'max', 'prime video', 'amazon prime', 'primevideo', 'youtube', 'google one', 'icloud', 'apple.com', 'apple com', 'deezer', 'globoplay', 'paramount', 'chatgpt', 'openai', 'claude', 'anthropic', 'crunchyroll', 'star+', 'tidal'],
  'Alimentação': ['ifood', 'ifd', 'rappi', 'restaurante', 'lanchonete', 'padaria', 'burger', 'mcdonalds', 'mc donalds', 'pizza', 'pizzaria', 'starbucks', 'outback', 'habibs', 'subway', 'cafe', 'cafeteria', 'acai', 'sorveteria', 'bk'],
  'Mercado': ['supermercado', 'mercado', 'carrefour', 'assai', 'atacadao', 'pao de acucar', 'hortifruti', 'sams club', 'dia supermercado', 'zaffari', 'big bompreco', 'mercearia', 'sacolao'],
  'Transporte': ['uber', '99app', '99 app', '99pop', 'cabify', 'posto', 'shell', 'ipiranga', 'petrobras', 'br mania', 'combustivel', 'estacionamento', 'sem parar', 'veloe', 'conectcar', 'metro', 'bilhete unico', 'onibus', 'pedagio'],
  'Saúde': ['drogasil', 'droga raia', 'drogaria', 'farmacia', 'pague menos', 'panvel', 'hospital', 'clinica', 'laboratorio', 'smart fit', 'smartfit', 'academia', 'bluefit', 'unimed', 'odonto'],
  'Compras': ['amazon', 'mercado livre', 'mercadolivre', 'mercadopago', 'shopee', 'aliexpress', 'magalu', 'magazine luiza', 'americanas', 'shein', 'renner', 'riachuelo', 'c&a', 'cea', 'zara', 'kabum', 'centauro', 'netshoes', 'temu'],
  'Lazer': ['cinema', 'cinemark', 'ingresso', 'sympla', 'steam', 'playstation', 'psn', 'xbox', 'nintendo', 'eventim', 'bar', 'boteco'],
  'Educação': ['udemy', 'alura', 'curso', 'escola', 'faculdade', 'universidade', 'livraria', 'coursera', 'duolingo'],
  'Moradia': ['aluguel', 'condominio', 'enel', 'cemig', 'sabesp', 'copel', 'light', 'energia', 'celesc', 'coelba', 'vivo', 'claro', 'tim', 'internet', 'gas'],
  'Salário': ['salario', 'folha de pagamento', 'proventos'],
}

const ASSINATURAS_CONHECIDAS = PALAVRAS['Assinaturas']

function contemPalavra(texto: string, palavra: string): boolean {
  const esc = palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(texto)
}

export function sugerirCategoria(desc: string, dados: Pick<Dados, 'categorias' | 'regras' | 'lancamentos'>): string | undefined {
  const n = normalizar(desc)
  // 1) regras do usuário (a mais específica vence)
  const regra = [...dados.regras].sort((a, b) => b.contem.length - a.contem.length).find((r) => n.includes(normalizar(r.contem)))
  if (regra && dados.categorias.some((c) => c.id === regra.categoriaId)) return regra.categoriaId
  // 2) mesmo estabelecimento já lançado antes
  const anterior = dados.lancamentos.find((l) => l.categoriaId && normalizar(l.descricao) === n)
  if (anterior) return anterior.categoriaId
  // 3) palavras-chave
  for (const [nomeCat, palavras] of Object.entries(PALAVRAS)) {
    if (palavras.some((p) => contemPalavra(n, p))) {
      const c = dados.categorias.find((c) => normalizar(c.nome) === normalizar(nomeCat))
      if (c) return c.id
    }
  }
  return undefined
}

const parecido = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b) * 0.1

export function analisar(trans: TransacaoBruta[], dados: Dados): LinhaRevisao[] {
  const hashes = new Set(dados.lancamentos.map((l) => l.importHash).filter(Boolean))
  return trans.map((t) => {
    const n = normalizar(t.descBase)
    const categoriaId = sugerirCategoria(t.descBase, dados)
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

export async function contaDestino(fonte: FonteImport, contas: Conta[]): Promise<string> {
  const tipo = fonte === 'cartao' ? 'cartao' : 'conta'
  const achada = contas.find((c) => c.tipo === tipo && /nubank|nu\b/i.test(c.nome)) ?? contas.find((c) => c.tipo === tipo)
  if (achada) return achada.id
  const nova: Conta = { id: uid(), nome: fonte === 'cartao' ? 'Nubank Cartão' : 'Nubank Conta', tipo, cor: '#820ad1', diaVencimento: fonte === 'cartao' ? 10 : undefined }
  await db.contas.add(nova)
  return nova.id
}

export interface ResumoImport { avulsos: number; parcelados: number; assinaturas: number; regras: number }

export async function salvarImportacao(linhas: LinhaRevisao[], opts: { fonte: FonteImport; contaId: string; mesFatura?: string; dados: Dados }): Promise<ResumoImport> {
  const { fonte, contaId, mesFatura, dados } = opts
  const conta = dados.contas.find((c) => c.id === contaId)
  const venc = conta?.diaVencimento ?? 10
  const sel = linhas.filter((l) => l.incluir)

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
      parcelados.push({ id: uid(), descricao: t.descBase, valorParcela: t.valor, parcelas: t.parcela.total, primeiroMes, categoriaId: l.categoriaId, contaId, pagos: {}, importKey })
    } else if (l.acao === 'assinatura') {
      const n = normalizar(t.descBase)
      const mes = mesCobranca(t)
      const ja = recorrentes.find((r) => normalizar(r.descricao) === n)
      if (ja) { if (mes < ja.inicio) ja.inicio = mes; continue }
      recorrentes.push({ id: uid(), tipo: 'assinatura', descricao: t.descBase, valor: t.valor, frequencia: 'mensal', dia: Number(t.data.slice(8, 10)), inicio: mes, categoriaId: l.categoriaId, contaId, pagos: {} })
    } else {
      const cartao = fonte === 'cartao' && mesFatura
      lancamentos.push({
        id: uid(), tipo: t.tipo, descricao: t.descricao, valor: t.valor,
        data: cartao ? dataNoMes(mesFatura!, venc) : t.data,
        dataOriginal: cartao ? t.data : undefined,
        categoriaId: l.categoriaId, contaId, importHash: t.hash,
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
    regras.push({ id: uid(), contem, categoriaId: l.categoriaId })
  }

  await db.transaction('rw', db.lancamentos, db.parcelados, db.recorrentes, db.regras, async () => {
    if (lancamentos.length) await db.lancamentos.bulkAdd(lancamentos)
    if (parcelados.length) await db.parcelados.bulkAdd(parcelados)
    if (recorrentes.length) await db.recorrentes.bulkAdd(recorrentes)
    if (regras.length) await db.regras.bulkAdd(regras)
  })
  return { avulsos: lancamentos.length, parcelados: parcelados.length, assinaturas: recorrentes.length, regras: regras.length }
}
