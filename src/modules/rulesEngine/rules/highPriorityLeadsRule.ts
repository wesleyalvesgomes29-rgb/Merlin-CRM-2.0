import { Rule, RuleContext, RuleResultItem, ScoreModifier } from '../types';

export class HighPriorityLeadsRule implements Rule {
  id = 'high_priority_leads';
  name = 'Leads de Alta Prioridade';
  description = 'Identifica leads que merecem atenção imediata por estarem em fases decisivas do funil ou com tags de urgência.';

  execute(context: RuleContext) {
    const priorities: RuleResultItem[] = [];
    const scoreModifications: Record<string, ScoreModifier[]> = {};

    const activeClients = context.clients.filter(
      c => c.status !== 'Venda Fechada' && c.status !== 'Perdido'
    );

    activeClients.forEach(client => {
      let isHighPriority = false;
      const reasons: string[] = [];

      // Check if in an advanced stage
      if (client.status === 'Proposta') {
        isHighPriority = true;
        reasons.push('Fase de Proposta em andamento');
      } else if (client.status === 'Documentação') {
        isHighPriority = true;
        reasons.push('Fase de Documentação ativa');
      } else if (client.status === 'Visitou') {
        isHighPriority = true;
        reasons.push('Visita concluída com sucesso');
      }

      // Check tags for urgency
      const tagsLower = (client.tags || []).map(t => t.toLowerCase());
      if (tagsLower.includes('urgente') || tagsLower.includes('alta prioridade') || tagsLower.includes('investidor')) {
        isHighPriority = true;
        reasons.push('Etiquetado como prioridade/urgente');
      }

      // Check for high contact count (highly engaged lead)
      if (client.contactCount >= 8) {
        isHighPriority = true;
        reasons.push('Lead altamente engajado (frequência alta de contatos)');
      }

      if (isHighPriority) {
        priorities.push({
          id: `priority_high_${client.id}`,
          clientId: client.id,
          clientName: client.name,
          title: 'Lead de Alta Prioridade',
          description: `O lead "${client.name}" é prioridade: ${reasons.join(', ')}.`,
          severity: 'high',
          category: 'high_priority'
        });

        if (!scoreModifications[client.id]) {
          scoreModifications[client.id] = [];
        }
        scoreModifications[client.id].push({
          points: 20,
          factor: `Alta prioridade: ${reasons[0]}`,
          isPositive: true
        });
      }
    });

    return { priorities, scoreModifications };
  }
}
