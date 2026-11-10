/**
 * Leitores dos arquivos exportados pelo Nubank. Tudo roda localmente.
 * Cada parser devolve transações "brutas" num formato comum; a análise (categoria,
 * duplicatas, parcelados, assinaturas) fica em importacao.ts.
 */
import { addMes, arred, normalizar } from './format'

export type FonteImport = 'cartao' | 'conta'

export interface TransacaoBruta {
  fonte: FonteImport
  data: string // YYYY-MM-DD da transação
  descricao: string // texto original
  descBase: string // limpo: sem "Parcela X/Y", prefixos de Pix etc.
  valor: number // sempre positivo
  tipo: 'despesa' | 'receita'
  hash: string // identificador estável para evitar duplicatas
  parcela?: { n: number; total: number }
  ignorarPadrao?: string // motivo para vir desmarcado
}

export interface ResultadoParse {
  formato: 'nubank-cartao-csv' | 'nubank-conta-csv' | 'ofx-cartao' | 'ofx-conta'
  fonte: FonteImport
  transacoes: TransacaoBruta[]
  mesFatura?: string // só para cartão: mês de vencimento sugerido
}

// ---------- utilidades ----------

export function lerCSV(texto: string): string[][] {
  const linhas: string[][] = []
  let campo = '', linha: string[] = [], aspas = false
  const t = texto.replace(/^﻿/, '')
  const primeira = t.split(/\r?\n/, 1)[0]
  const sep = primeira.includes(';') && !primeira.includes(',') ? ';' : ','
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') aspas = false
      else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((c) => c.trim() !== '')) linhas.push(linha)
      linha = []
    } else campo += ch
  }
  linha.push(campo)
  if (linha.some((c) => c.trim() !== '')) linhas.push(linha)
  return linhas
}

const RE_PARCELA = /\s*-?\s*parcela\s+(\d{1,3})\s*\/\s*(\d{1,3})\s*$/i

export function extrairParcela(desc: string): { base: string; parcela?: { n: number; total: number } } {
  const m = desc.match(RE_PARCELA)
  if (!m) return { base: desc.trim() }
  const n = Number(m[1]), total = Number(m[2])
  if (!(n >= 1 && total >= 2 && n <= total)) return { base: desc.trim() }
  return { base: desc.slice(0, m.index).trim(), parcela: { n, total } }
}

/** Deixa a descrição do extrato da conta mais legível. */
export function limparDescConta(desc: string): string {
  const d = desc.trim()
  const pix = d.match(/^Transfer[eê]ncia (enviada|recebida)(?: pelo Pix)? - ([^-]+)/i)
  if (pix) return `Pix ${pix[1].toLowerCase() === 'enviada' ? 'enviado' : 'recebido'} - ${pix[2].trim()}`
  return d
    .replace(/^Compra no d[eé]bito(?: via NuPay)? - /i, '')
    .replace(/^Compra no cr[eé]dito - /i, '')
    .replace(/^Pagamento de boleto efetuado - /i, 'Boleto - ')
    .trim()
}

function hashTexto(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** adiciona um sufixo de ocorrência quando a mesma chave se repete no arquivo (ex.: 2 Ubers iguais no mesmo dia) */
function contador() {
  const vistos = new Map<string, number>()
  return (chave: string) => {
    const n = (vistos.get(chave) ?? 0) + 1
    vistos.set(chave, n)
    return n === 1 ? chave : `${chave}#${n}`
  }
}

function mesDoNomeArquivo(nome?: string): string | undefined {
  const m = nome?.match(/(20\d{2})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : undefined
}

const valorNum = (s: string) => {
  const t = s.trim().replace(/\s/g, '')
  // "1.234,56" (BR) ou "1234.56"
  if (/,\d{1,2}$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'))
  return Number(t.replace(/,/g, ''))
}

// ---------- detecção ----------

export function analisarArquivo(texto: string, nomeArquivo?: string): ResultadoParse {
  if (/<OFX>|OFXHEADER/i.test(texto)) return parseOFX(texto, nomeArquivo)
  const linhas = lerCSV(texto)
  if (!linhas.length) throw new Error('Arquivo vazio.')
  const cab = linhas[0].map((c) => normalizar(c))
  if (cab.includes('date') && cab.includes('title') && cab.includes('amount')) return parseCartaoCSV(linhas, nomeArquivo)
  if (cab.includes('data') && cab.includes('valor') && cab.includes('identificador')) return parseContaCSV(linhas)
  throw new Error('Formato não reconhecido. Use o CSV da fatura (date,title,amount), o CSV do extrato da conta (Data,Valor,Identificador,Descrição) ou um arquivo OFX do Nubank.')
}

// ---------- fatura do cartão (CSV) ----------

export function parseCartaoCSV(linhas: string[][], nomeArquivo?: string): ResultadoParse {
  const cab = linhas[0].map((c) => normalizar(c))
  const iD = cab.indexOf('date'), iT = cab.indexOf('title'), iA = cab.indexOf('amount')
  const unico = contador()
  const transacoes: TransacaoBruta[] = []
  for (const l of linhas.slice(1)) {
    const data = (l[iD] ?? '').trim()
    const titulo = (l[iT] ?? '').trim()
    const v = valorNum(l[iA] ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !titulo || !Number.isFinite(v) || v === 0) continue
    const { base, parcela } = extrairParcela(titulo)
    const credito = v < 0
    transacoes.push({
      fonte: 'cartao',
      data,
      descricao: titulo,
      descBase: base,
      valor: arred(Math.abs(v)),
      tipo: credito ? 'receita' : 'despesa',
      parcela: credito ? undefined : parcela,
      hash: 'nu-cartao:' + unico(`${data}|${arred(v)}|${hashTexto(normalizar(titulo))}`),
      ignorarPadrao: credito ? (/pagamento recebido/i.test(titulo) ? 'pagamento da fatura' : 'crédito/estorno') : undefined,
    })
  }
  return { formato: 'nubank-cartao-csv', fonte: 'cartao', transacoes, mesFatura: mesFaturaSugerido(transacoes, nomeArquivo) }
}

function mesFaturaSugerido(ts: TransacaoBruta[], nomeArquivo?: string): string | undefined {
  const doNome = mesDoNomeArquivo(nomeArquivo)
  if (doNome) return doNome
  const datas = ts.filter((t) => t.tipo === 'despesa').map((t) => t.data).sort()
  return datas.length ? addMes(datas[datas.length - 1].slice(0, 7), 1) : undefined
}

// ---------- extrato da conta (CSV) ----------

const IGNORAR_CONTA: [RegExp, string][] = [
  [/pagamento de fatura/i, 'pagamento da fatura do cartão'],
  [/aplica[cç][aã]o rdb|resgate rdb|caixinha|dinheiro guardado|dinheiro resgatado/i, 'movimentação para caixinha/investimento'],
]

export function parseContaCSV(linhas: string[][]): ResultadoParse {
  const cab = linhas[0].map((c) => normalizar(c))
  const iD = cab.indexOf('data'), iV = cab.indexOf('valor'), iI = cab.indexOf('identificador')
  const iDesc = cab.findIndex((c) => c.startsWith('descri'))
  const transacoes: TransacaoBruta[] = []
  const unico = contador()
  for (const l of linhas.slice(1)) {
    const m = (l[iD] ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    const v = valorNum(l[iV] ?? '')
    const desc = (l[iDesc] ?? '').trim()
    if (!m || !Number.isFinite(v) || v === 0) continue
    const data = `${m[3]}-${m[2]}-${m[1]}`
    const id = (l[iI] ?? '').trim()
    const limpo = limparDescConta(desc)
    const { base, parcela } = extrairParcela(limpo)
    transacoes.push({
      fonte: 'conta',
      data,
      descricao: limpo,
      descBase: base,
      valor: arred(Math.abs(v)),
      tipo: v < 0 ? 'despesa' : 'receita',
      parcela: v < 0 ? parcela : undefined,
      hash: 'nu-conta:' + (id || unico(`${data}|${arred(v)}|${hashTexto(normalizar(desc))}`)),
      ignorarPadrao: IGNORAR_CONTA.find(([re]) => re.test(desc))?.[1],
    })
  }
  return { formato: 'nubank-conta-csv', fonte: 'conta', transacoes }
}

// ---------- OFX ----------

function tagOFX(bloco: string, tag: string): string | undefined {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
  return m?.[1].trim()
}

export function parseOFX(texto: string, nomeArquivo?: string): ResultadoParse {
  const cartao = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto)
  const fonte: FonteImport = cartao ? 'cartao' : 'conta'
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0])
  const unico = contador()
  const transacoes: TransacaoBruta[] = []
  for (const b of blocos) {
    const dt = tagOFX(b, 'DTPOSTED') ?? ''
    const v = Number((tagOFX(b, 'TRNAMT') ?? '').replace(',', '.'))
    const memo = tagOFX(b, 'MEMO') || tagOFX(b, 'NAME') || ''
    const fitid = tagOFX(b, 'FITID')
    if (!/^\d{8}/.test(dt) || !Number.isFinite(v) || v === 0) continue
    const data = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`
    const desc = cartao ? memo : limparDescConta(memo)
    const { base, parcela } = extrairParcela(desc)
    const despesa = v < 0
    transacoes.push({
      fonte,
      data,
      descricao: desc,
      descBase: base,
      valor: arred(Math.abs(v)),
      tipo: despesa ? 'despesa' : 'receita',
      parcela: despesa ? parcela : undefined,
      hash: `nu-${fonte}:` + (fitid || unico(`${data}|${arred(v)}|${hashTexto(normalizar(memo))}`)),
      ignorarPadrao: cartao
        ? (!despesa ? (/pagamento/i.test(memo) ? 'pagamento da fatura' : 'crédito/estorno') : undefined)
        : IGNORAR_CONTA.find(([re]) => re.test(memo))?.[1],
    })
  }
  return { formato: cartao ? 'ofx-cartao' : 'ofx-conta', fonte, transacoes, mesFatura: cartao ? mesFaturaSugerido(transacoes, nomeArquivo) : undefined }
}
