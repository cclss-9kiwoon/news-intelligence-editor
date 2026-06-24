import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  aggregate, budgetStatus, loadUsageEntries, setUsagePersist, getUsageEntries,
  type UsageAggregate, type BudgetStatus, type UsageEntry,
} from '../lib/usageLedger';
import { setBudgetGuard } from '../lib/llmBackend';
import { loadJson, saveJson, STORAGE_KEYS } from '../lib/storage';
import { useSettings } from './SettingsContext';

// 비용/사용량 컨텍스트 — usageLedger(적립은 llmCall이 자동) 읽기 + 영속 + 예산 가드 wiring(NIE bb39b046).
// settings(priceTable/예산 한도)는 ref로 최신값 참조 → 가드/집계가 항상 현재 설정 기준.
type Ctx = {
  usage: UsageAggregate;
  budget: BudgetStatus;
  krwPerUsd: number;   // 0이면 ₩ 병기 안 함
};

const UsageCtx = createContext<Ctx | null>(null);

const TICK_MS = 5_000;  // 집계/예산 재평가 주기(렌더 갱신)

export function UsageProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  // 가드/집계가 참조할 최신 설정 — 매 렌더 갱신(클로저 stale 방지)
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // 1회: 영속 로드 + 저장 훅 + 예산 가드 등록
  useEffect(() => {
    const init = loadJson<UsageEntry[]>(STORAGE_KEYS.usage, []);
    loadUsageEntries(Array.isArray(init) ? init : []);
    // persist는 recordUsage마다 호출 → debounce(1s)로 localStorage 쓰기 thrash 방지(NIE 권장).
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    setUsagePersist(all => {
      if (saveTimer) clearTimeout(saveTimer);
      const snapshot = [...all];
      saveTimer = setTimeout(() => saveJson(STORAGE_KEYS.usage, snapshot), 1_000);
    });
    // 예산 가드: llmCall(api)이 호출 전 이걸 보고 초과 시 하드 스톱.
    setBudgetGuard(() => {
      const s = settingsRef.current;
      return budgetStatus(Date.now(), { dailyUsd: s.budgetDailyUsd, hourlyUsd: s.budgetHourlyUsd }, s.priceTable).tripped;
    });
    return () => {
      if (saveTimer) { clearTimeout(saveTimer); saveJson(STORAGE_KEYS.usage, [...getUsageEntries()]); }  // 언마운트 시 즉시 flush
      setUsagePersist(null); setBudgetGuard(null);
    };
  }, []);

  // tick: 집계/예산 재평가 → 구독 컴포넌트 갱신. getUsageEntries 길이로 즉시성 보강.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const usage = aggregate(now, settings.priceTable);
  const budget = budgetStatus(now, { dailyUsd: settings.budgetDailyUsd, hourlyUsd: settings.budgetHourlyUsd }, settings.priceTable);

  return <UsageCtx.Provider value={{ usage, budget, krwPerUsd: settings.currencyKrwPerUsd ?? 0 }}>{children}</UsageCtx.Provider>;
}

export function useUsage(): Ctx {
  const ctx = useContext(UsageCtx);
  if (!ctx) throw new Error('useUsage must be used within UsageProvider');
  return ctx;
}
