# Placas Perdidas

Projeto em React 19 + Vite + Tailwind, com **Firebase já existente** (`placasperdidas-f0bcd`) e Vercel.

## Novo fluxo: desbloqueio manual por Pix de R$ 5,00

**Não há gateway, Asaas nem webhook financeiro.** A transferência é feita para uma **chave Pix estática**. O comprador informa quem fez o Pix e clica em **Já fiz o Pix**. A solicitação fica pendente no Firebase. O administrador **confere o recebimento real na conta** e decide **Aprovar** ou **Recusar** no painel `/admin`. Somente com a aprovação os dados de contato são disponibilizados à sessão que fez a solicitação.

Fluxo:

1. Busca retorna placa, tipo, cidade e **máscaras** de nome e telefone, nunca os dados completos.
2. Modal informa R$ 5,00, mostra chave Pix e formulário com nome do pagador e identificador opcional da transação.
3. Após registrar solicitação, o site oferece **Enviar comprovante por e-mail** para `placasperdidasoficial@gmail.com`. O usuário deve **anexar o comprovante manualmente no e-mail**.
4. No painel `/admin`, as solicitações pendentes têm protocolo, pagador, placa e identificador. O administrador só deve aprovar após conferir a transação bancária/comprovante. O clique **não significa Pix confirmado**.
5. A aprovação gera um registro de autorização em `unlocks`; o usuário vê contato após atualizar o status (consulta periódica enquanto o modal está aberto).

### Etapa 1 — Preparação local

```bash
git pull --ff-only
npm install
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Não execute `npm audit fix --force` sem avaliar quebras. O `package-lock.json` local alterado pelo npm deve ser comitado em uma etapa posterior, após os testes.

### Etapa 2 — Mesmo Firebase, novos controles de segurança

Você **não precisa criar outro Firebase nem outro Firestore**. O cadastro atual continua na coleção `placas`.

- No Firebase Console > Authentication > Sign-in method, habilite **Anonymous** (sessões públicas para associar a compra a uma identidade). A autenticação por e-mail/senha do admin permanece.
- No Firebase Console > App Check, configure **reCAPTCHA v3** para sua Web App; cadastre os domínios de preview e produção. Informe a chave pública no `VITE_APP_CHECK_SITE_KEY` da Vercel (e localmente, se for testar a API).
- No Firebase Console > Configurações do projeto > Contas de serviço, gere uma **chave privada de conta de serviço**. Salve as variáveis abaixo **somente nas variáveis privadas da Vercel**, nunca no GitHub, nunca em código e nunca com prefixo `VITE_`:
  - `FIREBASE_PROJECT_ID=placasperdidas-f0bcd`
  - `FIREBASE_CLIENT_EMAIL=...`
  - `FIREBASE_PRIVATE_KEY=...`
- Na Vercel configure também `VITE_APP_CHECK_SITE_KEY` e a chave pública `VITE_PIX_KEY`. **Confirme a chave Pix real** antes de publicar. A mesma chave existia anteriormente na seção de doações do site.
- Conceda *custom claim* de administrador ao UID **existente** do Firebase Auth:
  ```bash
  node scripts/set-admin-claim.mjs UID_DO_ADMIN
  ```
  O script exige `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` configuradas em um terminal privado. Use apenas o UID da sua conta de admin autenticada por e-mail. Faça logout/login depois para renovar o token.
- Antes de lançar a versão nova, publique `firestore.rules` com `firebase deploy --only firestore:rules --project placasperdidas-f0bcd`.

**Cuidado:** as novas regras bloqueiam a consulta antiga `getDocs(collection(db, "placas"))` por usuários públicos. A nova busca usa API no servidor, que filtra as informações. **Coordenar deploy e publicação das regras** para não interromper a versão em produção. Se outras aplicações acessam essa coleção diretamente, revise as regras com antecedência.

### Etapa 3 — Segurança e privacidade

- **Não são apenas asteriscos no frontend.** `GET /api/placas/search` busca no servidor e responde só com dados públicos e campos mascarados.
- `/api/placas/contact` usa Firebase Auth e só entrega contato quando `unlocks/{uid}_{plateId}` tem `status: "paid"`.
- `/api/payments/review` e `/api/payments/pending` exigem a custom claim `admin: true` verificada no servidor. A UI também verifica a claim, mas a segurança depende do backend e das regras.
- **Não habilite o pagamento de cadastros antigos automaticamente.** Eles não têm autorização prévia para disponibilizar contato pago. Para liberá-los, obtenha o consentimento da pessoa que os cadastrou, guarde evidência e só então adicione `consentToUnlock: true` no Firestore. Novos cadastros coletam consentimento explícito e data de autorização.
- O recibo não é enviado nem armazenado automaticamente no Firebase: é enviado por e-mail, e você precisa conferi-lo na conta bancária antes de aprovar. Um usuário pode clicar em **Já fiz o Pix** sem ter pago; **isso nunca libera contato**.
- Sem conta persistente, uma sessão anônima pode perder o acesso ao desbloqueio ao trocar de aparelho, limpar dados do navegador ou sair da sessão. Planeje um mecanismo futuro de recuperação antes de cobrar usuários reais.
- Reavalie Termos de Uso, Política de Privacidade e retenção de contatos conforme a LGPD.

### Endpoints

| Endpoint | Método | Proteção | Uso |
| --- | --- | --- | --- |
| `/api/placas/search?placa=...` | GET | App Check | Buscar placa com informações mascaradas |
| `/api/placas/register` | POST | App Check + Auth | Cadastro com consentimento |
| `/api/payments/create` | POST | App Check + Auth | Registrar solicitação manual após Pix |
| `/api/payments/status?plateId=...` | GET | App Check + Auth | Verificar aprovação ou recusa |
| `/api/payments/pending` | GET | App Check + Auth Admin | Listar solicitações pendentes |
| `/api/payments/review` | POST | App Check + Auth Admin | Aprovar/recusar após conferência real |
| `/api/placas/contact?id=...` | GET | App Check + Auth + desbloqueio | Liberar contato para quem teve solicitação aprovada |

### Checklist mínimo antes do merge

1. Rodar lint, testes e build localmente (após puxar a branch). Revisar vulnerabilidades restantes do `npm audit`.
2. Confirmar chave Pix real e e-mail de suporte, pois a aprovação é manual.
3. Configurar App Check, Firebase Admin SDK na Vercel e custom claim do admin no **projeto Firebase atual**.
4. Testar no domínio de preview: busca não retorna telefone/nome completos no DevTools; usuário público não consegue ler `placas` diretamente pelo SDK Firestore.
5. Criar uma solicitação **sem fazer Pix** e confirmar que o contato fica bloqueado, mesmo após clicar em Já fiz o Pix.
6. Confirmar que o administrador visualiza a solicitação, pode recusá-la e que, ao aprovar outra, apenas a sessão solicitante recupera o contato.
7. Verificar que usuários sem claim admin não acessam ou alteram solicitações.
8. Confirmar que cadastros antigos sem consentimento não podem ser cobrados ou desbloqueados.
9. Definir como o comprador recuperará uma compra se trocar de navegador ou limpar a sessão anônima.
10. Só depois publicar as regras Firestore e promover o deploy da aplicação.

**Importante:** a branch ainda não foi homologada ponta a ponta com Firebase real nem com Pix bancário real. O fluxo foi implementado como aprovação administrativa, não como verificação financeira automática.
