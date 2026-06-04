import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Group, Campaign, CampaignSettings } from '../types';
import { loadJson, saveJson } from '../lib/storage';
import { makeGroup, makeCampaign } from '../lib/defaultCampaign';

const GROUPS_KEY = 'pasta:groups';
const CAMPAIGNS_KEY = 'pasta:campaigns';
const ACTIVE_KEY = 'pasta:activeCampaignId';

type Ctx = {
  groups: Group[];
  campaigns: Campaign[];
  activeCampaignId: string | null;
  activeCampaign: Campaign | null;

  // group CRUD
  addGroup: (name: string) => Group;
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
  const [{ initGroups, initCampaigns }] = useState(() => ({
    initGroups: loadJson<Group[]>(GROUPS_KEY, []),
    initCampaigns: loadJson<Campaign[]>(CAMPAIGNS_KEY, []),
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
  const addGroup = useCallback((name: string) => {
    const g = makeGroup(name);
    setGroups(prev => [...prev, g]);
    return g;
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
      addGroup, renameGroup, deleteGroup,
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
