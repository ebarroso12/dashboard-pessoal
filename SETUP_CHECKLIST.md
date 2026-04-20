# Setup Checklist - Dashboard Pessoal

## ✅ Configuração Inicial

### 1. Variáveis de Ambiente (Vercel)

- [ ] `GOOGLE_CLIENT_ID` - Configurado
- [ ] `GOOGLE_CLIENT_SECRET` - Configurado
- [ ] `META_APP_ID` - Configurado (1022100999856299)
- [ ] `GA4_PROPERTY_ID` - Configurado
- [ ] `WEBHOOK_TOKEN` - Configurado
- [ ] `ANTHROPIC_API_KEY` - Configurado

**Status Atual**: ✅ Todas configuradas

### 2. Configuração de Credenciais

#### Google Cloud
- [ ] Projeto criado em [Google Cloud Console](https://console.cloud.google.com)
- [ ] API Google Calendar ativada
- [ ] OAuth 2.0 credentials criadas
- [ ] URIs autorizadas configuradas
- [ ] Client ID e Secret copiados

#### Meta (Facebook/Instagram)
- [ ] App criado em [Meta Developers](https://developers.facebook.com)
- [ ] Instagram Graph API adicionada
- [ ] Escopos configurados:
  - [ ] `pages_read_engagement`
  - [ ] `instagram_basic`
  - [ ] `instagram_manage_insights`
  - [ ] `pages_show_list`
  - [ ] `read_insights`
- [ ] App ID copiado

#### Google Analytics
- [ ] Conta criada em [Google Analytics](https://analytics.google.com)
- [ ] Property ID obtido
- [ ] Rastreamento configurado no site

### 3. Contas Pessoais

#### Instagram
- [ ] Conta é do tipo **Business** (não pessoal)
- [ ] Vinculada a uma **Página Facebook**
- [ ] Permissões concedidas ao app Meta

#### Facebook
- [ ] Página criada
- [ ] Instagram Business vinculado
- [ ] Permissões de acesso concedidas
- [ ] Escopos `pages_read_engagement` e `pages_show_list` ativos

#### WhatsApp Business
- [ ] Conta Meta Business Manager (BM) ativa
- [ ] WhatsApp Business Account (WABA) configurada
- [ ] Número de telefone verificado na API
- [ ] Escopos `whatsapp_business_management` e `whatsapp_business_messaging` ativos

#### Google
- [ ] Conta Google ativa
- [ ] Google Calendar com eventos
- [ ] YouTube channel (opcional)

#### TikTok
- [ ] Conta TikTok criada
- [ ] Dados inseridos manualmente ou via API

### 4. Testes de Integração

#### Google Calendar
- [ ] Botão "Conectar" funciona
- [ ] Eventos aparecem no dashboard
- [ ] Próximos eventos listados corretamente

#### Instagram
- [ ] Botão "Conectar" funciona
- [ ] Métricas aparecem:
  - [ ] Seguidores
  - [ ] Alcance 7D
  - [ ] Impressões 7D
  - [ ] Taxa de Engajamento
- [ ] Gráfico atualiza

#### Facebook
- [ ] Botão "Conectar" funciona
- [ ] Métricas aparecem:
  - [ ] Curtidas da Página
  - [ ] Alcance 7D
  - [ ] Posts do Mês
  - [ ] Engajamento

#### Google Analytics
- [ ] Dados carregam corretamente
- [ ] Sessões e usuários exibidos
- [ ] Gráfico atualiza

#### Outras Plataformas
- [ ] YouTube conecta e exibe dados
- [ ] TikTok dados inseridos manualmente
- [ ] WhatsApp Business conecta

### 5. Funcionalidades Gerais

- [ ] Dashboard carrega sem erros
- [ ] Widgets são draggáveis
- [ ] Responsividade funciona (mobile/tablet/desktop)
- [ ] Tema escuro aplicado corretamente
- [ ] Animações suaves
- [ ] Console sem erros

### 6. Segurança

- [ ] Tokens armazenados em localStorage
- [ ] Validação de estado CSRF implementada
- [ ] Sem dados sensíveis em logs
- [ ] HTTPS ativado no Vercel
- [ ] Variáveis de ambiente não expostas

### 7. Performance

- [ ] Dashboard carrega em < 2s
- [ ] Gráficos renderizam rapidamente
- [ ] Sem vazamento de memória
- [ ] API calls otimizadas

### 8. Deploy

- [ ] Repositório GitHub conectado
- [ ] Deploy automático no Vercel ativado
- [ ] Build sem erros
- [ ] URL pública acessível
- [ ] Domínio customizado (opcional)

## 🔄 Checklist de Manutenção

### Semanal
- [ ] Verificar logs de erro
- [ ] Confirmar que tokens ainda estão válidos
- [ ] Revisar métricas de uso

### Mensal
- [ ] Atualizar dependências
- [ ] Revisar performance
- [ ] Backup de dados

### Trimestral
- [ ] Revisar e atualizar documentação
- [ ] Auditar permissões de API
- [ ] Planejar novas funcionalidades

## 📋 Troubleshooting

### Problema: "Nenhuma Página Facebook encontrada"
**Solução**:
1. Verifique se tem uma Página Facebook criada
2. Confirme que está logado com a conta correta
3. Revoke e reconecte o token

### Problema: "Vincule conta Instagram Business à Página Facebook"
**Solução**:
1. Acesse as configurações da Página Facebook
2. Vá para "Instagram"
3. Clique em "Conectar Conta"
4. Selecione sua conta Instagram Business

### Problema: Token Expirado
**Solução**:
1. Clique no botão "Conectar" novamente
2. Autorize o acesso
3. Novo token será armazenado

### Problema: Dados Não Aparecem
**Solução**:
1. Abra DevTools (F12)
2. Verifique a aba Network
3. Procure por erros em chamadas para `graph.facebook.com`
4. Verifique o console para mensagens de erro

## 📊 Métricas de Sucesso

- ✅ Todas as integrações conectam sem erros
- ✅ Dados aparecem em tempo real
- ✅ Dashboard carrega em < 2 segundos
- ✅ Sem erros no console
- ✅ Responsivo em todos os dispositivos
- ✅ Tokens renovam automaticamente
- ✅ Gráficos atualizam corretamente

## 🎯 Próximas Melhorias

- [ ] Adicionar mais plataformas (LinkedIn, Pinterest, etc)
- [ ] Implementar sincronização automática de dados
- [ ] Criar relatórios exportáveis
- [ ] Adicionar notificações de alerta
- [ ] Melhorar análise de dados com IA
- [ ] Implementar temas customizáveis

---

**Data de Criação**: Abril 2026
**Última Atualização**: Abril 2026
**Status**: ✅ Completo
