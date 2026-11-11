/** OFX: formato padrão aceito pela maioria dos bancos brasileiros (extrato e, em alguns, fatura). */
import { arred, normalizar, paraCentavos } from '../format'
import type { FonteImport, ResultadoParse, TransacaoBruta } from './tipos'
import { bancoPeloNome, contador, extrairParcela, hashTexto, limparDescConta, mesFaturaSugerido, motivoIgnorar, slug } from './util'

// código COMPE → nome
const CODIGOS: Record<string, string> = {
  '001': 'Banco do Brasil', '033': 'Santander', '077': 'Inter', '104': 'Caixa', '208': 'BTG', '237': 'Bradesco',
  '260': 'Nubank', '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6 Bank', '341': 'Itaú', '380': 'PicPay',
  '102': 'XP', '748': 'Sicredi', '756': 'Sicoob', '212': 'Banco Original', '655': 'Neon', '422': 'Safra',
}

function tag(bloco: string, nome: string): string | undefined {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'))
  return m?.[1].trim() || undefined
}

export function ehOFX(texto: string) {
  return /<OFX>|OFXHEADER/i.test(texto)
}

export function parseOFX(texto: string, nomeArquivo?: string): ResultadoParse {
  const cartao = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto)
  const fonte: FonteImport = cartao ? 'cartao' : 'conta'
  const codigo = tag(texto, 'BANKID')?.replace(/^0+(?=\d{3}$)/, '').padStart(3, '0')
  const banco = (codigo && CODIGOS[codigo]) || bancoPeloNome(tag(texto, 'ORG')) || bancoPeloNome(nomeArquivo)
  const prefixo = banco === 'Nubank' ? `nu-${fonte}` : `${slug(banco ?? 'ofx')}-${fonte}`

  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0])
  const unico = contador()
  const transacoes: TransacaoBruta[] = []
  for (const b of blocos) {
    const dt = tag(b, 'DTPOSTED') ?? ''
    const v = Number((tag(b, 'TRNAMT') ?? '').replace(',', '.'))
    const memo = tag(b, 'MEMO') || tag(b, 'NAME') || ''
    const fitid = tag(b, 'FITID')
    if (!/^\d{8}/.test(dt) || !Number.isFinite(v) || v === 0) continue
    const data = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`
    const desc = cartao ? memo.trim() : limparDescConta(memo)
    const { base, parcela } = extrairParcela(desc, cartao)
    const tipo = v < 0 ? 'despesa' : 'receita' // no OFX, gasto é sempre negativo (conta e cartão)
    transacoes.push({
      fonte, data, descricao: desc, descBase: base, valor: paraCentavos(Math.abs(v)), tipo,
      parcela: tipo === 'despesa' ? parcela : undefined,
      hash: `${prefixo}:` + (fitid || unico(`${data}|${arred(v)}|${hashTexto(normalizar(memo))}`)),
      ignorarPadrao: motivoIgnorar(memo, fonte, tipo),
    })
  }
  return {
    formato: `OFX · ${cartao ? 'fatura do cartão' : 'extrato da conta'}${banco ? ` ${banco}` : ''}`,
    banco, fonte, transacoes,
    mesFatura: cartao ? mesFaturaSugerido(transacoes, nomeArquivo) : undefined,
  }
}
