import { describe, expect, it } from 'vitest'
import { lerArquivo, parseComMapeamento, decodificar, type Leitura } from './index'
import { extrairParcela, limparDescConta, parseData, valorNum } from './util'
import { gerarMes } from '../mes'
import type { Parcelado } from '../types'

const pronto = (l: Leitura) => {
  if (l.tipo !== 'pronto') throw new Error('esperava formato reconhecido')
  return l.resultado
}

const FATURA_NU = `date,title,amount
2026-10-02,Ifood *Restaurante,45.90
2026-10-03,Uber *Trip,18.50
2026-10-03,Uber *Trip,18.50
2026-10-05,Magazine Luiza - Parcela 3/10,150.00
2026-10-07,Pagamento recebido,-1200.00
2026-10-09,"Loja, com virgula",10.00
`

const EXTRATO_NU = `Data,Valor,Identificador,Descrição
01/10/2026,-35.00,abc-1,Compra no débito - PADARIA BOA
02/10/2026,5000.00,abc-2,Transferência recebida pelo Pix - EMPRESA LTDA - 12.345.678/0001-00 - BANCO
03/10/2026,-1200.00,abc-3,Pagamento de fatura
`

const OFX_ITAU = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>0341<ACCTID>12345</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005<TRNAMT>-99.90<FITID>a1<MEMO>SUPERMERCADO X</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261006<TRNAMT>3500.00<FITID>a2<MEMO>SALARIO</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

const OFX_CARTAO = `OFXHEADER:100
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005000000[-3:BRT]<TRNAMT>-99.90<FITID>f1<MEMO>Loja X - Parcela 2/4</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261007000000[-3:BRT]<TRNAMT>500.00<FITID>f2<MEMO>Pagamento recebido</STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`

// CSV "de outro banco": separador ;, valores BR, linhas de informação antes do cabeçalho
const CSV_CONTA_GENERICO = `Extrato Conta Corrente
Conta ;12345-6
Data Lançamento;Histórico;Descrição;Valor;Saldo
01/10/2026;Pix enviado;Fulano;-1.250,00;3.000,00
02/10/2026;Compra no débito;MERCADO BOM;-87,35;2.912,65
05/10/2026;Pix recebido;Empresa;4.500,00;7.412,65
`

const CSV_CARTAO_GENERICO = `Data;Lançamento;Categoria;Tipo;Valor
05/10/2026;NETFLIX;SERVIÇOS;Compra à vista;R$ 44,90
06/10/2026;LOJA ABC 02/05;VESTUÁRIO;Parcela;R$ 120,00
08/10/2026;PAGAMENTO FATURA;-;Pagamento;-R$ 900,00
`

const CSV_CRED_DEB = `data,descricao,credito,debito
01/10/2026,Salario,5000,
02/10/2026,Aluguel,,1800
`

describe('Nubank (reconhecido automaticamente)', () => {
  it('fatura CSV: parcelas, pagamento ignorado, mês pelo nome, hashes estáveis', () => {
    const r = pronto(lerArquivo(FATURA_NU, 'Nubank_2026-11-10.csv'))
    expect(r.banco).toBe('Nubank')
    expect(r.mesFatura).toBe('2026-11')
    expect(r.transacoes.find((t) => t.parcela)).toMatchObject({ descBase: 'Magazine Luiza', parcela: { n: 3, total: 10 } })
    expect(r.transacoes.find((t) => t.descricao === 'Pagamento recebido')!.ignorarPadrao).toBeTruthy()
    expect(r.transacoes.some((t) => t.descricao === 'Loja, com virgula')).toBe(true)
    const ubers = r.transacoes.filter((t) => t.descricao.startsWith('Uber'))
    expect(ubers[0].hash).not.toBe(ubers[1].hash)
    expect(pronto(lerArquivo(FATURA_NU)).transacoes[1].hash).toBe(ubers[0].hash)
  })
  it('extrato CSV', () => {
    const r = pronto(lerArquivo(EXTRATO_NU))
    expect(r.transacoes[0]).toMatchObject({ data: '2026-10-01', valor: 35, tipo: 'despesa', descricao: 'PADARIA BOA', hash: 'nu-conta:abc-1' })
    expect(r.transacoes[1]).toMatchObject({ tipo: 'receita', descricao: 'Pix recebido - EMPRESA LTDA' })
    expect(r.transacoes[2].ignorarPadrao).toMatch(/fatura/)
  })
})

describe('OFX de qualquer banco', () => {
  it('identifica o banco pelo código e lê conta', () => {
    const r = pronto(lerArquivo(OFX_ITAU))
    expect(r).toMatchObject({ banco: 'Itaú', fonte: 'conta' })
    expect(r.transacoes[0]).toMatchObject({ valor: 99.9, tipo: 'despesa', hash: 'itau-conta:a1' })
    expect(r.transacoes[1].tipo).toBe('receita')
  })
  it('lê fatura de cartão em OFX', () => {
    const r = pronto(lerArquivo(OFX_CARTAO))
    expect(r.fonte).toBe('cartao')
    expect(r.transacoes[0]).toMatchObject({ valor: 99.9, tipo: 'despesa', parcela: { n: 2, total: 4 } })
    expect(r.transacoes[1].ignorarPadrao).toBeTruthy()
  })
})

describe('CSV genérico', () => {
  it('extrato de conta com ; e linhas antes do cabeçalho', () => {
    const l = lerArquivo(CSV_CONTA_GENERICO, 'extrato-inter-outubro.csv')
    expect(l.tipo).toBe('mapear')
    if (l.tipo !== 'mapear') return
    expect(l.banco).toBe('Inter')
    expect(l.sugestao).toMatchObject({ linhaCabecalho: 2, colData: 0, colValor: 3, fonte: 'conta' })
    const r = parseComMapeamento(l.linhas, l.sugestao, l.nomeArquivo, l.banco)
    expect(r.transacoes).toHaveLength(3)
    expect(r.transacoes[0]).toMatchObject({ valor: 1250, tipo: 'despesa' })
    expect(r.transacoes[2]).toMatchObject({ valor: 4500, tipo: 'receita' })
  })
  it('fatura de cartão: positivo = gasto, parcela curta "02/05", pagamento ignorado', () => {
    const l = lerArquivo(CSV_CARTAO_GENERICO, 'fatura_itau.csv')
    if (l.tipo !== 'mapear') throw new Error()
    expect(l.sugestao.fonte).toBe('cartao')
    const r = parseComMapeamento(l.linhas, l.sugestao, l.nomeArquivo, l.banco)
    expect(r.transacoes[0]).toMatchObject({ descricao: 'NETFLIX', valor: 44.9, tipo: 'despesa' })
    expect(r.transacoes[1]).toMatchObject({ descBase: 'LOJA ABC', parcela: { n: 2, total: 5 } })
    expect(r.transacoes[2].ignorarPadrao).toMatch(/fatura/)
  })
  it('colunas separadas de crédito e débito', () => {
    const l = lerArquivo(CSV_CRED_DEB)
    if (l.tipo !== 'mapear') throw new Error()
    expect(l.sugestao.colValor).toBe(-1)
    const r = parseComMapeamento(l.linhas, l.sugestao)
    expect(r.transacoes.map((t) => [t.tipo, t.valor])).toEqual([['receita', 5000], ['despesa', 1800]])
  })
  it('rejeita arquivo sem colunas reconhecíveis', () => {
    expect(() => lerArquivo('a;b\nx;y\nz;w')).toThrow()
  })
})

describe('utilidades', () => {
  it('valorNum', () => {
    expect(valorNum('1.234,56')).toBe(1234.56)
    expect(valorNum('-R$ 12,90')).toBe(-12.9)
    expect(valorNum('(10,00)')).toBe(-10)
    expect(valorNum('99.90')).toBe(99.9)
    expect(valorNum('abc')).toBeNaN()
  })
  it('parseData', () => {
    expect(parseData('05/10/26')).toBe('2026-10-05')
    expect(parseData('2026-10-05T10:00')).toBe('2026-10-05')
    expect(parseData('31/13/2026')).toBeUndefined()
  })
  it('extrairParcela e limparDescConta', () => {
    expect(extrairParcela('Loja - Parcela 1/12')).toEqual({ base: 'Loja', parcela: { n: 1, total: 12 } })
    expect(extrairParcela('Loja 03/10')).toEqual({ base: 'Loja 03/10' })
    expect(extrairParcela('Loja 03/10', true).parcela).toEqual({ n: 3, total: 10 })
    expect(limparDescConta('Compra no débito via NuPay - XYZ')).toBe('XYZ')
  })
  it('decodificar arquivos em Windows-1252', () => {
    const bytes = new Uint8Array([0x48, 0x69, 0x73, 0x74, 0xf3, 0x72, 0x69, 0x63, 0x6f]) // "Histórico" em latin1
    expect(decodificar(bytes.buffer)).toBe('Histórico')
  })
  it('gerarMes coloca a parcela certa no mês', () => {
    const p: Parcelado = { id: '1', descricao: 'TV', valorParcela: 100, parcelas: 3, primeiroMes: '2026-10', pagos: {} }
    const d = { lancamentos: [], parcelados: [p], recorrentes: [], contas: [] }
    expect(gerarMes('2026-11', d)[0].parcelaInfo).toBe('2/3')
    expect(gerarMes('2027-01', d)).toHaveLength(0)
  })
})
