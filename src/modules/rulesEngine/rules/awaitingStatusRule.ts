import { Rule, RuleContext, RuleResultItem, ScoreModifier } from '../types';

export class AwaitingStatusRule implements Rule {
  id = 'awaiting_status';
  name = 'Contatos Aguardando Ação de Pipeline';
  description = 'Identifica leads que estão em etapas específicas do funil e que necessitam de ações correspondentes (proposta, documentos, visitas).';

  execute(context: RuleContext) {
    const opportunities: RuleResultItem[] = [];
    const alerts: RuleResultItem[] = [];
    const scoreModifications: Record<string, ScoreModifier[]> = {};

    const activeClients = context.clients.filter(
      c => c.status !== 'Venda Fechada' && c.status !== 'Perdido'
    );

    activeClients.forEach(client => {
      if (client.status === 'Proposta') {
        opportunities.push({
          id: `awaiting_prop_${client.id}`,
          clientId: client.id,
          clientName: client.name,
          title: 'Aguardando envio/retorno de Proposta',
          description: `O lead "${client.name}" está na etapa de Proposta. Certifique-se de formalizar e acompanhar os valores e condições de fechamento.`,
          severity: 'medium',
          category: 'waiting_proposal'
        });

        if (!scoreModifications[client.id]) {
          scoreModifications[client.id] = [];
        }
        scoreModifications[client.id].push({
          points: 10,
          factor: 'Fase de Proposta (oportunidade quente)',
          isPositive: true
        });
      }

      if (client.status === 'Documentação') {
        alerts.push({
          id: `awaiting_doc_${client.id}`,
          clientId: client.id,
          clientName: client.name,
          title: 'Documentação pendente',
          description: `O lead "${client.name}" está aguardando análise ou envio de documentos para prosseguir com o fechamento.`,
          severity: 'medium',
          category: 'waiting_documentation'
        });

        if (!scoreModifications[client.id]) {
          scoreModifications[client.id] = [];
        }
        scoreModifications[client.id].push({
          points: 5,
          factor: 'Fase de Análise de Documentação',
          isPositive: true
        });
      }

      if (client.status === 'Visitou') {
        opportunities.push({
          id: `awaiting_visit_fb_${client.id}`,
          clientId: client.id,
          clientName: client.name,
          title: 'Acompanhamento pós-visita',
          description: `O lead "${client.name}" visitou o imóvel. Agende uma ligação ou envie mensagem para colher o feedback sobre a visita.`,
          severity: 'medium',
          category: 'waiting_visit_feedback'
        });

        if (!scoreModifications[client.id]) {
          scoreModifications[client.id] = [];
        }
        scoreModifications[client.id].push({
          points: 10,
          factor: 'Visita concluída com sucesso',
          isPositive: true
        });
      }

      if (client.status === 'Agendado') {
        opportunities.push({
          id: `awaiting_visit_${client.id}`,
          clientId: client.id,
          clientName: client.name,
          title: 'Visita/Reunião agendada',
          description: `O lead "${client.name}" possui uma reunião ou visita agendada. Garanta que todo o material de apresentação esteja pronto.`,
          severity: 'medium',
          category: 'waiting_visit'
        });
      }

      if (client.status === 'Contato') {
        opportunities.push({
          id: `awaiting_feedback_${client.id}`,
          clientId: client.id,
          clientName: client.name,
          title: 'Aguardando retorno do contato inicial',
          description: `O lead "${client.name}" está em contato inicial. Mantenha o follow-up ativo para avançá-lo no funil.`,
          severity: 'low',
          category: 'waiting_feedback'
        });
      }
    });

    return { opportunities, alerts, scoreModifications };
  }
}
