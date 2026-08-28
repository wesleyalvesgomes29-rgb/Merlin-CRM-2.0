import { Rule, RuleContext, RuleResultItem, ScoreModifier } from '../types';

export class NoNextActionRule implements Rule {
  id = 'no_next_action';
  name = 'Leads Sem Próxima Ação';
  description = 'Identifica leads ativos que não possuem data de retorno ou próxima ação agendada.';

  execute(context: RuleContext) {
    const alerts: RuleResultItem[] = [];
    const scoreModifications: Record<string, ScoreModifier[]> = {};

    const activeClients = context.clients.filter(
      c => c.status !== 'Venda Fechada' && c.status !== 'Perdido'
    );

    activeClients.forEach(client => {
      const hasNextContact = !!client.nextContactDate;
      const clientTasks = context.tasks.filter(t => t.clientId === client.id && !t.completed);
      const hasPendingTask = clientTasks.length > 0;

      if (!hasNextContact && !hasPendingTask) {
        alerts.push({
          id: `alert_no_action_${client.id}`,
          clientId: client.id,
          clientName: client.name,
          title: 'Sem próxima ação planejada',
          description: `O lead "${client.name}" está ativo mas não possui data de retorno e nem tarefas pendentes agendadas.`,
          severity: 'high',
          category: 'no_next_action'
        });

        if (!scoreModifications[client.id]) {
          scoreModifications[client.id] = [];
        }
        scoreModifications[client.id].push({
          points: -15,
          factor: 'Sem ação futura agendada (risco de abandono)',
          isPositive: false
        });
      } else if (hasNextContact) {
        // Positive point for having action planned
        if (!scoreModifications[client.id]) {
          scoreModifications[client.id] = [];
        }
        scoreModifications[client.id].push({
          points: 10,
          factor: 'Próximo contato devidamente agendado',
          isPositive: true
        });
      }
    });

    return { alerts, scoreModifications };
  }
}
