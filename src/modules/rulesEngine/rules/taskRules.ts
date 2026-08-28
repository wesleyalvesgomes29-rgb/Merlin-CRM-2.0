import { Rule, RuleContext, RuleResultItem, ScoreModifier } from '../types';

export class TaskRules implements Rule {
  id = 'task_rules';
  name = 'Análise de Tarefas';
  description = 'Identifica tarefas comerciais atrasadas e tarefas agendadas para o dia de hoje.';

  execute(context: RuleContext) {
    const overdueTasks: RuleResultItem[] = [];
    const todayTasks: RuleResultItem[] = [];
    const scoreModifications: Record<string, ScoreModifier[]> = {};

    const pendingTasks = context.tasks.filter(t => !t.completed);

    pendingTasks.forEach(task => {
      const isOverdue = task.dueDate < context.todayStr;
      const isToday = task.dueDate === context.todayStr;

      const item: RuleResultItem = {
        id: `task_item_${task.id}`,
        clientId: task.clientId,
        clientName: task.clientName,
        title: `${task.actionType} agendado`,
        description: task.notes || `Tarefa de ${task.actionType} pendente.`,
        severity: isOverdue ? 'high' : 'medium',
        category: isOverdue ? 'overdue_task' : 'today_task',
        dueDate: task.dueDate,
        actionType: task.actionType
      };

      if (isOverdue) {
        overdueTasks.push(item);

        // Reduce health score if there is an overdue task for this client
        if (task.clientId) {
          if (!scoreModifications[task.clientId]) {
            scoreModifications[task.clientId] = [];
          }
          scoreModifications[task.clientId].push({
            points: -10,
            factor: `Tarefa atrasada de ${task.actionType}`,
            isPositive: false
          });
        }
      } else if (isToday) {
        todayTasks.push(item);
      }
    });

    return { overdueTasks, todayTasks, scoreModifications };
  }
}
