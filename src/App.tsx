import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientStatus, Tag, Sale, Task } from './types';
import { 
  getStoredClients, 
  saveStoredClients, 
  getStoredTags, 
  saveStoredTags, 
  getStoredSales, 
  saveStoredSales, 
  getStoredTheme, 
  saveStoredTheme,
  getClientAlerts,
  isToday,
  getStoredTasks,
  saveStoredTasks,
  addBrokerMemoryEntry
} from './lib/storage';
import { MerlinRulesEngine } from './modules/rulesEngine/engine';
import { 
  Sparkles, 
  Calendar, 
  LayoutDashboard, 
  Trello, 
  Users, 
  DollarSign, 
  Sun, 
  Moon, 
  Plus,
  Compass,
  AlertTriangle,
  UserPlus,
  CheckSquare,
  MoreHorizontal,
  Bot,
  X,
  ChevronRight
} from 'lucide-react';
import MyDay from './components/MyDay';
import Dashboard from './components/Dashboard';
import Kanban from './components/Kanban';
import ClientDirectory from './components/ClientDirectory';
import ClientDetails from './components/ClientDetails';
import Commissions from './components/Commissions';
import AddClientModal from './components/AddClientModal';
import MyRoutine from './components/MyRoutine';
import { motion, AnimatePresence } from 'motion/react';
import MerlinChat from './components/MerlinChat';
import { UserMenu } from './modules/auth';

export default function App() {
  // Global States
  const [clients, setClients] = useState<Client[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>('meu_dia');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);

  // Filter overrides for navigation shortcuts
  const [clientSpecialFilter, setClientSpecialFilter] = useState<'all' | 'high_priority' | 'no_next_contact'>('all');
  const [routineTodayOnly, setRoutineTodayOnly] = useState<boolean>(false);

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    setIsMobileMoreOpen(false);
    if (tabName !== 'clientes') {
      setClientSpecialFilter('all');
    }
    if (tabName !== 'rotina') {
      setRoutineTodayOnly(false);
    }
  };

  const handleNavigateToClientsWithFilter = (filterType: 'high_priority' | 'no_next_contact') => {
    setClientSpecialFilter(filterType);
    setActiveTab('clientes');
  };

  const handleNavigateToTasksWithFilter = (todayOnly: boolean) => {
    setRoutineTodayOnly(todayOnly);
    setActiveTab('rotina');
  };

  // Merlin Rules Engine Instance & Execution
  const rulesEngine = useMemo(() => new MerlinRulesEngine(), []);
  const engineResult = useMemo(() => {
    const result = rulesEngine.execute(clients, tasks, sales);
    console.log('[Merlin Rules Engine] Continuous background analysis executed:', result);
    return result;
  }, [rulesEngine, clients, tasks, sales]);

  // Modal / Detail States
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [initialStatusForAdd, setInitialStatusForAdd] = useState<ClientStatus>('Lead Novo');

  // Initialize data on component mount
  useEffect(() => {
    const loadedClients = getStoredClients();
    const loadedTags = getStoredTags();
    const loadedSales = getStoredSales();
    const loadedTasks = getStoredTasks();
    const loadedTheme = getStoredTheme();

    setClients(loadedClients);
    setTags(loadedTags);
    setSales(loadedSales);
    setTasks(loadedTasks);
    setTheme(loadedTheme);

    // Apply class to HTML tag for dark mode
    if (loadedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Theme Toggle Handler
  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    saveStoredTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // CLIENT CRUD HANDLERS
  const handleAddClient = (clientData: {
    name: string;
    phone: string;
    notes: string;
    status: ClientStatus;
    tags: string[];
    email?: string;
    empreendimento?: string;
    origem?: string;
  }) => {
    const newClient: Client = {
      id: 'c_' + Math.random().toString(36).substr(2, 9),
      name: clientData.name,
      phone: clientData.phone,
      createdAt: new Date().toISOString(),
      notes: clientData.notes,
      status: clientData.status,
      tags: clientData.tags,
      nextContactDate: null,
      contactCount: 0,
      lastContactDate: null,
      email: clientData.email,
      empreendimento: clientData.empreendimento,
      origem: clientData.origem,
      history: [
        {
          id: 'h_init_' + Math.random().toString(),
          date: new Date().toISOString(),
          action: `Cliente cadastrado na etapa "${clientData.status}"`
        }
      ],
      comments: []
    };

    const updatedClients = [newClient, ...clients];
    setClients(updatedClients);
    saveStoredClients(updatedClients);
    addBrokerMemoryEntry('client_created', `Cadastrou o lead "${newClient.name}" para o empreendimento "${newClient.empreendimento || 'Nenhum'}"`, newClient.id, newClient.name);
    setIsAddingClient(false);
  };

  const handleUpdateClient = (updatedClient: Client) => {
    const previous = clients.find(c => c.id === updatedClient.id);
    if (previous) {
      if (updatedClient.comments.length > previous.comments.length) {
        const newComment = updatedClient.comments[0];
        if (newComment) {
          addBrokerMemoryEntry('comment_added', `Adicionou observação: "${newComment.text}"`, updatedClient.id, updatedClient.name);
        }
      }
      if (updatedClient.contactCount > previous.contactCount) {
        addBrokerMemoryEntry('contact_registered', `Registrou atendimento ao cliente (Total: ${updatedClient.contactCount} contatos)`, updatedClient.id, updatedClient.name);
      }
      if (updatedClient.status !== previous.status) {
        addBrokerMemoryEntry('status_changed', `Moveu o cliente de "${previous.status}" para "${updatedClient.status}"`, updatedClient.id, updatedClient.name);
      }
    }
    const updated = clients.map(c => c.id === updatedClient.id ? updatedClient : c);
    setClients(updated);
    saveStoredClients(updated);
  };

  const handleDeleteClient = (clientId: string) => {
    const updated = clients.filter(c => c.id !== clientId);
    setClients(updated);
    saveStoredClients(updated);
    if (selectedClientId === clientId) {
      setSelectedClientId(null);
    }
  };

  const handleUpdateClientStatus = (clientId: string, newStatus: ClientStatus) => {
    const target = clients.find(c => c.id === clientId);
    if (!target) return;

    const oldStatus = target.status;
    if (oldStatus === newStatus) return;

    const updatedClient: Client = {
      ...target,
      status: newStatus,
      history: [
        {
          id: 'h_status_' + Math.random().toString(),
          date: new Date().toISOString(),
          action: `Etapa do funil alterada de "${oldStatus}" para "${newStatus}"`
        },
        ...target.history
      ]
    };

    handleUpdateClient(updatedClient);
  };

  const handleQuickContact = (clientId: string) => {
    const target = clients.find(c => c.id === clientId);
    if (!target) return;

    const newCount = target.contactCount + 1;
    const updatedClient: Client = {
      ...target,
      contactCount: newCount,
      lastContactDate: new Date().toISOString(),
      history: [
        {
          id: 'h_contact_' + Math.random().toString(),
          date: new Date().toISOString(),
          action: `Contato rápido registrado por telefone/whats (Total de toques: ${newCount})`
        },
        ...target.history
      ]
    };

    handleUpdateClient(updatedClient);
  };

  const handleQuickReschedule = (clientId: string, dateStr: string) => {
    const target = clients.find(c => c.id === clientId);
    if (!target) return;

    const updatedClient: Client = {
      ...target,
      nextContactDate: dateStr,
      history: [
        {
          id: 'h_resched_' + Math.random().toString(),
          date: new Date().toISOString(),
          action: `Reagendamento rápido realizado para o dia ${new Date(dateStr).toLocaleString('pt-BR')}`
        },
        ...target.history
      ]
    };

    handleUpdateClient(updatedClient);
  };

  // EXCEL IMPORT CLIENTS HANDLER
  const handleImportClients = (importedList: {
    name: string;
    phone: string;
    email?: string;
    empreendimento?: string;
    origem?: string;
    status: ClientStatus;
    notes: string;
  }[]) => {
    const newClients: Client[] = importedList.map(item => ({
      id: 'c_' + Math.random().toString(36).substr(2, 9),
      name: item.name,
      phone: item.phone,
      createdAt: new Date().toISOString(),
      notes: item.notes,
      status: item.status,
      tags: [],
      nextContactDate: null,
      contactCount: 0,
      lastContactDate: null,
      email: item.email,
      empreendimento: item.empreendimento,
      origem: item.origem,
      history: [
        {
          id: 'h_init_' + Math.random().toString(),
          date: new Date().toISOString(),
          action: `Cliente importado via planilha Excel na etapa "${item.status}"`
        }
      ],
      comments: []
    }));

    const updated = [...newClients, ...clients];
    setClients(updated);
    saveStoredClients(updated);
  };

  // TAG CREATION HANDLER
  const handleCreateTag = (name: string, color: string) => {
    const newTag: Tag = {
      id: 'tag_' + Math.random().toString(36).substr(2, 9),
      name,
      color
    };
    const updated = [...tags, newTag];
    setTags(updated);
    saveStoredTags(updated);
  };

  // SALE CRUD HANDLERS
  const handleAddSale = (saleData: Omit<Sale, 'id'>) => {
    const newSale: Sale = {
      id: 'sale_' + Math.random().toString(36).substr(2, 9),
      ...saleData
    };

    // If linked to a client, update client status to Venda Fechada automatically
    if (saleData.clientId) {
      handleUpdateClientStatus(saleData.clientId, 'Venda Fechada');
    }

    const updated = [newSale, ...sales];
    setSales(updated);
    saveStoredSales(updated);
    addBrokerMemoryEntry('sale_added', `Venda Realizada! Comissão de R$ ${saleData.commissionValue.toLocaleString('pt-BR')} gerada com o cliente "${saleData.clientName}"`, saleData.clientId, saleData.clientName);
  };

  const handleDeleteSale = (saleId: string) => {
    const updated = sales.filter(s => s.id !== saleId);
    setSales(updated);
    saveStoredSales(updated);
  };

  // TASK CRUD HANDLERS
  const handleAddTask = (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const newTask: Task = {
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      ...taskData
    };
    const updated = [newTask, ...tasks];
    setTasks(updated);
    saveStoredTasks(updated);
  };

  const handleToggleTaskComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const nextCompleted = !task.completed;
      if (nextCompleted) {
        addBrokerMemoryEntry('task_completed', `Concluiu a tarefa de "${task.actionType}" - "${task.notes || 'Sem observações adicionais.'}"`, task.clientId, task.clientName);
      }
    }
    const updated = tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setClients(prevClients => {
      // In case we want to trigger a client history update on task complete as well:
      if (task?.clientId) {
        return prevClients.map(c => {
          if (c.id === task.clientId) {
            return {
              ...c,
              history: [
                {
                  id: Math.random().toString(),
                  date: new Date().toISOString(),
                  action: `Tarefa concluída: "${task.actionType}"`
                },
                ...c.history
              ]
            };
          }
          return c;
        });
      }
      return prevClients;
    });
    setTasks(updated);
    saveStoredTasks(updated);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    saveStoredTasks(updated);
  };

  // Calculate current alerts count for active notification badges
  const todayAlertsCount = clients.filter(c => {
    const alerts = getClientAlerts(c);
    return (isToday(c.nextContactDate) || alerts.isAtrasado) && c.status !== 'Venda Fechada' && c.status !== 'Perdido';
  }).length;

  const todayStr = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const pendingTasksCount = tasks.filter(t => !t.completed && t.dueDate <= todayStr).length;

  // Selected client helper object
  const activeClientObj = clients.find(c => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col md:flex-row">
      
      {/* 1. SIDEBAR (DESKTOP VIEW) */}
      <aside className="hidden md:flex w-64 bg-[#111111] border-r border-[#303030] flex-col h-screen sticky top-0 p-4 text-white justify-between z-30 shadow-xs">
        <div className="space-y-5">
          {/* Logo Brand Header */}
          <div className="flex items-center justify-between px-2 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#FF9800] via-[#FF7A00] to-[#E85D00] text-[#0B0B0B] shadow-md shadow-orange-500/25">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight font-display text-white flex items-center gap-1.5">
                  Merlin CRM
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] animate-pulse"></span>
                  <span className="text-[10px] text-[#FF7A00] font-bold uppercase tracking-wider">Copiloto IA Ativo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Quick CTA */}
          <button
            onClick={() => setIsAddingClient(true)}
            className="w-full bg-[#FF7A00] hover:bg-[#FF9800] text-[#0B0B0B] font-bold py-2.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-2 text-xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Novo Cliente</span>
          </button>

          {/* Categorized Navigation Hierarchy */}
          <nav className="space-y-4 text-xs">
            {/* 1. Cockpit */}
            <div className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold tracking-wider text-[#888888] uppercase">
                Cockpit
              </p>
              <button
                onClick={() => handleTabChange('meu_dia')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === 'meu_dia'
                    ? 'bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 shadow-xs'
                    : 'text-[#BDBDBD] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className={`h-4 w-4 ${activeTab === 'meu_dia' ? 'text-[#FF7A00]' : 'text-[#888888]'}`} />
                  <span className="text-xs">Meu Dia</span>
                </div>
                {todayAlertsCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                    {todayAlertsCount}
                  </span>
                )}
              </button>
            </div>

            {/* 2. Comercial */}
            <div className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold tracking-wider text-[#888888] uppercase">
                Comercial
              </p>
              <button
                onClick={() => handleTabChange('clientes')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === 'clientes'
                    ? 'bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 shadow-xs'
                    : 'text-[#BDBDBD] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className={`h-4 w-4 ${activeTab === 'clientes' ? 'text-[#FF7A00]' : 'text-[#888888]'}`} />
                  <span className="text-xs">Clientes</span>
                </div>
                <span className="text-[10px] font-mono text-[#888888] font-semibold">
                  {clients.length}
                </span>
              </button>

              <button
                onClick={() => handleTabChange('rotina')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === 'rotina'
                    ? 'bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 shadow-xs'
                    : 'text-[#BDBDBD] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className={`h-4 w-4 ${activeTab === 'rotina' ? 'text-[#FF7A00]' : 'text-[#888888]'}`} />
                  <span className="text-xs">Minha Rotina</span>
                </div>
                {pendingTasksCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
                    {pendingTasksCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleTabChange('funil')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === 'funil'
                    ? 'bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 shadow-xs'
                    : 'text-[#BDBDBD] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <Trello className={`h-4 w-4 ${activeTab === 'funil' ? 'text-[#FF7A00]' : 'text-[#888888]'}`} />
                <span className="text-xs">Funil de Vendas</span>
              </button>
            </div>

            {/* 3. Inteligência Comercial */}
            <div className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold tracking-wider text-[#888888] uppercase">
                Inteligência
              </p>
              <button
                onClick={() => handleTabChange('intelligence')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === 'intelligence'
                    ? 'bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/35 shadow-xs'
                    : 'text-[#BDBDBD] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bot className={`h-4 w-4 ${activeTab === 'intelligence' ? 'text-[#FF7A00]' : 'text-[#FF7A00]'}`} />
                  <span className="text-xs">Merlin AI</span>
                </div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/25">
                  Copiloto
                </span>
              </button>
            </div>

            {/* 4. Gestão e Resultados */}
            <div className="space-y-1">
              <p className="px-2.5 text-[10px] font-bold tracking-wider text-[#888888] uppercase">
                Gestão
              </p>
              <button
                onClick={() => handleTabChange('comissoes')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === 'comissoes'
                    ? 'bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 shadow-xs'
                    : 'text-[#BDBDBD] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <DollarSign className={`h-4 w-4 ${activeTab === 'comissoes' ? 'text-[#FF7A00]' : 'text-[#888888]'}`} />
                <span className="text-xs">Comissões</span>
              </button>

              <button
                onClick={() => handleTabChange('dashboard')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 shadow-xs'
                    : 'text-[#BDBDBD] hover:text-white hover:bg-[#1F1F1F]'
                }`}
              >
                <LayoutDashboard className={`h-4 w-4 ${activeTab === 'dashboard' ? 'text-[#FF7A00]' : 'text-[#888888]'}`} />
                <span className="text-xs">Resultados</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Footer controls & User Profile */}
        <div className="space-y-3 pt-3 border-t border-[#303030]">
          <UserMenu />
          
          <div className="text-[10px] text-[#888888] text-center font-medium">
            Merlin CRM v2.0 &bull; IA Ativa
          </div>
        </div>
      </aside>

      {/* 2. MOBILE HEADER (CLEAN & ERGONOMIC) */}
      <header className="md:hidden sticky top-0 z-40 bg-[#111111]/95 backdrop-blur-md border-b border-[#303030] px-4 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-[#FF9800] via-[#FF7A00] to-[#E85D00] text-[#0B0B0B] shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-extrabold text-base font-display tracking-tight text-white">
            Merlin CRM
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingClient(true)}
            className="bg-[#FF7A00] hover:bg-[#FF9800] text-[#0B0B0B] h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-transform"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo</span>
          </button>

          <UserMenu compact />
        </div>
      </header>

      {/* 3. MAIN WORKSPACE CONTENT */}
      <main className="flex-1 p-3.5 sm:p-5 md:p-8 pb-24 md:pb-8 overflow-x-hidden min-h-[calc(100vh-120px)] md:h-screen md:overflow-y-auto bg-[#0B0B0B]">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'meu_dia' && (
            <MyDay
              clients={clients}
              tags={tags}
              sales={sales}
              tasks={tasks}
              onSelectClient={setSelectedClientId}
              onQuickContact={handleQuickContact}
              onQuickReschedule={handleQuickReschedule}
              engineResult={engineResult}
              onNavigateToClientsWithFilter={handleNavigateToClientsWithFilter}
              onNavigateToTasksWithFilter={handleNavigateToTasksWithFilter}
            />
          )}

          {activeTab === 'rotina' && (
            <MyRoutine
              tasks={tasks}
              clients={clients}
              onAddTask={handleAddTask}
              onToggleTaskComplete={handleToggleTaskComplete}
              onDeleteTask={handleDeleteTask}
              onSelectClient={setSelectedClientId}
              onUpdateClient={handleUpdateClient}
              showTodayOnly={routineTodayOnly}
              onClearTodayOnly={() => setRoutineTodayOnly(false)}
            />
          )}

          {activeTab === 'funil' && (
            <Kanban
              clients={clients}
              tags={tags}
              onUpdateClientStatus={handleUpdateClientStatus}
              onSelectClient={setSelectedClientId}
              onAddClient={(initialCol) => {
                if (initialCol) setInitialStatusForAdd(initialCol);
                setIsAddingClient(true);
              }}
            />
          )}

          {activeTab === 'clientes' && (
            <ClientDirectory
              clients={clients}
              tags={tags}
              onSelectClient={setSelectedClientId}
              onAddClient={() => {
                setInitialStatusForAdd('Lead Novo');
                setIsAddingClient(true);
              }}
              onDeleteClient={handleDeleteClient}
              onCreateTag={handleCreateTag}
              onImportClients={handleImportClients}
              initialSpecialFilter={clientSpecialFilter}
              onSpecialFilterChange={setClientSpecialFilter}
            />
          )}

          {activeTab === 'comissoes' && (
            <Commissions
              sales={sales}
              clients={clients}
              onAddSale={handleAddSale}
              onDeleteSale={handleDeleteSale}
            />
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              clients={clients}
              sales={sales}
              onSelectClient={setSelectedClientId}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'intelligence' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-white font-display">Assistente Merlin</h1>
                <p className="text-[#BDBDBD] text-xs font-semibold">
                  Seu consultor comercial tático e redator de mensagens pessoal. Use a conversa para redigir abordagens de WhatsApp para clientes, analisar sua carteira ou obter conselhos práticos de vendas.
                </p>
              </div>
              <MerlinChat
                clients={clients}
                tasks={tasks}
                sales={sales}
                engineResult={engineResult}
                compact={false}
                onSelectClient={setSelectedClientId}
              />
            </div>
          )}
        </div>
      </main>

      {/* 4. MOBILE BOTTOM BAR NAVIGATION (ERGONOMIC 1-HANDED THUMB REACH) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#111111]/95 backdrop-blur-xl border-t border-[#303030] z-40 flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl px-1">
        {/* Meu Dia */}
        <button
          onClick={() => handleTabChange('meu_dia')}
          className={`flex flex-col items-center justify-center flex-1 h-full relative touch-target transition-all cursor-pointer ${
            activeTab === 'meu_dia' ? 'text-[#FF7A00] font-bold' : 'text-[#888888] hover:text-white'
          }`}
        >
          <div className="relative">
            <Calendar className="h-5 w-5" />
            {todayAlertsCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#EF4444] text-white text-[8px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-[#0B0B0B]">
                {todayAlertsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">Meu Dia</span>
          {activeTab === 'meu_dia' && (
            <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#FF7A00]"></span>
          )}
        </button>

        {/* Clientes */}
        <button
          onClick={() => handleTabChange('clientes')}
          className={`flex flex-col items-center justify-center flex-1 h-full relative touch-target transition-all cursor-pointer ${
            activeTab === 'clientes' ? 'text-[#FF7A00] font-bold' : 'text-[#888888] hover:text-white'
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px] mt-1">Clientes</span>
          {activeTab === 'clientes' && (
            <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#FF7A00]"></span>
          )}
        </button>

        {/* Rotina */}
        <button
          onClick={() => handleTabChange('rotina')}
          className={`flex flex-col items-center justify-center flex-1 h-full relative touch-target transition-all cursor-pointer ${
            activeTab === 'rotina' ? 'text-[#FF7A00] font-bold' : 'text-[#888888] hover:text-white'
          }`}
        >
          <div className="relative">
            <CheckSquare className="h-5 w-5" />
            {pendingTasksCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#F59E0B] text-[#0B0B0B] text-[8px] font-black h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-[#0B0B0B]">
                {pendingTasksCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">Rotina</span>
          {activeTab === 'rotina' && (
            <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#FF7A00]"></span>
          )}
        </button>

        {/* Merlin AI */}
        <button
          onClick={() => handleTabChange('intelligence')}
          className={`flex flex-col items-center justify-center flex-1 h-full relative touch-target transition-all cursor-pointer ${
            activeTab === 'intelligence' ? 'text-[#FF7A00] font-bold' : 'text-[#888888] hover:text-white'
          }`}
        >
          <div className="p-1 rounded-lg bg-[#FF7A00]/10 text-[#FF7A00]">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <span className="text-[10px] mt-0.5">Merlin AI</span>
          {activeTab === 'intelligence' && (
            <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#FF7A00]"></span>
          )}
        </button>

        {/* Mais (Secondary Modules) */}
        <button
          onClick={() => setIsMobileMoreOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full relative touch-target transition-all cursor-pointer ${
            ['funil', 'comissoes', 'dashboard'].includes(activeTab)
              ? 'text-[#FF7A00] font-bold'
              : 'text-[#888888] hover:text-white'
          }`}
        >
          <div className="relative">
            <MoreHorizontal className="h-5 w-5" />
            {['funil', 'comissoes', 'dashboard'].includes(activeTab) && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF7A00]"></span>
            )}
          </div>
          <span className="text-[10px] mt-1">Mais</span>
          {['funil', 'comissoes', 'dashboard'].includes(activeTab) && (
            <span className="absolute bottom-1 w-5 h-0.5 rounded-full bg-[#FF7A00]"></span>
          )}
        </button>
      </nav>

      {/* 4.1. MOBILE "MAIS" BOTTOM SHEET DRAWER */}
      <AnimatePresence>
        {isMobileMoreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMoreOpen(false)}
              className="md:hidden fixed inset-0 bg-[#0B0B0B]/80 backdrop-blur-xs z-50 cursor-pointer"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#161616] border-t border-[#303030] rounded-t-3xl p-5 pb-8 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              {/* Drag bar indicator */}
              <div className="w-12 h-1 bg-[#303030] rounded-full mx-auto" />

              <div className="flex items-center justify-between pt-1">
                <div>
                  <h3 className="text-base font-bold font-display text-white">
                    Módulos & Gestão
                  </h3>
                  <p className="text-xs text-[#888888]">
                    Acesso rápido a todos os recursos
                  </p>
                </div>
                <button
                  onClick={() => setIsMobileMoreOpen(false)}
                  className="p-1.5 rounded-lg bg-[#1F1F1F] text-[#888888] hover:text-white cursor-pointer border border-[#303030]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Grid of options */}
              <div className="grid grid-cols-1 gap-2 pt-2">
                <button
                  onClick={() => handleTabChange('funil')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    activeTab === 'funil'
                      ? 'bg-[#FF7A00]/15 border-[#FF7A00]/40 text-[#FF7A00]'
                      : 'bg-[#1F1F1F] border-[#303030] text-[#E5E5E5]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#FF7A00]/10 text-[#FF7A00]">
                      <Trello className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Funil de Vendas</p>
                      <p className="text-xs text-[#888888]">Quadro Kanban de negociações</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#888888]" />
                </button>

                <button
                  onClick={() => handleTabChange('comissoes')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    activeTab === 'comissoes'
                      ? 'bg-[#FF7A00]/15 border-[#FF7A00]/40 text-[#FF7A00]'
                      : 'bg-[#1F1F1F] border-[#303030] text-[#E5E5E5]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#FF7A00]/10 text-[#FF7A00]">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Comissões & Finanças</p>
                      <p className="text-xs text-[#888888]">Simulador e extrato de honorários</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#888888]" />
                </button>

                <button
                  onClick={() => handleTabChange('dashboard')}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-[#FF7A00]/15 border-[#FF7A00]/40 text-[#FF7A00]'
                      : 'bg-[#1F1F1F] border-[#303030] text-[#E5E5E5]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#FF7A00]/10 text-[#FF7A00]">
                      <LayoutDashboard className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Resultados & Métricas</p>
                      <p className="text-xs text-[#888888]">Performance e conversão</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#888888]" />
                </button>
              </div>

              {/* Quick Add Client Button */}
              <button
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  setIsAddingClient(true);
                }}
                className="w-full bg-[#FF7A00] hover:bg-[#FF9800] text-[#0B0B0B] font-bold p-3.5 rounded-2xl shadow-md flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Cadastrar Novo Cliente</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 5. SIDEWAYS DETAILS DRAWER (CLIENT PROFILE SCREEN) */}
      <AnimatePresence>
        {selectedClientId && activeClientObj && (
          <ClientDetails
            client={activeClientObj}
            tags={tags}
            onClose={() => setSelectedClientId(null)}
            onUpdateClient={handleUpdateClient}
            tasks={tasks}
            onAddTask={handleAddTask}
            onToggleTaskComplete={handleToggleTaskComplete}
            onDeleteTask={handleDeleteTask}
          />
        )}
      </AnimatePresence>

      {/* 6. CREATE CLIENT DIALOG MODAL */}
      <AnimatePresence>
        {isAddingClient && (
          <AddClientModal
            tags={tags}
            initialStatus={initialStatusForAdd}
            onClose={() => setIsAddingClient(false)}
            onSave={handleAddClient}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
