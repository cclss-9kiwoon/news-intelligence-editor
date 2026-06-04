import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Group, Campaign, CampaignSettings } from '../types';
import { loadJson, saveJson } from '../lib/storage';
import { makeGroup, makeCampaign, migrateCampaignSettings, migrateGroup } from '../lib/defaultCampaign';

const GROUPS_KEY = 'pasta:groups';
const CAMPAIGNS_KEY = 'pasta:campaigns';
const ACTIVE_KEY = 'pasta:activeCampaignId';

type Ctx = {
  groups: Group[];
  campaigns: Campaign[];
  activeCampaignId: string | null;
  activeCampaign: Campaign | null;

  // group CRUD
  addGroup: (name: string, profile?: Partial<import('../types').GroupProfile>) => Group;
  updateGroupProfile: (id: string, patch: Partial<import('../types').GroupProfile>) => void;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;

  // campaign CRUD
  addCampaign: (groupId: string, name: string) => Campaign;
  renameCampaign: (id: string, name: string) => void;
  deleteCampaign: (id: string) => void;
  updateCampaignSettings: (id: string, patch: Partial<CampaignSettings>) => void;

  setActiveCampaign: (id: string | null) => void;
};

const CampaignCtx = createContext<Ctx | null>(null);

export function CampaignProvider({ children }: { children: ReactNode }) {
  // 빈 상태로 시작 (자동 시드 없음). 첫 진입 = 그룹 0개 온보딩.
  // 로드 시 마이그레이션: 구버전 group(profile 없음)/평면 CampaignSettings → 최신 구조.
  const [{ initGroups, initCampaigns }] = useState(() => ({
    initGroups: loadJson<any[]>(GROUPS_KEY, []).map(migrateGroup),
    initCampaigns: loadJson<any[]>(CAMPAIGNS_KEY, []).map((c: any) => ({
      ...c,
      settings: migrateCampaignSettings(c.settings),
    })),
  }));
  const [groups, setGroups] = useState<Group[]>(initGroups);
  const [campaigns, setCampaigns] = useState<Campaign[]>(initCampaigns);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(
    () => loadJson<string | null>(ACTIVE_KEY, null),
  );

  // persist
  useEffect(() => { saveJson(GROUPS_KEY, groups); }, [groups]);
  useEffect(() => { saveJson(CAMPAIGNS_KEY, campaigns); }, [campaigns]);
  useEffect(() => { saveJson(ACTIVE_KEY, activeCampaignId); }, [activeCampaignId]);

  const activeCampaign = campaigns.find(c => c.id === activeCampaignId) ?? null;

  // ── group CRUD ──
  const addGroup = useCallback((name: string, profile?: Partial<import('../types').GroupProfile>) => {
    const g = makeGroup(name, profile);
    setGroups(prev => [...prev, g]);
    return g;
  }, []);

  const updateGroupProfile = useCallback((id: string, patch: Partial<import('../types').GroupProfile>) => {
    setGroups(prev => prev.map(g => (g.id === id ? { ...g, profile: { ...g.profile, ...patch } } : g)));
  }, []);

  const renameGroup = useCallback((id: string, name: string) => {
    setGroups(prev => prev.map(g => (g.id === id ? { ...g, name } : g)));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    setCampaigns(prev => prev.filter(c => c.groupId !== id));
  }, []);

  // ── campaign CRUD ──
  const addCampaign = useCallback((groupId: string, name: string) => {
    const c = makeCampaign(groupId, name);
    setCampaigns(prev => [...prev, c]);
    return c;
  }, []);

  const renameCampaign = useCallback((id: string, name: string) => {
    setCampaigns(prev => prev.map(c => (c.id === id ? { ...c, name, updatedAt: Date.now() } : c)));
  }, []);

  const deleteCampaign = useCallback((id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    setActiveCampaignId(prev => (prev === id ? null : prev));
  }, []);

  const updateCampaignSettings = useCallback((id: string, patch: Partial<CampaignSettings>) => {
    setCampaigns(prev => prev.map(c =>
      c.id === id
        ? { ...c, settings: { ...c.settings, ...patch }, updatedAt: Date.now() }
        : c,
    ));
  }, []);

  const setActiveCampaign = useCallback((id: string | null) => setActiveCampaignId(id), []);

  return (
    <CampaignCtx.Provider value={{
      groups, campaigns, activeCampaignId, activeCampaign,
      addGroup, updateGroupProfile, renameGroup, deleteGroup,
      addCampaign, renameCampaign, deleteCampaign, updateCampaignSettings,
      setActiveCampaign,
    }}>
      {children}
    </CampaignCtx.Provider>
  );
}

export function useCampaigns() {
  const ctx = useContext(CampaignCtx);
  if (!ctx) throw new Error('useCampaigns must be used within CampaignProvider');
  return ctx;
}
