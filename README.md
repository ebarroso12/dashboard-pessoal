# Dashboard Pessoal - Edson Barroso

Um dashboard completo e moderno para monitoramento de métricas pessoais, integrando dados de múltiplas plataformas em tempo real.

## 🎯 Funcionalidades

### 📊 Integrações Disponíveis

- **Google Calendar** - Agenda pessoal com próximos eventos
- **Instagram** - Métricas de seguidores, alcance e engajamento
- **Facebook** - Dados de página, curtidas e engajamento
- **Google Meu Negócio** - Visualizações, cliques e avaliações
- **YouTube** - Inscritos, views e watchtime
- **Google Analytics** - Sessões, usuários e pageviews
- **TikTok** - Seguidores, views e likes
- **WhatsApp Business** - Métricas de mensagens e contatos
- **Sistema de Monitoramento** - Status de infraestrutura em tempo real

### 🎨 Interface

- Design moderno com tema escuro
- Gráficos interativos com Chart.js
- Widgets draggáveis e personalizáveis
- Responsivo para desktop e mobile
- Animações suaves com Aurora background

### 🔐 Segurança

- OAuth 2.0 para autenticação
- Tokens armazenados localmente
- Validação de estado CSRF
- Suporte a múltiplos usuários

## 🚀 Começando

### Pré-requisitos

- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Contas ativas nas plataformas que deseja integrar
- Credenciais de API configuradas

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/ebarroso12/dashboard-pessoal.git
cd dashboard-pessoal
```

2. Configure as variáveis de ambiente no Vercel:
```
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
META_APP_ID=seu_meta_app_id
GA4_PROPERTY_ID=seu_ga4_property_id
```

3. Abra `dashboard.html` em seu navegador ou acesse a URL do Vercel

## 📋 Configuração de Integrações

### Google Calendar

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto
3. Ative a API do Google Calendar
4. Crie credenciais OAuth 2.0 (tipo: Web application)
5. Configure as URIs autorizadas: `https://seu-dominio.com/dashboard.html`
6. Copie o Client ID e Client Secret

### Instagram / Facebook

1. Acesse [Meta Developers](https://developers.facebook.com)
2. Crie um novo aplicativo
3. Adicione o produto "Instagram Graph API"
4. Configure as permissões de escopo
5. Gere um token de acesso
6. Configure o App ID nas variáveis de ambiente

### Google Analytics 4

1. Acesse [Google Analytics](https://analytics.google.com)
2. Copie o Property ID
3. Configure nas variáveis de ambiente

## 📁 Estrutura do Projeto

```
dashboard-pessoal/
├── dashboard.html          # Arquivo principal (HTML + CSS + JS)
├── api/
│   ├── config.js          # Configuração de variáveis de ambiente
│   └── google/
│       ├── calendar.js    # Integração Google Calendar
│       ├── refresh.js     # Refresh de tokens
│       └── token.js       # Gerenciamento de tokens
├── README.md              # Este arquivo
├── GOOGLE_CALENDAR_SETUP.md
└── INSTAGRAM_INTEGRATION.md
```

## 🔧 Desenvolvimento

### Estrutura do Código

O arquivo `dashboard.html` é um single-page application (SPA) contendo:

- **HTML**: Estrutura dos widgets e modais
- **CSS**: Estilos com variáveis CSS customizáveis
- **JavaScript**: Lógica de integração e interação

### Adicionar Nova Integração

1. Crie a função de carregamento: `async function loadNovaPlataforma(token)`
2. Implemente a busca de dados via API
3. Atualize os elementos HTML correspondentes
4. Adicione tratamento de erros
5. Integre ao fluxo de OAuth

### Variáveis CSS Principais

```css
--bg: #0a0b0d;              /* Fundo principal */
--text: #e8eaed;            /* Texto principal */
--accent: #6c8ebf;          /* Cor de destaque */
--coral: #c85252;           /* Cor de erro */
--green: #52c878;           /* Cor de sucesso */
```

## 📊 Métricas Rastreadas

| Plataforma | Métricas |
|------------|----------|
| Instagram | Seguidores, Alcance, Impressões, Engajamento |
| Facebook | Curtidas, Alcance, Posts, Engajamento |
| YouTube | Inscritos, Views, Watchtime, Likes |
| Google Analytics | Sessões, Usuários, Pageviews, Taxa de Engajamento |
| TikTok | Seguidores, Views, Likes, Vídeos |
| WhatsApp Business | Msgs Enviadas, Recebidas, Taxa de Leitura, Contatos |
| Google Meu Negócio | Visualizações, Cliques, Buscas, Avaliações |

## 🐛 Troubleshooting

### Token Expirado
- Clique no botão "Conectar" da plataforma novamente
- O novo token será armazenado automaticamente

### Dados Não Aparecem
1. Verifique o console do navegador (F12)
2. Confirme que as credenciais estão corretas
3. Verifique as permissões de escopo
4. Teste a API diretamente via Postman

### CORS Error
- Certifique-se de que o domínio está autorizado
- Verifique as configurações de CORS no backend

## 📝 Logs

Os logs são exibidos no console do navegador. Para ativar logs detalhados:

```javascript
// No console do navegador
localStorage.setItem('debug_mode', 'true');
location.reload();
```

## 🔄 Atualização de Dados

- **Google Calendar**: Atualiza ao clicar em "Conectado"
- **Instagram/Facebook**: Atualiza ao clicar em "Conectado"
- **Outras plataformas**: Atualizam sob demanda

Para atualização automática, configure um intervalo:

```javascript
setInterval(() => {
  const token = localStorage.getItem('dash_meta_token');
  if(token) loadInstagram(token);
}, 300000); // 5 minutos
```

## 🚀 Deploy

O projeto está configurado para deploy automático no Vercel:

1. Push para o repositório GitHub
2. Vercel detecta mudanças automaticamente
3. Build e deploy são executados
4. URL atualizada em tempo real

### Build Manual

```bash
# Não há build necessário - é um SPA puro
# Apenas faça push para o repositório
git add .
git commit -m "Atualização do dashboard"
git push origin main
```

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique a documentação de cada integração
2. Consulte os logs no console do navegador
3. Abra uma issue no GitHub

## 📄 Licença

Projeto pessoal - Todos os direitos reservados

## 🔗 Links Úteis

- [Meta Graph API](https://developers.facebook.com/docs/graph-api)
- [Google APIs](https://developers.google.com/apis-explorer)
- [Vercel Docs](https://vercel.com/docs)
- [Chart.js](https://www.chartjs.org/)

---

**Última atualização**: Abril 2026
**Versão**: 2.0.0
**Status**: ✅ Produção
