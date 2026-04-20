# Integração Facebook & WhatsApp Business - Documentação Técnica

## 1. Facebook Pages Integration

O dashboard monitora o desempenho de páginas do Facebook utilizando a **Meta Graph API**.

### Fluxo de Autenticação
- **Método**: OAuth 2.0 (Implicit Flow ou via FB SDK)
- **Escopos Necessários**:
  - `pages_read_engagement`
  - `pages_show_list`
  - `read_insights`

### Métricas Coletadas (Últimos 7 dias)
- **Curtidas da Página** (`fan_count`)
- **Alcance/Impressões** (`page_impressions`)
- **Engajamento** (`page_post_engagements`)
- **Posts Publicados** (Contagem dos últimos 30 posts)

### Endpoints Utilizados
- `GET /me/accounts`: Lista as páginas do usuário.
- `GET /{page_id}?fields=fan_count,published_posts`: Obtém dados básicos da página.
- `GET /{page_id}/insights`: Obtém métricas de alcance e engajamento.

---

## 2. WhatsApp Business API Integration

Integração com a **WhatsApp Business Platform** para monitorar métricas de mensagens.

### Fluxo de Autenticação
- **Escopos Adicionais**:
  - `whatsapp_business_management`
  - `whatsapp_business_messaging`

### Processo de Descoberta
1. **Business Manager**: Localiza o ID do negócio (`/me/businesses`).
2. **WABA**: Localiza a conta do WhatsApp Business (`/owned_whatsapp_business_accounts`).
3. **Phone Number**: Identifica o número de telefone e ID da conta.
4. **Analytics**: Consulta os dados de mensagens (`/analytics`).

### Métricas Coletadas (Últimos 30 dias)
- **Mensagens Enviadas** (`sent`)
- **Mensagens Entregues** (`delivered`)
- **Mensagens Lidas** (`read`)
- **Taxa de Leitura**: Calculada como `(read / delivered) * 100`.

---

## 3. Configuração e Troubleshooting

### Variáveis de Ambiente
- `META_APP_ID`: ID do aplicativo no portal Meta Developers.

### Requisitos de Conta
- **Facebook**: O usuário deve ser administrador da página.
- **WhatsApp**: A conta deve ser uma **WhatsApp Business Account (WABA)** oficial via API.

### Erros Comuns
| Erro | Causa | Solução |
|------|-------|---------|
| "Nenhum Business Manager encontrado" | Usuário não possui conta BM | Criar conta em business.facebook.com |
| "Nenhuma conta WhatsApp Business encontrada" | WABA não configurada | Configurar WABA no painel Meta |
| "Erro na API do Facebook" | Token expirado ou falta de permissão | Refazer login e verificar escopos |

---

## 4. Modo Manual (Fallback)

Caso a API não esteja disponível ou a conta não seja API oficial, o dashboard permite a inserção manual de dados:
- **WhatsApp**: Inserção de mensagens enviadas, recebidas e taxa de leitura.
- **Armazenamento**: Dados salvos no `localStorage` (`dash_wab_manual`).

---
**Última atualização**: Abril 2026
