/** Formatos CSV conhecidos do Nubank (reconhecidos automaticamente pelo cabeçalho). */
import { arred, normalizar, paraCentavos } from '../format'
import type { ResultadoParse, TransacaoBruta } from './tipos'
import { contador, extrairParcela, hashTexto, limparDescConta, mesFaturaSugerido, motivoIgnorar, valorNum } from './util'

export function ehFaturaNubank(cab: string[]) {
  return cab.includes('date') && cab.includes('title') && cab.includes('amount')
}

export function ehExtratoNubank(cab: string[]) {
  return cab.includes('data') && cab.includes('valor') && cab.includes('identificador')
}

/** Fatura do cartão: date,title,amount — valor positivo = compra. */
export function parseFaturaNubank(linhas: string[][], nomeArquivo?: string): ResultadoParse {
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
    const tipo = v < 0 ? 'receita' : 'despesa'
    transacoes.push({
      fonte: 'cartao', data, descricao: titulo, descBase: base, valor: paraCentavos(Math.abs(v)), tipo,
      parcela: tipo === 'despesa' ? parcela : undefined,
      hash: 'nu-cartao:' + unico(`${data}|${arred(v)}|${hashTexto(normalizar(titulo))}`),
      ignorarPadrao: motivoIgnorar(titulo, 'cartao', tipo),
    })
  }
  return { formato: 'CSV · fatura do cartão Nubank', banco: 'Nubank', fonte: 'cartao', transacoes, mesFatura: mesFaturaSugerido(transacoes, nomeArquivo) }
}

/** Extrato da conta: Data,Valor,Identificador,Descrição — valor negativo = saída. */
export function parseExtratoNubank(linhas: string[][]): ResultadoParse {
  const cab = linhas[0].map((c) => normalizar(c))
  const iD = cab.indexOf('data'), iV = cab.indexOf('valor'), iI = cab.indexOf('identificador')
  const iDesc = cab.findIndex((c) => c.startsWith('descri'))
  const unico = contador()
  const transacoes: TransacaoBruta[] = []
  for (const l of linhas.slice(1)) {
    const m = (l[iD] ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    const v = valorNum(l[iV] ?? '')
    const desc = (l[iDesc] ?? '').trim()
    if (!m || !Number.isFinite(v) || v === 0) continue
    const data = `${m[3]}-${m[2]}-${m[1]}`
    const id = (l[iI] ?? '').trim()
    const limpo = limparDescConta(desc)
    const { base, parcela } = extrairParcela(limpo)
    const tipo = v < 0 ? 'despesa' : 'receita'
    transacoes.push({
      fonte: 'conta', data, descricao: limpo, descBase: base, valor: paraCentavos(Math.abs(v)), tipo,
      parcela: tipo === 'despesa' ? parcela : undefined,
      hash: 'nu-conta:' + (id || unico(`${data}|${arred(v)}|${hashTexto(normalizar(desc))}`)),
      ignorarPadrao: motivoIgnorar(desc, 'conta', tipo),
    })
  }
  return { formato: 'CSV · extrato da conta Nubank', banco: 'Nubank', fonte: 'conta', transacoes }
}
