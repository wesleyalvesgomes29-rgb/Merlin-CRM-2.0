import { Rule, RuleContext, RuleResultItem, ScoreModifier } from '../types';

export class StaleLeadsRule implements Rule {
  id = 'stale_leads';
  name = 'Leads Estagnados';
  description = 'Identifica leads ativos que não têm nenhum contato há mais de 15 dias.';

  execute(context: RuleContext) {
    const alerts: RuleResultItem[] = [];
    const scoreModifications: Record<string, ScoreModifier[]> = {};
    
    const today = new Date(context.todayStr + 'T12:00:00');

    const activeClients = context.clients.filter(
      c => c.status !== 'Venda Fechada' && c.status !== 'Perdido'
    );

    activeClients.forEach(client => {
      // Determine the reference date (last contact or creation date)
      const refDateStr = client.lastContactDate || client.createdAt;
      if (!refDateStr) return;

      const refDate = new Date(refDateStr);
      const diffTime = today.getTime() - refDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 15) {
        alerts.push({
          id: `alert_stale_${client.id}`,
          clientId: client.id,
          clientName: client.name,
          title: 'Lead estagnado / sem contato',
          description: `O lead "${client.name}" está sem contato há ${diffDays} dias (último contato em: ${refDate.toLocaleDateString('pt-BR')}).`,
          severity: 'high',
          category: 'stale_lead'
        });

        if (!scoreModifications[client.id]) {
          scoreModifications[client.id] = [];
        }
        scoreModifications[client.id].push({
          points: -20,
          factor: `Estagnado sem contato há ${diffDays} dias`,
          isPositive: false
        });
      } else if (diffDays <= 3) {
        // Active attention within the last 3 days
        if (!scoreModifications[client.id]) {
          scoreModifications[client.id] = [];
        }
        scoreModifications[client.id].push({
          points: 15,
          factor: 'Contato recente realizado (aquecido)',
          isPositive: true
        });
      }
    });

    return { alerts, scoreModifications };
  }
}
