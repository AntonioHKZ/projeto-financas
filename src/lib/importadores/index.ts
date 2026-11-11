/**
 * Ponto de entrada da importação de extratos/faturas. Tudo roda localmente no navegador.
 *
 * Ordem: OFX (padrão de qualquer banco) → formatos conhecidos (Nubank) → CSV genérico
 * (o usuário confirma as colunas). Para adicionar um banco com formato próprio, crie um
 * arquivo como nubank.ts e registre-o em FORMATOS_CSV.
 */
import { normalizar } from '../format'
import type { Leitura, ResultadoParse } from './tipos'
import { bancoPeloNome, lerCSV } from './util'
import { ehOFX, parseOFX } from './ofx'
import { ehExtratoNubank, ehFaturaNubank, parseExtratoNubank, parseFaturaNubank } from './nubank'
import { sugerirMapeamento } from './csvGenerico'

export * from './tipos'
export { decodificar } from './util'
export { parseComMapeamento } from './csvGenerico'

const FORMATOS_CSV: { reconhece: (cab: string[]) => boolean; ler: (linhas: string[][], nome?: string) => ResultadoParse }[] = [
  { reconhece: ehFaturaNubank, ler: parseFaturaNubank },
  { reconhece: ehExtratoNubank, ler: (l) => parseExtratoNubank(l) },
]

export function lerArquivo(texto: string, nomeArquivo?: string): Leitura {
  if (ehOFX(texto)) return { tipo: 'pronto', resultado: parseOFX(texto, nomeArquivo) }
  const linhas = lerCSV(texto)
  if (linhas.length < 2) throw new Error('Arquivo vazio ou sem transações.')
  const cab = linhas[0].map((c) => normalizar(c))
  const conhecido = FORMATOS_CSV.find((f) => f.reconhece(cab))
  if (conhecido) return { tipo: 'pronto', resultado: conhecido.ler(linhas, nomeArquivo) }
  const sugestao = sugerirMapeamento(linhas, nomeArquivo)
  if (sugestao.colData < 0 || sugestao.colDesc < 0) throw new Error('Não encontrei colunas de data e descrição. Confira se o arquivo é um CSV de extrato ou fatura (planilhas .xlsx precisam ser salvas como CSV).')
  return { tipo: 'mapear', linhas, sugestao, banco: bancoPeloNome(nomeArquivo), nomeArquivo }
}
