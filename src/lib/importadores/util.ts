import { addMes, normalizar } from '../format'
import type { TransacaoBruta } from './tipos'

/** Lê o arquivo como texto: tenta UTF-8 e, se aparecerem caracteres inválidos, usa Windows-1252 (comum em bancos). */
export function decodificar(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf)
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('windows-1252').decode(buf)
}

function detectarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 8).join('\n')
  const conta = (c: string) => amostra.split(c).length - 1
  const cands = [';', '\t', ',']
  // ';' e TAB ganham de ',' porque vírgula também aparece em valores brasileiros (1.234,56)
  for (const c of cands.slice(0, 2)) if (conta(c) > 0 && conta(c) >= conta(',') / 2) return c
  return ','
}

export function lerCSV(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const sep = detectarSeparador(t)
  const linhas: string[][] = []
  let campo = '', linha: string[] = [], aspas = false
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

/** Converte "1.234,56", "-1234.56", "R$ 12,90", "(12,90)" em número. NaN se não for valor. */
export function valorNum(s: string): number {
  let t = (s ?? '').trim().replace(/R\$|\s/gi, '')
  if (!t) return NaN
  let neg = false
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1) }
  if (/[dD]$/.test(t)) { neg = true; t = t.slice(0, -1) } // alguns bancos usam "12,90 D"
  t = t.replace(/[cC]$/, '')
  if (!/^[+-]?[\d.,]+$/.test(t)) return NaN
  let n: number
  if (/,\d{1,2}$/.test(t)) n = Number(t.replace(/\./g, '').replace(',', '.'))
  else n = Number(t.replace(/,/g, ''))
  return neg ? -Math.abs(n) : n
}

/** Aceita DD/MM/AAAA, DD/MM/AA, AAAA-MM-DD, DD-MM-AAAA, DD.MM.AAAA (com ou sem hora). */
export function parseData(s: string): string | undefined {
  const t = (s ?? '').trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/)
  if (!m) return undefined
  const d = Number(m[1]), mo = Number(m[2])
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return undefined
  const y = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const RE_PARCELA = /\s*-?\s*(?:parcela|parc\.?)\s*(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})\s*$/i
const RE_PARCELA_CURTA = /\s+(\d{1,2})\/(\d{1,2})\s*$/ // "LOJA X 03/10" (comum em faturas de outros bancos)

/** `curto` aceita também "LOJA 03/10" — só faz sentido em faturas de cartão. */
export function extrairParcela(desc: string, curto = false): { base: string; parcela?: { n: number; total: number } } {
  for (const re of curto ? [RE_PARCELA, RE_PARCELA_CURTA] : [RE_PARCELA]) {
    const m = desc.match(re)
    if (!m) continue
    const n = Number(m[1]), total = Number(m[2])
    if (n >= 1 && total >= 2 && n <= total) return { base: desc.slice(0, m.index).trim(), parcela: { n, total } }
  }
  return { base: desc.trim() }
}

/** Deixa descrições de extrato mais legíveis (Pix, débito, boleto). */
export function limparDescConta(desc: string): string {
  const d = desc.trim().replace(/\s+/g, ' ')
  const pix = d.match(/^(?:Transfer[eê]ncia )?(enviada|recebida|enviado|recebido)(?: pelo| via)? Pix - ([^-]+)/i)
    ?? d.match(/^Pix (enviado|recebido)(?: -|:)? ([^-]+)/i)
  if (pix) return `Pix ${/^envi/i.test(pix[1]) ? 'enviado' : 'recebido'} - ${pix[2].trim()}`
  return d
    .replace(/^Compra no d[eé]bito(?: via NuPay)? - /i, '')
    .replace(/^Compra no cr[eé]dito - /i, '')
    .replace(/^Pagamento de boleto efetuado - /i, 'Boleto - ')
    .trim()
}

/** Motivos para uma transação vir desmarcada por padrão (pagamento de fatura, aplicações). */
export function motivoIgnorar(desc: string, fonte: 'cartao' | 'conta', tipo: 'despesa' | 'receita'): string | undefined {
  if (/pagamento (de |da )?fatura|pagamento recebido|pgto\.? fatura|pag fatura|pagto cartao/i.test(desc)) return 'pagamento da fatura'
  if (fonte === 'conta' && /aplica[cç][aã]o|resgate|rdb|cdb|caixinha|poupan[cç]a|dinheiro guardado|dinheiro resgatado|invest/i.test(desc))
    return 'movimentação para investimento/caixinha'
  if (fonte === 'cartao' && tipo === 'receita') return 'crédito/estorno'
  return undefined
}

export function hashTexto(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Adiciona sufixo quando a mesma chave se repete no arquivo (ex.: 2 Ubers iguais no mesmo dia). */
export function contador() {
  const vistos = new Map<string, number>()
  return (chave: string) => {
    const n = (vistos.get(chave) ?? 0) + 1
    vistos.set(chave, n)
    return n === 1 ? chave : `${chave}#${n}`
  }
}

/** Mês de vencimento da fatura: data no nome do arquivo, senão o mês seguinte à última compra. */
export function mesFaturaSugerido(ts: TransacaoBruta[], nomeArquivo?: string): string | undefined {
  const m = nomeArquivo?.match(/(20\d{2})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}`
  const datas = ts.filter((t) => t.tipo === 'despesa').map((t) => t.data).sort()
  return datas.length ? addMes(datas[datas.length - 1].slice(0, 7), 1) : undefined
}

const BANCOS: [RegExp, string][] = [
  [/nubank|\bnu_|^nu[_-]/i, 'Nubank'],
  [/\binter\b|bancointer/i, 'Inter'],
  [/ita[uú]/i, 'Itaú'],
  [/bradesco/i, 'Bradesco'],
  [/santander/i, 'Santander'],
  [/\bc6\b|c6bank/i, 'C6 Bank'],
  [/banco ?do ?brasil|\bbb\b/i, 'Banco do Brasil'],
  [/caixa/i, 'Caixa'],
  [/picpay/i, 'PicPay'],
  [/mercado ?pago/i, 'Mercado Pago'],
  [/\bxp\b|xpinvest/i, 'XP'],
  [/btg/i, 'BTG'],
]

export function bancoPeloNome(texto?: string): string | undefined {
  if (!texto) return undefined
  return BANCOS.find(([re]) => re.test(texto))?.[1]
}

export const slug = (s?: string) => (s ? normalizar(s).replace(/[^a-z0-9]+/g, '') : 'csv')
