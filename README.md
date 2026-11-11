# 💰 Minhas Finanças

App web de finanças pessoais para responder, de um jeito simples, **"quanto eu tenho para pagar este mês e nos próximos?"**

Reúne em um só lugar os gastos do dia a dia, as compras parceladas que ainda vão cair na fatura, as assinaturas e as contas fixas, com uma projeção dos próximos 12 meses. Funciona **offline e 100% no navegador**: seus dados nunca saem do seu computador.

> Projeto pessoal em evolução. Acompanhe o histórico de commits para ver como ele vem crescendo.

## Funcionalidades

**Painel**
- Receitas, despesas, saldo previsto e quanto ainda falta pagar no mês
- Gráfico de gastos por categoria (clique para filtrar o extrato)
- Orçamento por categoria com alerta quando passa do limite
- Projeção de 12 meses separando parcelas, assinaturas/fixas e gastos avulsos
- Próximos vencimentos

**Extrato do mês**
- Tudo o que cai no mês, agrupado por cartão ou conta, com o total de cada fatura
- Marcar como pago, buscar, filtrar, editar e excluir

**Compras parceladas**
- Progresso de cada compra (ex.: 3/10), quanto falta e quando termina
- "Alívio no orçamento": em quais meses as parcelas acabam e quanto o gasto mensal cai

**Assinaturas e contas fixas**
- Assinaturas, contas fixas e receitas fixas, mensais ou anuais
- Custo mensal e anual de cada uma; cancelar e reativar sem perder o histórico

**Importação de extratos e faturas**
- Arraste o arquivo exportado pelo seu banco e revise antes de salvar
- Parcelas viram compras parceladas automaticamente; reimportar não duplica nada
- Sugere categorias e aprende com as suas correções

**Personalização**
- Tema claro/escuro e cor de destaque
- Categorias (emoji, cor, limite mensal), contas e cartões
- Backup e restauração em JSON

## Importação: bancos e formatos

| Formato | Bancos | Como funciona |
|---|---|---|
| **OFX** | Qualquer banco que exporte OFX (Itaú, Bradesco, BB, Caixa, Santander, Inter, Nubank, C6…) | Reconhecido automaticamente, banco identificado pelo código |
| **CSV** | Qualquer banco | O app sugere as colunas (data, descrição, valor) e você confirma com uma prévia |
| **CSV Nubank** | Fatura do cartão e extrato da conta | Reconhecido automaticamente, sem configurar nada |

Arquivos de exemplo fictícios para testar estão em [`exemplos/`](exemplos/).

**Como exportar:** no app ou internet banking do seu banco, procure "Extrato" ou "Fatura" e depois "Exportar", escolhendo OFX (às vezes chamado de "Money") ou CSV. Se o banco só oferece Excel (.xlsx), abra o arquivo e salve como CSV.

## Privacidade

- Não há servidor nem conta: os dados ficam no IndexedDB do seu navegador.
- Os arquivos importados são lidos localmente e nunca enviados para lugar nenhum.
- O app nunca pede senha de banco.
- Cada navegador tem seus próprios dados. Use **Personalizar → Exportar backup** para guardar uma cópia.

## Como rodar

Requer [Node.js](https://nodejs.org) (versão LTS).

```bash
npm install
npm run dev
```

Abra http://localhost:5173. O app começa vazio: crie suas categorias e contas em **Personalizar** (ou use as sugeridas), importe um extrato, ou explore com dados fictícios pelo Painel.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes da importação de arquivos |
| `npm run build` | Versão de produção em `dist/` |

## Tecnologias

React · TypeScript · Vite · Tailwind CSS · Recharts · Dexie (IndexedDB) · Vitest

## Estrutura

```
src/
  app/            App, navegação, tema
  pages/          Painel, Extrato, Parcelados, Assinaturas, Importar, Personalizar
  components/     Formulários e componentes de interface
  lib/
    mes.ts        Monta os itens de cada mês (avulsos + parcelas + recorrentes)
    db.ts         Banco local (Dexie)
    importacao.ts Análise e gravação das importações
    importadores/ Leitores de arquivo: OFX, CSV genérico e formatos conhecidos
exemplos/         Arquivos fictícios para testar a importação
```

Para reconhecer automaticamente o CSV de mais um banco, crie um leitor em `src/lib/importadores/` (veja `nubank.ts`) e registre em `FORMATOS_CSV`, no `index.ts`.
