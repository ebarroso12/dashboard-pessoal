# Critérios de Widgets Confiáveis

> Documento criado em: 2026-05-11  
> Escopo: síntese estratégica curta, sem código, banco, testes ou nova arquitetura

---

## 1. Critério de widget confiável

Um widget é confiável quando:

- Carrega sem erro.
- Mostra dados vindos da fonte correta.
- Exibe estado vazio de forma honesta.
- Mostra data/hora de atualização quando relevante.
- Falha de API aparece como erro claro, não como sucesso vazio.
- Não expõe tokens, secrets ou dados sensíveis.

---

## 2. Critério de widget fake/legado

Um widget deve ser marcado como fake/legado quando:

- Usa dado hardcoded.
- Mostra registros antigos como se fossem atuais.
- Depende de tabela vazia ou inexistente.
- Exibe status "online" sem validação real.
- Não informa origem dos dados.
- Parece funcional, mas não muda com dados reais.

---

## 3. Critério de widget crítico

Um widget é crítico quando afeta:

- Operação diária.
- Agenda, briefing ou WhatsApp.
- Diagnóstico do sistema.
- Segurança ou exposição de dados.
- Decisão financeira, clínica ou operacional.
- Confiança do usuário no estado real do sistema.

---

## 4. Ordem ideal de auditoria

1. Morning Briefing.
2. Supervisor IA.
3. OpenClaw / WhatsApp.
4. Alertas.
5. Google Calendar.
6. Gmail.
7. Google Drive.
8. Financeiro.
9. Tarefas e metas.
10. Widgets de marketing/social.

---

## 5. Top 5 widgets prioritários

1. **Morning Briefing** — maior impacto diário.
2. **Supervisor IA** — maior risco de falso diagnóstico e segurança.
3. **OpenClaw / WhatsApp** — canal principal futuro do Segundo Eu.
4. **Alertas** — pode parecer vazio por falha estrutural.
5. **Google Calendar** — agenda é base operacional do assistente.

---

## 6. O que NÃO auditar agora

- Ajustes visuais finos.
- Tema, imagens e layout.
- Widgets sociais sem uso operacional confirmado.
- Cards puramente decorativos.
- Fluxos futuros de documentos, áudio e memória IA.
- Performance avançada.
- Refatoração de frontend.

---

## 7. Estratégia econômica de validação

Validar cada widget com o menor teste manual possível:

1. Confirmar se a fonte existe.
2. Confirmar se há dado recente.
3. Confirmar se o dashboard mostra o mesmo dado.
4. Confirmar como ele falha quando a fonte está vazia ou indisponível.
5. Classificar como `confiável`, `parcial`, `fake/legado` ou `crítico com risco`.

Só widgets críticos ou com falso funcionamento devem gerar tarefa técnica imediata.
