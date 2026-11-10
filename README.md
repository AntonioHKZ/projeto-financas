# Minhas Finanças

App pessoal de finanças (React + Vite + TypeScript + Tailwind + Dexie). Os dados ficam só no seu navegador (IndexedDB).

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173.

- `npm test` — testes dos leitores de arquivo do Nubank
- `npm run build` — versão de produção em `dist/`

## Importar do Nubank

Tela **Importar**: arraste o CSV da fatura do cartão, o CSV do extrato da conta ou um OFX.
Arquivos de exemplo para testar estão em `exemplos/`.

- Compras "Parcela X/Y" viram compras parceladas.
- Reimportar o mesmo arquivo não duplica nada.
- Ao corrigir uma categoria na revisão, o app cria uma regra (editável em Personalizar).

## Backup

Personalizar → Exportar backup (JSON). Como tudo fica no navegador, limpar os dados do site apaga o histórico. Faça backup de vez em quando.
