/**
 * CSV de qualquer banco: detecta as colunas pelo cabeçalho (ou pelo conteúdo) e
 * deixa o usuário confirmar/ajustar antes de importar.
 */
import { arred, normalizar, paraCentavos } from '../format'
import type { FonteImport, Mapeamento, ResultadoParse, TransacaoBruta } from './tipos'
import { contador, extrairParcela, hashTexto, limparCategoriaBanco, limparDescConta, mesFaturaSugerido, motivoIgnorar, parseData, slug, valorNum } from './util'

const RE = {
  data: /^(data|date|dt)\b|data (de |do |da )?(lancamento|compra|movimento|transacao|mov)/,
  valor: /^(valor|amount|value|quantia|montante)\b|valor ?\(?r\$\)?/,
  credito: /^(credito|entrada|entradas|receita)s?\b/,
  debito: /^(debito|saida|saidas|despesa)s?\b/,
  desc: /descri|historico|title|titulo|estabelecimento|memo|detalhe|lancamento|transacao|nome|favorecido/,
  ignorar: /saldo|balance|categoria|category|parcela$|cotacao|dolar|us\$/,
  categoria: /^(categoria|category|ramo|segmento)( |$)|ramo de atividade|tipo de (gasto|despesa|estabelecimento)/,
}

function acharColuna(cab: string[], re: RegExp, usados: Set<number>): number {
  const i = cab.findIndex((c, k) => !usados.has(k) && re.test(c) && !RE.ignorar.test(c))
  if (i >= 0) usados.add(i)
  return i
}

/** Tenta achar a linha de cabeçalho nas primeiras linhas (alguns bancos colocam informações da conta antes). */
function mapearPeloCabecalho(linhas: string[][]): Omit<Mapeamento, 'fonte' | 'inverter'> | undefined {
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const cab = linhas[i].map((c) => normalizar(c))
    const usados = new Set<number>()
    const colData = acharColuna(cab, RE.data, usados)
    const colValor = acharColuna(cab, RE.valor, usados)
    const colCredito = colValor < 0 ? acharColuna(cab, RE.credito, usados) : -1
    const colDebito = colValor < 0 ? acharColuna(cab, RE.debito, usados) : -1
    const colDesc = acharColuna(cab, RE.desc, usados)
    if (colData >= 0 && colDesc >= 0 && (colValor >= 0 || (colCredito >= 0 && colDebito >= 0)))
      return { linhaCabecalho: i, colData, colDesc, colValor, colCredito, colDebito, colCategoria: cab.findIndex((c, k) => !usados.has(k) && RE.categoria.test(c)) }
  }
  return undefined
}

/** Sem cabeçalho reconhecível: escolhe as colunas olhando o conteúdo. */
function mapearPeloConteudo(linhas: string[][]): Omit<Mapeamento, 'fonte' | 'inverter'> {
  const amostra = linhas.slice(0, 40)
  const nCols = Math.max(...amostra.map((l) => l.length))
  const taxa = (k: number, f: (s: string) => boolean) => amostra.filter((l) => f(l[k] ?? '')).length / amostra.length
  let colData = -1, colValor = -1, colDesc = -1, melhorTexto = 0
  for (let k = 0; k < nCols; k++) {
    if (colData < 0 && taxa(k, (s) => !!parseData(s)) > 0.6) { colData = k; continue }
    if (colValor < 0 && taxa(k, (s) => Number.isFinite(valorNum(s))) > 0.6) { colValor = k; continue }
    const texto = amostra.reduce((s, l) => s + ((l[k] ?? '').replace(/[\d\s.,/-]/g, '').length), 0)
    if (texto > melhorTexto) { melhorTexto = texto; colDesc = k }
  }
  const primeiraValida = linhas.findIndex((l) => colData >= 0 && parseData(l[colData] ?? ''))
  return { linhaCabecalho: primeiraValida - 1, colData, colDesc, colValor, colCredito: -1, colDebito: -1, colCategoria: -1 }
}

export function sugerirMapeamento(linhas: string[][], nomeArquivo?: string): Mapeamento {
  const base = mapearPeloCabecalho(linhas) ?? mapearPeloConteudo(linhas)
  const dados = linhas.slice(base.linhaCabecalho + 1)
  // fatura de cartão costuma ter quase tudo positivo; extrato de conta tem saídas negativas
  let fonte: FonteImport = 'conta'
  if (/fatura|cartao|cartão|card|credito|crédito/i.test(nomeArquivo ?? '')) fonte = 'cartao'
  else if (base.colValor >= 0) {
    const vals = dados.map((l) => valorNum(l[base.colValor] ?? '')).filter(Number.isFinite)
    if (vals.length && vals.filter((v) => v > 0).length / vals.length > 0.75) fonte = 'cartao'
  }
  return { ...base, fonte, inverter: false }
}

export function parseComMapeamento(linhas: string[][], map: Mapeamento, nomeArquivo?: string, banco?: string): ResultadoParse {
  const unico = contador()
  const prefixo = `${slug(banco)}-${map.fonte}`
  const transacoes: TransacaoBruta[] = []
  for (const l of linhas.slice(map.linhaCabecalho + 1)) {
    const data = parseData(l[map.colData] ?? '')
    const bruto = (l[map.colDesc] ?? '').trim()
    if (!data || !bruto) continue
    let v: number
    if (map.colValor >= 0) {
      v = valorNum(l[map.colValor] ?? '')
      // conta: negativo = gasto · cartão: positivo = gasto. Normaliza para "negativo = gasto".
      if (map.fonte === 'cartao') v = -v
    } else {
      const c = valorNum(l[map.colCredito] ?? ''), d = valorNum(l[map.colDebito] ?? '')
      v = (Number.isFinite(c) ? Math.abs(c) : 0) - (Number.isFinite(d) ? Math.abs(d) : 0)
    }
    if (map.inverter) v = -v
    if (!Number.isFinite(v) || v === 0) continue
    const desc = map.fonte === 'conta' ? limparDescConta(bruto) : bruto.replace(/\s+/g, ' ')
    const { base, parcela } = extrairParcela(desc, map.fonte === 'cartao')
    const tipo = v < 0 ? 'despesa' : 'receita'
    transacoes.push({
      fonte: map.fonte, data, descricao: desc, descBase: base, valor: paraCentavos(Math.abs(v)), tipo,
      parcela: tipo === 'despesa' ? parcela : undefined,
      hash: `${prefixo}:` + unico(`${data}|${arred(v)}|${hashTexto(normalizar(bruto))}`),
      ignorarPadrao: motivoIgnorar(bruto, map.fonte, tipo),
      categoriaBanco: limparCategoriaBanco(map.colCategoria >= 0 ? l[map.colCategoria] : undefined),
    })
  }
  return {
    formato: `CSV · ${map.fonte === 'cartao' ? 'fatura do cartão' : 'extrato da conta'}${banco ? ` ${banco}` : ''}`,
    banco, fonte: map.fonte, transacoes,
    mesFatura: map.fonte === 'cartao' ? mesFaturaSugerido(transacoes, nomeArquivo) : undefined,
  }
}
