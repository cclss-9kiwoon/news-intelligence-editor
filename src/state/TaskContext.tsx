import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Task, TaskStatus } from '../types';
import { loadJson, saveJson } from '../lib/storage';

const TASKS_KEY = 'pasta:tasks';

type Ctx = {
  tasks: Task[];
  tasksForCampaign: (campaignId: string) => Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => void;
};

const TaskCtx = createContext<Ctx | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => loadJson<Task[]>(TASKS_KEY, []));

  useEffect(() => { saveJson(TASKS_KEY, tasks); }, [tasks]);

  const tasksForCampaign = useCallback(
    (campaignId: string) => tasks.filter(t => t.campaignId === campaignId),
    [tasks],
  );

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const full: Task = { ...task, id: `task_${crypto.randomUUID()}`, createdAt: now, updatedAt: now };
    setTasks(prev => [...prev, full]);
    return full;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)));
  }, []);

  const moveTask = useCallback((id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <TaskCtx.Provider value={{ tasks, tasksForCampaign, addTask, updateTask, moveTask, deleteTask }}>
      {children}
    </TaskCtx.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TaskCtx);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
