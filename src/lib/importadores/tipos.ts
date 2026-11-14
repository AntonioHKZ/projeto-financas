export type FonteImport = 'cartao' | 'conta'

/** Transação lida de um arquivo, já num formato comum a todos os bancos. */
export interface TransacaoBruta {
  fonte: FonteImport
  data: string // YYYY-MM-DD da transação
  descricao: string // texto original (levemente limpo)
  descBase: string // sem "Parcela X/Y", usado para agrupar e categorizar
  valor: number // em centavos, sempre positivo
  tipo: 'despesa' | 'receita'
  hash: string // identificador estável para evitar duplicatas
  parcela?: { n: number; total: number }
  ignorarPadrao?: string // motivo para vir desmarcado
  categoriaBanco?: string // categoria que o próprio banco informou no arquivo (ex.: "SUPERMERCADOS")
}

export interface ResultadoParse {
  formato: string // rótulo legível, ex.: "OFX · Itaú (extrato da conta)"
  banco?: string // ex.: "Nubank", "Inter" — quando dá para identificar
  fonte: FonteImport
  transacoes: TransacaoBruta[]
  mesFatura?: string // só para cartão: mês de vencimento sugerido
}

/** Como ler um CSV qualquer: quais colunas usar e como interpretar o sinal do valor. */
export interface Mapeamento {
  linhaCabecalho: number // índice da linha de cabeçalho (-1 = sem cabeçalho)
  colData: number
  colDesc: number
  colValor: number // -1 quando o arquivo usa colunas separadas de crédito/débito
  colCredito: number
  colDebito: number
  colCategoria: number // coluna com a categoria do banco (-1 = não tem)
  fonte: FonteImport // cartão: valor positivo = gasto · conta: valor negativo = gasto
  inverter: boolean
}

export type Leitura =
  | { tipo: 'pronto'; resultado: ResultadoParse }
  | { tipo: 'mapear'; linhas: string[][]; sugestao: Mapeamento; banco?: string; nomeArquivo?: string }
