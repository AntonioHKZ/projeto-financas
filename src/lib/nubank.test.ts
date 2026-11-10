import { describe, expect, it } from 'vitest'
import { analisarArquivo, extrairParcela, limparDescConta } from './nubank'
import { gerarMes } from './mes'
import type { Parcelado } from './types'

const FATURA = `date,title,amount
2026-10-02,Ifood *Restaurante,45.90
2026-10-03,Uber *Trip,18.50
2026-10-03,Uber *Trip,18.50
2026-10-05,Magazine Luiza - Parcela 3/10,150.00
2026-10-07,Pagamento recebido,-1200.00
2026-10-08,Netflix.com,44.90
2026-10-09,"Loja, com virgula",10.00
`

const CONTA = `Data,Valor,Identificador,Descrição
01/10/2026,-35.00,abc-1,Compra no débito - PADARIA BOA
02/10/2026,5000.00,abc-2,Transferência recebida pelo Pix - EMPRESA LTDA - 12.345.678/0001-00 - BANCO
03/10/2026,-1200.00,abc-3,Pagamento de fatura
04/10/2026,-80.00,abc-4,Transferência enviada pelo Pix - FULANO DE TAL - •••.123.456-•• - BANCO X
`

const OFX = `OFXHEADER:100
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005000000[-3:BRT]<TRNAMT>-99.90<FITID>f1<MEMO>Loja X - Parcela 2/4</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261007000000[-3:BRT]<TRNAMT>500.00<FITID>f2<MEMO>Pagamento recebido</STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`

describe('fatura do cartão (CSV)', () => {
  const r = analisarArquivo(FATURA, 'Nubank_2026-11-10.csv')
  it('detecta formato e mês da fatura pelo nome do arquivo', () => {
    expect(r.formato).toBe('nubank-cartao-csv')
    expect(r.mesFatura).toBe('2026-11')
    expect(r.transacoes).toHaveLength(7)
  })
  it('identifica parcelas', () => {
    const p = r.transacoes.find((t) => t.parcela)!
    expect(p.descBase).toBe('Magazine Luiza')
    expect(p.parcela).toEqual({ n: 3, total: 10 })
  })
  it('ignora pagamento por padrão e mantém vírgulas entre aspas', () => {
    expect(r.transacoes.find((t) => t.descricao === 'Pagamento recebido')!.ignorarPadrao).toBeTruthy()
    expect(r.transacoes.some((t) => t.descricao === 'Loja, com virgula')).toBe(true)
  })
  it('gera hashes diferentes para compras idênticas no mesmo dia', () => {
    const ubers = r.transacoes.filter((t) => t.descricao.startsWith('Uber'))
    expect(ubers[0].hash).not.toBe(ubers[1].hash)
    expect(analisarArquivo(FATURA).transacoes[1].hash).toBe(ubers[0].hash) // estável entre leituras
  })
  it('sem nome com data, sugere o mês seguinte à última compra', () => {
    expect(analisarArquivo(FATURA, 'fatura.csv').mesFatura).toBe('2026-11')
  })
})

describe('extrato da conta (CSV)', () => {
  const r = analisarArquivo(CONTA)
  it('lê datas BR, sinais e identificador', () => {
    expect(r.formato).toBe('nubank-conta-csv')
    const [padaria, pix] = r.transacoes
    expect(padaria).toMatchObject({ data: '2026-10-01', valor: 35, tipo: 'despesa', descricao: 'PADARIA BOA', hash: 'nu-conta:abc-1' })
    expect(pix).toMatchObject({ tipo: 'receita', valor: 5000, descricao: 'Pix recebido - EMPRESA LTDA' })
    expect(r.transacoes[2].ignorarPadrao).toMatch(/fatura/)
    expect(r.transacoes[3].descricao).toBe('Pix enviado - FULANO DE TAL')
  })
})

describe('OFX', () => {
  it('lê fatura OFX', () => {
    const r = analisarArquivo(OFX)
    expect(r.formato).toBe('ofx-cartao')
    expect(r.transacoes[0]).toMatchObject({ valor: 99.9, tipo: 'despesa', parcela: { n: 2, total: 4 }, hash: 'nu-cartao:f1' })
    expect(r.transacoes[1].ignorarPadrao).toBeTruthy()
  })
})

describe('utilidades', () => {
  it('extrairParcela', () => {
    expect(extrairParcela('Loja - Parcela 1/12')).toEqual({ base: 'Loja', parcela: { n: 1, total: 12 } })
    expect(extrairParcela('Loja 3/2')).toEqual({ base: 'Loja 3/2' })
  })
  it('limparDescConta', () => {
    expect(limparDescConta('Compra no débito via NuPay - XYZ')).toBe('XYZ')
  })
  it('gerarMes coloca a parcela certa no mês', () => {
    const p: Parcelado = { id: '1', descricao: 'TV', valorParcela: 100, parcelas: 3, primeiroMes: '2026-10', pagos: {} }
    const d = { lancamentos: [], parcelados: [p], recorrentes: [], contas: [] }
    expect(gerarMes('2026-11', d)[0].parcelaInfo).toBe('2/3')
    expect(gerarMes('2027-01', d)).toHaveLength(0)
  })
})
