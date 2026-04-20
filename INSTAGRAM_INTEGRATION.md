# Integração do Instagram - Documentação Técnica

## Visão Geral

O dashboard integra-se com o **Instagram Business** através da **Meta Graph API** para exibir métricas de desempenho em tempo real.

## Fluxo de Autenticação

### 1. OAuth 2.0 Implicit Flow
- **Endpoint**: `https://www.facebook.com/dialog/oauth`
- **Escopos Requeridos**:
  - `pages_read_engagement` - Leitura de dados de engajamento da página
  - `instagram_basic` - Acesso básico ao Instagram
  - `instagram_manage_insights` - Acesso a insights do Instagram
  - `pages_show_list` - Listagem de páginas
  - `read_insights` - Leitura de insights

### 2. Armazenamento de Token
- Token armazenado em `localStorage` com chave: `dash_meta_token`
- Tempo de expiração: Geralmente 60 dias (verificar no portal Meta)
- Renovação: Manual via botão "Conectar" no dashboard

## Métricas Coletadas

### Dados do Perfil Instagram
- **Seguidores** (`followers_count`)
- **Quantidade de Posts** (`media_count`)
- **Nome da Conta** (`name`)

### Insights (Últimos 7 dias)
- **Alcance** (`reach`) - Número único de pessoas que viram o conteúdo
- **Impressões** (`impressions`) - Total de vezes que o conteúdo foi visto
- **Taxa de Engajamento** - Calculada como: `(reach / followers) * 100`

## Estrutura de Dados

```javascript
// Formato dos dados exibidos no dashboard
{
  followers: 15500,          // Seguidores
  reach: 47400,              // Alcance 7D
  impressions: 1200,         // Impressões 7D
  engagement: "10.0%",       // Taxa de engajamento
  accountName: "@dredsonbarroso"
}
```

## Endpoints da Meta Graph API Utilizados

### 1. Listar Páginas Facebook
```
GET /me/accounts?access_token={token}
```
Retorna todas as páginas Facebook associadas à conta do usuário.

### 2. Obter Conta Instagram Vinculada
```
GET /{page_id}?fields=instagram_business_account&access_token={token}
```
Retorna o ID da conta Instagram Business vinculada à página.

### 3. Obter Perfil Instagram
```
GET /{ig_id}?fields=followers_count,media_count,name&access_token={token}
```
Retorna informações básicas do perfil Instagram.

### 4. Obter Insights
```
GET /{ig_id}/insights?metric=reach,impressions&period=day&since={since}&until={until}&access_token={token}
```
Retorna métricas de desempenho para o período especificado.

## Tratamento de Erros

| Erro | Causa | Solução |
|------|-------|---------|
| "Nenhuma Página Facebook encontrada" | Usuário não tem páginas Facebook | Criar uma página no Facebook |
| "Vincule conta Instagram Business à Página Facebook" | Instagram não está vinculado | Vincular conta Instagram Business na configuração da página |
| "Erro na API do Instagram" | Falha na requisição | Verificar token, escopos e permissões |

## Configuração Necessária

### Variáveis de Ambiente (Vercel)
```
META_APP_ID=1022100999856299
```

### Configuração no Portal Meta
1. Acessar [developers.facebook.com](https://developers.facebook.com)
2. Criar/acessar aplicativo
3. Adicionar produto "Instagram Graph API"
4. Configurar escopos de permissão
5. Gerar token de acesso

## Limitações Conhecidas

- **Período de Dados**: Insights disponíveis apenas para os últimos 7 dias
- **Atualização**: Dados são atualizados sob demanda (sem polling automático)
- **Autenticação**: Token requer renovação manual após expiração
- **Permissões**: Requer conta Instagram Business (não pessoal)

## Debugging

### Verificar Token
```javascript
console.log(localStorage.getItem('dash_meta_token'));
```

### Verificar Resposta da API
Abrir DevTools (F12) → Network → Filtrar por `graph.facebook.com`

### Logs de Erro
Verificar console do navegador para mensagens de erro detalhadas

## Referências

- [Meta Graph API Documentation](https://developers.facebook.com/docs/graph-api)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [OAuth 2.0 Implicit Flow](https://developers.facebook.com/docs/facebook-login/web/login-flow)
