import { Client, Task, Sale } from '../../types';
import { EngineResult, Rule, RuleContext, RuleResultItem, LeadScore, ScoreModifier } from './types';
import { NoNextActionRule } from './rules/noNextActionRule';
import { StaleLeadsRule } from './rules/staleLeadsRule';
import { HighPriorityLeadsRule } from './rules/highPriorityLeadsRule';
import { AwaitingStatusRule } from './rules/awaitingStatusRule';
import { TaskRules } from './rules/taskRules';

export class MerlinRulesEngine {
  private rules: Rule[] = [];

  constructor() {
    // Register default modular rules
    this.registerRule(new NoNextActionRule());
    this.registerRule(new StaleLeadsRule());
    this.registerRule(new HighPriorityLeadsRule());
    this.registerRule(new AwaitingStatusRule());
    this.registerRule(new TaskRules());
  }

  /**
   * Registers a new rule to the engine, allowing easy future extensions
   */
  public registerRule(rule: Rule): void {
    if (!this.rules.some(r => r.id === rule.id)) {
      this.rules.push(rule);
    }
  }

  /**
   * Executes the rules engine on the given database of clients, tasks, and sales
   */
  public execute(clients: Client[], tasks: Task[], sales: Sale[]): EngineResult {
    // Determine current date in YYYY-MM-DD
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const context: RuleContext = { clients, tasks, sales, todayStr };

    const alerts: RuleResultItem[] = [];
    const priorities: RuleResultItem[] = [];
    const opportunities: RuleResultItem[] = [];
    const overdueTasks: RuleResultItem[] = [];
    const todayTasks: RuleResultItem[] = [];

    // Map to collect score modifications by clientId
    const allScoreModifications: Record<string, ScoreModifier[]> = {};

    // Execute all registered rules
    this.rules.forEach(rule => {
      try {
        const result = rule.execute(context);
        
        if (result.alerts) alerts.push(...result.alerts);
        if (result.priorities) priorities.push(...result.priorities);
        if (result.opportunities) opportunities.push(...result.opportunities);
        if (result.overdueTasks) overdueTasks.push(...result.overdueTasks);
        if (result.todayTasks) todayTasks.push(...result.todayTasks);

        if (result.scoreModifications) {
          Object.entries(result.scoreModifications).forEach(([clientId, modifiers]) => {
            if (!allScoreModifications[clientId]) {
              allScoreModifications[clientId] = [];
            }
            allScoreModifications[clientId].push(...modifiers);
          });
        }
      } catch (error) {
        console.error(`[RulesEngine] Error running rule ${rule.id}:`, error);
      }
    });

    // Calculate Lead/Health Scores for all clients
    const scores: Record<string, LeadScore> = {};

    clients.forEach(client => {
      let score = 70; // Base score
      const positiveFactors: string[] = [];
      const negativeFactors: string[] = [];

      // Check client-specific modifications
      const modifiers = allScoreModifications[client.id] || [];
      modifiers.forEach(mod => {
        score += mod.points;
        if (mod.isPositive) {
          positiveFactors.push(mod.factor);
        } else {
          negativeFactors.push(mod.factor);
        }
      });

      // Clamp score between 0 and 100
      score = Math.max(0, Math.min(100, score));

      // Determine score health status
      let status: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
      if (score >= 85) {
        status = 'excellent';
      } else if (score >= 65) {
        status = 'good';
      } else if (score >= 40) {
        status = 'fair';
      } else {
        status = 'poor';
      }

      scores[client.id] = {
        clientId: client.id,
        clientName: client.name,
        score,
        status,
        positiveFactors,
        negativeFactors
      };
    });

    return {
      alerts,
      priorities,
      opportunities,
      overdueTasks,
      todayTasks,
      scores
    };
  }
}
