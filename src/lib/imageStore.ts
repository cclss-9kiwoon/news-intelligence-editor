/**
 * 이미지 라이브러리 저장소 (IndexedDB).
 * 그룹/캠페인 단위로 업로드·수집 이미지를 blob+메타로 보관 →
 * ②-B 제작 가능성(엔티티 매칭으로 이미지 0장 보완)·발행 썸네일에 사용.
 *
 * 합의(Engineer): blobKey=id 동일 → 단일 store에 blob+메타 함께 저장(별도 blob store 불필요).
 * DB 'nie-images' / store 'assets'(keyPath id) / index(groupId, campaignId, entityTags multiEntry).
 *
 * IndexedDB라 단위테스트는 폴리필 필요 → 브라우저/라이브러리 UI에서 검증.
 */

export type ImageAsset = {
  id: string;
  groupId: string;
  campaignId?: string;          // null/undefined = 그룹 공용
  blobKey: string;              // = id (단일 store 단순화)
  mime: string;
  w: number;
  h: number;
  entityTags: string[];         // 인물/브랜드 태그 (cluster.entities 매칭용)
  source: 'upload' | 'collected';
  addedAt: number;
  alt?: string;
  sourceUrl?: string;           // collected 출처 추적
  usable?: boolean;             // ②-B 워터마크·규격 판정 캐시 (미판정=undefined)
};

// 내부 저장 레코드 = 메타 + blob
type StoredRecord = ImageAsset & { blob: Blob };

const DB_NAME = 'nie-images';
const STORE = 'assets';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('groupId', 'groupId', { unique: false });
        store.createIndex('campaignId', 'campaignId', { unique: false });
        store.createIndex('entityTags', 'entityTags', { unique: false, multiEntry: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  }));
}

function stripBlob(r: StoredRecord): ImageAsset {
  const { blob: _blob, ...meta } = r;
  return meta;
}

/** 저장(업서트). asset.id 키. blob은 같은 레코드에 보관. */
export async function putAsset(asset: ImageAsset, blob: Blob): Promise<void> {
  const record: StoredRecord = { ...asset, blobKey: asset.id, blob };
  await tx('readwrite', store => store.put(record));
}

/** 메타만 조회 (blob 제외) */
export async function getAsset(id: string): Promise<ImageAsset | undefined> {
  const r = await tx<StoredRecord | undefined>('readonly', store => store.get(id));
  return r ? stripBlob(r) : undefined;
}

/** blob 조회 (렌더용 objectURL 생성에 사용) */
export async function getBlob(id: string): Promise<Blob | undefined> {
  const r = await tx<StoredRecord | undefined>('readonly', store => store.get(id));
  return r?.blob;
}

async function listByIndex(index: 'groupId' | 'campaignId', value: string): Promise<ImageAsset[]> {
  const rows = await tx<StoredRecord[]>('readonly', store => store.index(index).getAll(value));
  return rows.map(stripBlob).sort((a, b) => b.addedAt - a.addedAt);
}

export function listByGroup(groupId: string): Promise<ImageAsset[]> {
  return listByIndex('groupId', groupId);
}
export function listByCampaign(campaignId: string): Promise<ImageAsset[]> {
  return listByIndex('campaignId', campaignId);
}

/** 그룹 내 엔티티 매칭 — ②-B 이미지 0장 보완용. tags 중 하나라도 겹치는 자산. */
export async function matchByEntity(groupId: string, entityTags: string[]): Promise<ImageAsset[]> {
  if (entityTags.length === 0) return [];
  const wanted = new Set(entityTags.map(t => t.toLowerCase().trim()).filter(Boolean));
  const all = await listByGroup(groupId);
  return all.filter(a => a.entityTags.some(t => wanted.has(t.toLowerCase().trim())));
}

export async function deleteAsset(id: string): Promise<void> {
  await tx('readwrite', store => store.delete(id));
}
