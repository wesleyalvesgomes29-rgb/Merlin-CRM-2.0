import { Client, Task, Sale } from '../../types';

export interface RuleResultItem {
  id: string;
  clientId?: string;
  clientName?: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  dueDate?: string;
  actionType?: string;
}

export interface LeadScore {
  clientId: string;
  clientName: string;
  score: number; // Scale of 0 - 100
  status: 'excellent' | 'good' | 'fair' | 'poor';
  positiveFactors: string[];
  negativeFactors: string[];
}

export interface RuleContext {
  clients: Client[];
  tasks: Task[];
  sales: Sale[];
  todayStr: string; // Current date as YYYY-MM-DD
}

export interface ScoreModifier {
  points: number;
  factor: string;
  isPositive: boolean;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  execute(context: RuleContext): {
    alerts?: RuleResultItem[];
    priorities?: RuleResultItem[];
    opportunities?: RuleResultItem[];
    overdueTasks?: RuleResultItem[];
    todayTasks?: RuleResultItem[];
    scoreModifications?: Record<string, ScoreModifier[]>;
  };
}

export interface EngineResult {
  alerts: RuleResultItem[];
  priorities: RuleResultItem[];
  opportunities: RuleResultItem[];
  overdueTasks: RuleResultItem[];
  todayTasks: RuleResultItem[];
  scores: Record<string, LeadScore>;
}
