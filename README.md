# Placas Perdidas

React 19 + Vite + Tailwind + Firebase Firestore, hospedado na Vercel.

## Desbloqueio de contatos via Pix (R$ 5,00)

A busca exibe placa, tipo e cidade, mas **nunca envia nome ou telefone completos ao navegador**. O endpoint `/api/placas/search` usa o Firebase Admin SDK no servidor e devolve somente dados públicos e máscaras. Após pagamento Pix de R$ 5,00 no Asaas e confirmação por webhook autenticado, `/api/placas/contact` libera os contatos para a sessão Firebase autenticada que pagou.

**Importante: o recurso não está pronto para produção só com o merge.** As credenciais, o App Check, o webhook, as regras Firestore e o lockfile precisam ser configurados e validados em preview.

### 1. Dependências e testes

```bash
npm install
npm test
npm run lint
npm run build
```

O `package.json` inclui `firebase-admin`. **Execute `npm install` e faça commit do `package-lock.json` gerado antes de fazer merge**. O lock anterior foi mantido sem dependências inventadas.

### 2. Firebase

- No projeto `placasperdidas-f0bcd`, ative **Authentication > Sign-in method > Anonymous**. A identidade anônima preserva o acesso no mesmo navegador, enquanto não for apagado o armazenamento local. Se o usuário trocar de aparelho ou limpar os dados, o acesso não será recuperável sem um futuro mecanismo de conta/recuperação.
- Ative **App Check** para Web com **reCAPTCHA v3** e registre os domínios da Vercel. Use a chave pública em `VITE_APP_CHECK_SITE_KEY`.
- Em **Vercel > Environment Variables**, cadastre `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` de uma conta de serviço com acesso ao Firestore. A chave privada deve preservar as quebras de linha (`\\n` também é aceito). **Nunca publicar credenciais no GitHub ou expor variáveis privadas com `VITE_`.**
- Antes da liberação pública, publique as regras `firestore.rules` com o Firebase CLI:
  ```bash
  firebase deploy --only firestore:rules --project placasperdidas-f0bcd
  ```
- As regras negam leitura/escrita direta à coleção `placas` para todos, exceto usuários com a *custom claim* `admin: true`. Elas também negam totalmente acesso cliente a `payments`, `payment_attempts`, `unlocks` e `rate_limits`. Essas regras bloqueiam a versão antiga do site, que consultava o Firestore diretamente. **Planeje o corte de produção para evitar downtime.**
- Para atribuir admin ao usuário existente do painel, exporte as três variáveis de conta de serviço em um terminal privado e execute:
  ```bash
  node scripts/set-admin-claim.mjs UID_DO_ADMIN
  ```
  Faça logout/login do painel depois; não conceda admin a usuários anônimos.
- Se o banco usa outras coleções diretamente pelo frontend em integrações externas, revise as regras antes de publicar; este projeto somente utiliza `placas` no frontend.

### 3. Asaas

- Configure `ASAAS_API_BASE_URL`, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` **somente como variáveis privadas na Vercel**.
- Em sandbox use `https://sandbox.asaas.com/api`. Em produção use `https://api.asaas.com`.
- Configure o webhook do Asaas para `https://SEU-DOMINIO/api/payments/webhook`, com autenticação por token definida no painel do Asaas. O token recebido no cabeçalho `asaas-access-token` deve ser idêntico a `ASAAS_WEBHOOK_TOKEN`.
- Selecione pelo menos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED` e `PAYMENT_REFUNDED`; a aplicação valida o ID da cobrança, valor de R$ 5,00, forma Pix, referência externa e status antes de liberar.
- O pagador informa nome, e-mail e CPF para emissão da cobrança. Esses dados seguem ao Asaas; o CPF **não é persistido pelo projeto** no Firestore.
- A chave Pix da seção **Apoie o projeto** é para doação e **não libera contatos**. O único desbloqueio válido ocorre no QR Pix de cobrança gerado pelo Asaas.

### 4. Registros legados e privacidade

Os registros anteriores à implementação **não possuem autorização explícita para compartilhar contatos mediante pagamento**. A busca ainda os exibe, mas o botão de pagamento fica indisponível. Para habilitar a liberação é necessário obter nova autorização do responsável pelo contato e só então marcar `consentToUnlock: true` no registro, com evidência da autorização. Não altere todos os registros em lote automaticamente.

Novos cadastros exigem aceite explícito e gravam `consentAt`. Antes da monetização, prepare também uma Política de Privacidade e Termos válidos para o negócio, com regras de retenção de dados, identificação do controlador e canal de atendimento; o texto do checkbox sozinho não garante conformidade com a LGPD.

### 5. Fluxos e endpoints

| Endpoint | Método | Autorização | Função |
| --- | --- | --- | --- |
| `/api/placas/search?placa=...` | GET | Firebase App Check | Retorna máscara e localização |
| `/api/placas/register` | POST | App Check + Firebase Auth | Cadastro com consentimento |
| `/api/payments/create` | POST | App Check + Firebase Auth | Cobrança de R$ 5,00 |
| `/api/payments/status?plateId=...` | GET | App Check + Firebase Auth | Retorna status e QR Pix |
| `/api/placas/contact?id=...` | GET | App Check + Firebase Auth | Contato somente com desbloqueio pago |
| `/api/payments/webhook` | POST | Token secreto Asaas | Confirma pagamentos e trata estorno |

O valor de cobrança é definido **exclusivamente no servidor**. IDs de usuário, IDs de pagamento e status não são confiados ao cliente. Há um limite básico de cinco cadastros e cinco tentativas de pagamento por UID anônimo por dia; para alto volume, use proteção adicional antifraude e limites por IP no gateway/WAF.

### 6. Checklist de homologação

1. Executar `npm install` e salvar o lockfile.
2. Usar Firebase e Asaas **sandbox/testes** e domínio de preview no App Check.
3. Testar consulta da placa no DevTools: a resposta da busca **não pode conter `nome` ou `telefone`**.
4. Confirmar que acessar `placas` pelo SDK cliente retorna **permission-denied** para usuário anônimo.
5. Testar `/api/placas/contact` antes do pagamento: resposta **403**, mesmo com IDs válidos.
6. Gerar cobrança Pix e validar um webhook real do Asaas sandbox; somente então o contato deve ser liberado.
7. Testar webhook com token inválido, valor diferente de R$ 5,00 e pagamento falso: não deve liberar.
8. Confirmar que cadastros legados sem consentimento não podem ser cobrados nem ter contato liberado.
9. Testar renovação de token admin e acesso ao painel.
10. Validar se as rotas `/api/` são resolvidas como Vercel Functions no preview; não podem retornar HTML da SPA.

**Não foi executada uma cobrança real nem realizada implantação no Firebase ou na Vercel nesta branch.**
