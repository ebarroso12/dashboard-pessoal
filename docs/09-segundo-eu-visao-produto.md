# Segundo Eu - Visao de Produto

## 1. Visao do produto
O **Segundo Eu** e a evolucao incremental do `dashboard-pessoal`: um sistema pessoal, familiar e profissional que funciona como uma camada de memoria, organizacao e acao para o Dr. Edson.

A proposta e transformar o painel atual em um assistente operacional continuo, com dois canais principais:

- **WhatsApp**, para captura rapida, comandos, lembretes, documentos, exames, fotos e interacoes do dia a dia.
- **Painel no navegador**, para visao consolidada, revisao, configuracao, historico, arquivos, tarefas, saude, agenda, financas e acompanhamento familiar/profissional.

O produto deve crescer sem quebrar a producao atual. A primeira fase e organizar a visao, os dominios e a ordem de implementacao antes de alterar codigo, banco ou integracoes sensiveis.

## 2. Escopo pessoal
O escopo pessoal cobre tudo que ajuda o usuario a lembrar, decidir, acompanhar e agir na propria vida.

Inclui:

- Perfil fixo do usuario: identidade, preferencias, rotina, prioridades, estilo de comunicacao e objetivos.
- Memoria crescente da IA: fatos importantes, decisoes, historico de conversas, padroes, pendencias e contexto recorrente.
- Saude pessoal: exames, consultas, medicamentos, habitos, sintomas, metas de bem-estar e historico relevante.
- Documentos pessoais: RG, CPF, CNH, comprovantes, contratos, receitas, laudos, arquivos medicos e documentos recorrentes.
- Agenda pessoal: compromissos, lembretes, eventos importantes e preparacao para o dia.
- Tarefas e projetos pessoais: pendencias, listas, prioridades, prazos e acompanhamento de progresso.
- Habitos: sono, atividade fisica, estudo, espiritualidade, alimentacao, rotinas e checkpoints.
- Financas pessoais: receitas, despesas, contas, metas, alertas e visao mensal.

## 3. Escopo familiar
O escopo familiar organiza informacoes e responsabilidades relacionadas a esposa, filhos e casa, respeitando privacidade e permissoes futuras.

Inclui:

- Perfis familiares: esposa, filhos e outros dependentes relevantes.
- Saude familiar: exames, consultas, vacinas, medicamentos, laudos e alertas.
- Documentos da familia: documentos pessoais, escolares, medicos, seguros, autorizacoes e comprovantes.
- Agenda familiar: escola, consultas, atividades, viagens, aniversarios, compromissos e lembretes compartilhados.
- Tarefas domesticas e familiares: compras, manutencao, pagamentos, responsabilidades e combinados.
- Memorias familiares: fatos importantes, preferencias, historico de eventos e registros uteis para decisoes futuras.
- Financas familiares: contas da casa, despesas recorrentes, planejamento e alertas.

## 4. Escopo profissional
O escopo profissional mantem o suporte ao consultorio, marketing, produtividade e operacao ja presentes no dashboard atual, com organizacao mais clara.

Inclui:

- Agenda profissional: consultas, reunioes, compromissos estrategicos e preparacao diaria.
- Tarefas profissionais: administrativas, clinicas, marketing, conteudo, gestao e follow-ups.
- Documentos profissionais: contratos, documentos do consultorio, materiais de marketing, relatorios e arquivos operacionais.
- Indicadores do consultorio: metas, financas, alertas, canais digitais e acompanhamento de performance.
- IA de apoio profissional: analise de produtividade, resumo do dia, preparacao de reunioes, ideias de conteudo e leitura de contexto.
- Integracoes atuais: Google Calendar, Gmail, Drive, WhatsApp/OpenClaw, Supabase e painel web.

## 5. Canais de uso
### WhatsApp
Canal principal para entrada rapida e interacao natural.

Usos previstos:

- Enviar comandos em linguagem natural.
- Registrar tarefas, lembretes, ideias e notas rapidas.
- Enviar documentos, fotos, exames e comprovantes.
- Receber alertas, resumos, confirmacoes e perguntas da IA.
- Consultar agenda, tarefas, documentos, dados familiares e informacoes profissionais.

### Painel no navegador
Canal principal para revisao, organizacao e gestao.

Usos previstos:

- Visualizar dashboard consolidado.
- Revisar itens capturados pelo WhatsApp.
- Fazer upload manual de documentos e exames.
- Editar perfis, categorias, entidades e memorias.
- Acompanhar financas, saude, habitos, tarefas e agenda.
- Configurar integracoes e preferencias da IA.

### Upload no painel
Canal complementar para entrada estruturada de arquivos.

Usos previstos:

- Subir PDFs, imagens, exames, documentos e comprovantes.
- Classificar arquivos por pessoa, area e tipo.
- Associar documentos a eventos, tarefas, consultas ou memorias.

## 6. Entidades principais
As entidades abaixo definem o vocabulario de produto. Elas ainda nao implicam alteracao imediata no banco.

- **Pessoa**: usuario, esposa, filho ou familiar relacionado.
- **Perfil fixo**: dados estaveis que orientam a IA sobre identidade, preferencias, contexto e limites.
- **Memoria**: informacao persistente aprendida ou registrada ao longo do uso.
- **Documento**: arquivo ou registro textual associado a uma pessoa, area, data e categoria.
- **Exame**: documento de saude com data, pessoa, tipo, resultado e observacoes.
- **Evento de agenda**: compromisso pessoal, familiar ou profissional.
- **Tarefa**: acao pendente com prioridade, prazo, area e responsavel.
- **Habito**: rotina recorrente acompanhada por frequencia e historico.
- **Lancamento financeiro**: receita, despesa, conta, pagamento ou movimentacao.
- **Alerta**: aviso gerado por regra, prazo, risco ou oportunidade.
- **Conversa**: interacao com a IA ou canal de mensagem.
- **Comando**: intencao recebida por WhatsApp, painel ou API.
- **Anexo**: arquivo recebido por WhatsApp ou upload.
- **Subprojeto**: frente incremental de evolucao do sistema.

## 7. Subprojetos SP-1 a SP-10
### SP-1 - Fundacao de produto e documentacao
Organizar visao, escopo, entidades, ordem de implementacao, riscos e limites. Esta documentacao e a primeira entrega.

### SP-2 - Inventario tecnico do dashboard atual
Mapear arquivos, rotas, integracoes, variaveis de ambiente, dependencias, dados esperados e pontos frageis sem alterar comportamento.

### SP-3 - Organizacao incremental do frontend atual
Separar o `dashboard.html` em blocos mais manejaveis quando for seguro, preservando deploy estatico e funcionamento atual.

### SP-4 - Organizacao incremental das APIs
Agrupar helpers, reduzir duplicacao, padronizar CORS, erros, autenticacao por token e contratos das funcoes Vercel sem mudar URLs publicas.

### SP-5 - WhatsApp como entrada principal
Evoluir comandos, recebimento de anexos, confirmacao de registros, respostas resumidas e roteamento para tarefas, documentos, agenda e memoria.

### SP-6 - Documentos e exames
Criar fluxo de captura, classificacao, revisao e busca de documentos enviados pelo WhatsApp ou painel.

### SP-7 - Perfil fixo e memoria da IA
Definir como a IA le perfil, grava memorias, consulta historico e diferencia fatos permanentes de informacoes temporarias.

### SP-8 - Vida familiar
Adicionar perfis familiares, documentos, saude, agenda, tarefas e lembretes vinculados a esposa, filhos e casa.

### SP-9 - Financas, habitos e rotinas
Consolidar contas, metas, habitos, checkpoints, alertas e resumos recorrentes pessoais/familiares/profissionais.

### SP-10 - Profissional e automacoes avancadas
Refinar consultorio, marketing, relatorios, briefing diario, automacoes, alertas proativos e integracoes externas.

## 8. Ordem de implementacao
1. **SP-1 - Fundacao de produto e documentacao**: alinhar visao e escopo sem mexer em producao.
2. **SP-2 - Inventario tecnico do dashboard atual**: documentar estado real antes de refatorar.
3. **SP-4 - Organizacao incremental das APIs**: reduzir risco nos pontos que recebem dados e integram servicos.
4. **SP-5 - WhatsApp como entrada principal**: fortalecer o canal mais importante do produto.
5. **SP-6 - Documentos e exames**: permitir entrada e organizacao de arquivos essenciais.
6. **SP-7 - Perfil fixo e memoria da IA**: dar continuidade e personalizacao real ao assistente.
7. **SP-3 - Organizacao incremental do frontend atual**: melhorar manutencao do painel sem migracao para framework.
8. **SP-8 - Vida familiar**: expandir o modelo para esposa, filhos e casa.
9. **SP-9 - Financas, habitos e rotinas**: consolidar acompanhamento recorrente.
10. **SP-10 - Profissional e automacoes avancadas**: otimizar consultorio, marketing e automacoes depois da base estar estavel.

## 9. Riscos tecnicos
- **HTML monolitico**: o `dashboard.html` concentra UI, estilos e logica, dificultando manutencao e testes.
- **Duplicacao entre APIs**: fluxos de Google, Supabase, tokens, CORS e erros aparecem em multiplos endpoints.
- **Segredos e tokens**: qualquer token hardcoded ou fallback inseguro aumenta risco de exposicao e acesso indevido.
- **Banco sem contrato documentado**: tabelas e campos usados pelo codigo precisam ser inventariados antes de mudancas.
- **Permissoes e privacidade familiar**: dados de esposa, filhos, saude e documentos exigem separacao clara de acesso e auditoria futura.
- **Entrada de anexos por WhatsApp**: arquivos podem vir sem tipo confiavel, com baixa qualidade, duplicados ou com dados sensiveis.
- **Memoria da IA**: gravar tudo sem curadoria pode gerar ruido, erro persistente e exposicao de dados sensiveis.
- **Compatibilidade de producao**: mudancas em rotas, variaveis ou estrutura podem quebrar Vercel, WhatsApp, Google OAuth ou painel atual.
- **Observabilidade limitada**: sem logs e status consistentes, falhas em automacoes e integracoes ficam dificeis de diagnosticar.
- **Crescimento de escopo**: o produto cobre muitas areas da vida; sem subprojetos pequenos, a evolucao pode ficar caotica.

## 10. O que nao sera feito agora
Nesta etapa nao sera feito:

- Migracao para Next.js.
- Reescrita do sistema do zero.
- Alteracao de codigo do painel ou das APIs.
- Alteracao de banco, tabelas, politicas RLS, migrations ou dados existentes.
- Mudanca em variaveis de ambiente, tokens ou secrets.
- Mudanca nas rotas publicas ja usadas em producao.
- Deploy novo ou alteracao de configuracao da Vercel.
- Implementacao de upload, OCR, leitura de exames ou processamento de anexos.
- Implementacao de memoria da IA.
- Alteracao nas integracoes com Google, WhatsApp/OpenClaw, Supabase ou qualquer servico externo.

O foco desta entrega e documentar a direcao do produto e criar uma base segura para as proximas refatoracoes incrementais.
