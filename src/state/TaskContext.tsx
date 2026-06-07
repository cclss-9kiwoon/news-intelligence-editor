import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { Task, TaskStatus, DiscardReason } from '../types';
import { loadJson, saveJson } from '../lib/storage';
import { recordDiscard, makeDiscardEntry } from '../lib/discardLedger';

const TASKS_KEY = 'pasta:tasks';

type Ctx = {
  tasks: Task[];
  tasksForCampaign: (campaignId: string) => Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task;
  addTasks: (tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]) => Task[];
  updateTask: (id: string, patch: Partial<Task>) => void;
  moveTask: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => void;
  // 보드 액션
  togglePriority: (id: string) => void;
  pauseTask: (id: string, reason?: string) => void;
  resumeTask: (id: string) => void;
  discardTask: (id: string, reason: DiscardReason) => void;  // 보존 폐기(폐기함). 완전삭제는 deleteTask
};

const TaskCtx = createContext<Ctx | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => loadJson<Task[]>(TASKS_KEY, []));

  useEffect(() => { saveJson(TASKS_KEY, tasks); }, [tasks]);

  // 폐기/거부 원장 기록용 최신 tasks 참조(클로저 stale 방지). 삭제 전 task에서 엔트리 생성.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const recordTaskDiscard = (id: string) => {
    const t = tasksRef.current.find(x => x.id === id);
    if (t) recordDiscard(makeDiscardEntry({ title: t.title, articleIds: t.sources.map(s => s.articleId) }));
  };

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

  // 벌크 생성 — 한 번의 setState로 다건 추가(대량 생성 시 재렌더 폭발 방지). 생성된 Task[] 반환.
  const addTasks = useCallback((items: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    if (items.length === 0) return [];
    const now = Date.now();
    const full: Task[] = items.map(t => ({ ...t, id: `task_${crypto.randomUUID()}`, createdAt: now, updatedAt: now }));
    setTasks(prev => [...prev, ...full]);
    return full;
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)));
  }, []);

  const moveTask = useCallback((id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    recordTaskDiscard(id);  // 원장 기록 → 삭제돼도 같은 사건 ① 재유입 차단
    setTasks(prev => prev.filter(t => t.id !== id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePriority = useCallback((id: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, priority: !t.priority, updatedAt: Date.now() } : t)));
  }, []);

  const pauseTask = useCallback((id: string, reason?: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, paused: true, pausedAt: Date.now(), pauseReason: reason, updatedAt: Date.now() } : t)));
  }, []);

  const resumeTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, paused: false, pausedAt: undefined, pauseReason: undefined, updatedAt: Date.now() } : t)));
  }, []);

  const discardTask = useCallback((id: string, reason: DiscardReason) => {
    recordTaskDiscard(id);  // 보존 폐기도 원장 기록 → 같은 사건 ① 재유입 차단
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, discardReason: reason, paused: false, updatedAt: Date.now() } : t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TaskCtx.Provider value={{ tasks, tasksForCampaign, addTask, addTasks, updateTask, moveTask, deleteTask, togglePriority, pauseTask, resumeTask, discardTask }}>
      {children}
    </TaskCtx.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TaskCtx);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
