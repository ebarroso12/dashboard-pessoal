# Google Calendar - Refresh Token Automático

## Problema Original
Google Calendar token expira em **1 hora**. Antes era necessário fazer login no Google novamente toda hora.

## Solução Implementada
Agora usa **refresh_token** que é válido por **6 meses**. Token é renovado automaticamente sem intervenção do usuário.

##  Arquivos Criados

### `/api/google/refresh.js`
Endpoint que:
- Aceita `refresh_token` no body
- Faz request para `https://oauth2.googleapis.com/token`
- Retorna novo `access_token` válido
- Cliente busca automaticamente quando token expira

### Como Funciona

1. **Primeira Autenticação (Manual)**
   - User clica em "Conectar Google"
      - Google retorna `access_token` + `refresh_token`
         - Dashboard armazena AMBOS em localStorage

         2. **Renovação Automática (Cada 50 min)**
            - Dashboard detecta token expirando em 50 minutos
               - Chamada POST para `/api/google/refresh.js`
                  - Novo token gerado sem pedir ao user
                     - Google Calendar continua funcionando

                     3. **Validade**
                        - `access_token`: 1 hora  
                           - `refresh_token`: 6 meses (renovável indefinidamente)

                           ## Configuração Necessária

                           Nenhuma configuração adicional! O sistema é automático após primeira autenticação.

                           ### Variáveis de Ambiente (já existentes)
                           ```
                           GOOGLE_CLIENT_ID=seu_id.apps.googleusercontent.com
                           GOOGLE_CLIENT_SECRET=sua_secret
                           ```

                           ## Testando

                           1. Ir ao Dashboard: https://dashboard-pessoal-edson.vercel.app
                           2. Clique em "Conectar" no widget Google Calendar
                           3. Faça login no Google  
                           4. Sistema armazena token + refresh_token
                           5. **Pronto!** Nunca mais expira por 6 meses

                           ## Monitoramento

                           Abra Dev Tools (F12) > Application > Local Storage:
                           - `google_access_token` - Token de acesso (1h)
                           - `google_refresh_token` - Token de renovação (6m)
                           - `token_expiry_time` - Timestamp de expiração

                           ## Se Precisa Desconectar

                           Clique em "Desconectar" ou delete de localStorage:
                           ```js
                           localStorage.removeItem('google_access_token');
                           localStorage.removeItem('google_refresh_token');
                           localStorage.removeItem('token_expiry_time');
                           ```

                           ## API Endpoints

                           ### POST /api/google/token
                           Primeiro login (obtém tokens iniciais)

                           ### POST /api/google/refresh  
                           Renovação automática de token expirado
