# Visão OpenClaw, CRM e Supervisor IA

> Documento criado em: 2026-05-11  
> Escopo: documentação arquitetural curta, sem SQL, sem código, sem migration

---

## 1. Papel do OpenClaw no sistema

O OpenClaw é o conector operacional entre o sistema e o WhatsApp.
Ele não deve ser tratado apenas como uma integração periférica: é um dos canais principais de entrada, saída e automação do produto.

No contexto atual, o OpenClaw pode estar envolvido em:

- Recebimento de mensagens do WhatsApp.
- Envio de respostas automáticas ou assistidas.
- Registro de conversas e requisições.
- Acionamento de comandos, análises e fluxos internos.
- Ponte entre atendimento, CRM, IA e operação da clínica.

Qualquer refatoração futura precisa preservar a compatibilidade com os contratos já usados pelo OpenClaw.

---

## 2. Papel do CRM via WhatsApp

O CRM via WhatsApp é a camada de relacionamento com pacientes, leads, contatos e conversas operacionais.
Ele deve apoiar tanto a rotina da clínica quanto os fluxos pessoais/profissionais do "Segundo Eu".

Principais funções esperadas:

- Capturar e organizar conversas.
- Apoiar acompanhamento de leads e pacientes.
- Registrar histórico de contato.
- Permitir análise posterior das conversas.
- Alimentar alertas, tarefas, briefing e decisões operacionais.
- Servir como canal natural para comandos rápidos do usuário.

O CRM não deve ser reduzido a uma tela de dashboard. O WhatsApp é parte central da experiência.

---

## 3. Papel do Monitor IA

O Monitor IA é a camada que observa eventos, conversas, logs e sinais do sistema.
Sua função é identificar padrões, anomalias, pendências e oportunidades de ação.

Ele pode monitorar:

- Conversas recebidas pelo WhatsApp.
- Falhas ou atrasos de integrações.
- Logs de infraestrutura.
- Serviços ativos ou instáveis.
- Sinais de atendimento, marketing e operação.
- Eventos que devem gerar alerta, tarefa ou briefing.

O Monitor IA deve ser tratado como uma camada de observabilidade inteligente, não como uma simples tela de logs.

---

## 4. Papel do Supervisor IA

O Supervisor IA é a camada de diagnóstico, supervisão e reparo assistido.
Ele deve registrar o que observou, quais hipóteses levantou, quais ações sugeriu e quais problemas precisam de atenção humana.

Principais responsabilidades:

- Acompanhar a saúde do sistema.
- Registrar diagnósticos e tentativas de reparo.
- Apoiar investigação de falhas.
- Sinalizar riscos de integração, dados ou automação.
- Conectar logs técnicos com impacto operacional.
- Proteger produção contra mudanças feitas sem validação.

O Supervisor IA deve preservar rastreabilidade. Logs e diagnósticos não devem ser apagados ou remodelados sem entender o uso atual.

---

## 5. Como isso se conecta ao "Segundo Eu"

O "Segundo Eu" não é apenas um painel pessoal. Ele combina vida pessoal, família, saúde, documentos, finanças, agenda, tarefas, hábitos, memória de IA e operação profissional.

OpenClaw, CRM e Supervisor IA conectam a parte prática do dia a dia:

- WhatsApp como canal principal de interação.
- CRM como memória operacional das conversas.
- Monitor IA como observador contínuo.
- Supervisor IA como camada de diagnóstico e proteção.
- Briefings e alertas como síntese acionável.
- Logs e análises como histórico para decisões futuras.

Essa camada operacional deve coexistir com os módulos pessoais e familiares, sem ser descartada durante a evolução do produto.

---

## 6. Principais tabelas envolvidas

| Tabela | Papel no sistema |
|---|---|
| `wa_chats` | Histórico ou espelho de conversas WhatsApp. Origem exata: A definir. |
| `wa_analyses` | Análises de conversas ou mensagens WhatsApp. Campos e fluxo real: A definir. |
| `wa_connections` | Estado das conexões WhatsApp/OpenClaw. Pode indicar sessões, instâncias ou disponibilidade. |
| `wa_requests` | Registro de requisições relacionadas ao WhatsApp. Útil para diagnóstico e auditoria. |
| `supervisor_logs` | Logs do Supervisor IA, diagnósticos e eventos de supervisão. |
| `infra_logs` | Logs técnicos de infraestrutura, falhas, reparos ou eventos operacionais. |
| `infra_servicos` | Cadastro ou estado de serviços monitorados. Uso real: A definir. |

Essas tabelas devem ser tratadas como críticas até que sua origem, colunas e consumidores estejam totalmente mapeados.

---

## 7. Funcionalidades que já existem

Com base no estado documentado até agora, já existem indícios ou componentes reais para:

- Integração com WhatsApp/OpenClaw.
- Registro de conversas WhatsApp.
- Registro de requisições WhatsApp.
- Análise de conversas.
- Logs de Supervisor IA.
- Logs de infraestrutura.
- Serviços de infraestrutura monitorados.
- Briefing matinal.
- Comandos via WhatsApp/API.
- Integrações externas conectadas ao fluxo operacional.

A profundidade real de cada funcionalidade ainda precisa ser validada por inspeção de colunas, código ativo e fluxos externos.

---

## 8. Pontos que precisam ser preservados

- Compatibilidade com OpenClaw e contratos atuais de WhatsApp.
- Histórico de conversas e análises já capturadas.
- Logs de diagnóstico e reparo.
- Estado de conexões WhatsApp.
- Registros de requisições para auditoria.
- Comportamento atual dos comandos usados por automações externas.
- Dados operacionais da clínica, marketing e infraestrutura.
- Separação entre leitura investigativa e mudanças reais em produção.

Nada dessas áreas deve ser removido, renomeado ou migrado sem validação explícita.

---

## 9. Riscos se refatorar errado

- Quebrar o canal principal de entrada pelo WhatsApp.
- Interromper atendimento, CRM ou automações da clínica.
- Perder histórico de conversas e análises.
- Apagar evidências importantes de diagnóstico.
- Quebrar integrações externas que não aparecem claramente no código do repositório.
- Produzir respostas incorretas da IA por falta de contexto operacional.
- Misturar logs técnicos, dados de CRM e memória pessoal sem fronteiras claras.
- Criar migrations que parecem seguras, mas quebram OpenClaw, n8n, Vercel ou serviços externos.

O maior risco é tratar tabelas `wa_*`, `infra_*` e `supervisor_logs` como lixo legado antes de confirmar quem escreve, quem lê e qual impacto operacional elas têm.

---

## 10. Próxima microtarefa recomendada

Validar, sem alterar banco, as colunas reais e o uso operacional das tabelas:

1. `wa_chats`
2. `wa_analyses`
3. `wa_connections`
4. `wa_requests`
5. `supervisor_logs`
6. `infra_logs`
7. `infra_servicos`

Resultado esperado da próxima microtarefa:

- Criar um inventário de colunas observadas dessas tabelas.
- Identificar quais arquivos do repositório usam cada tabela.
- Marcar integrações externas prováveis como "A definir".
- Separar tabelas críticas, tabelas operacionais e tabelas candidatas a encapsulamento futuro.

Não avançar para remodelagem dessas tabelas antes dessa validação.
