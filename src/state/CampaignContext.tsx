import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Group, Campaign, CampaignSettings, Channel } from '../types';
import { loadJson, saveJson } from '../lib/storage';
import { makeGroup, makeCampaign, makeSeedData } from '../lib/defaultCampaign';

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
  addChannel: (groupId: string, channel: Omit<Channel, 'id'>) => void;
  removeChannel: (groupId: string, channelId: string) => void;

  // campaign CRUD
  addCampaign: (groupId: string, name: string) => Campaign;
  renameCampaign: (id: string, name: string) => void;
  deleteCampaign: (id: string) => void;
  updateCampaignSettings: (id: string, patch: Partial<CampaignSettings>) => void;

  setActiveCampaign: (id: string | null) => void;
};

const CampaignCtx = createContext<Ctx | null>(null);

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>(() => {
    const stored = loadJson<Group[] | null>(GROUPS_KEY, null);
    if (stored && stored.length > 0) return stored;
    return makeSeedData().groups;
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const storedG = loadJson<Group[] | null>(GROUPS_KEY, null);
    const storedC = loadJson<Campaign[] | null>(CAMPAIGNS_KEY, null);
    if (storedG && storedG.length > 0) return storedC ?? [];
    return makeSeedData().campaigns;
  });
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

  const addChannel = useCallback((groupId: string, channel: Omit<Channel, 'id'>) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, channels: [...g.channels, { ...channel, id: `ch_${Date.now().toString(36)}` }] }
        : g,
    ));
  }, []);

  const removeChannel = useCallback((groupId: string, channelId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, channels: g.channels.filter(c => c.id !== channelId) } : g,
    ));
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
      addGroup, renameGroup, deleteGroup, addChannel, removeChannel,
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
