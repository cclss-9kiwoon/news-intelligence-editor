import { useEffect, useRef, useState, useCallback } from 'react';
import { putAsset, listByGroup, getBlob, deleteAsset, type ImageAsset } from '../../lib/imageStore';

/**
 * 그룹 이미지 라이브러리 — IndexedDB(imageStore) 기반.
 * 업로드 + 엔티티 태깅 + 썸네일 그리드 + 삭제. 그룹 공용 자산(캠페인 ②-B 제작가능성 폴백).
 */
export function ImageLibrary({ groupId }: { groupId: string }) {
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Record<string, string>>({});

  const reload = useCallback(async () => {
    const list = await listByGroup(groupId);
    list.sort((a, b) => b.addedAt - a.addedAt);
    setAssets(list);
    // 썸네일 objectURL 생성 (없는 것만)
    const next: Record<string, string> = { ...urlsRef.current };
    for (const a of list) {
      if (next[a.id]) continue;
      const blob = await getBlob(a.id);
      if (blob) next[a.id] = URL.createObjectURL(blob);
    }
    urlsRef.current = next;
    setUrls({ ...next });
  }, [groupId]);

  useEffect(() => { reload(); }, [reload]);
  // 언마운트 시 objectURL 해제
  useEffect(() => () => { Object.values(urlsRef.current).forEach(u => URL.revokeObjectURL(u)); }, []);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const entityTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const dims = await imageDims(file);
        const id = `img_${crypto.randomUUID()}`;
        await putAsset({
          id, groupId, blobKey: id, mime: file.type, w: dims.w, h: dims.h,
          entityTags, source: 'upload', addedAt: Date.now(), alt: file.name,
        }, file);
      }
      setTags('');
      await reload();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('이 이미지를 삭제할까요?')) return;
    await deleteAsset(id);
    if (urlsRef.current[id]) { URL.revokeObjectURL(urlsRef.current[id]); delete urlsRef.current[id]; }
    await reload();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <h2 className="mb-1 text-lg font-bold text-slate-800">🖼 이미지 라이브러리</h2>
      <p className="mb-4 text-xs text-slate-400">그룹 공용 이미지. 엔티티 태그로 기사에 자동 매칭(이미지 0장 보완). 워터마크·규격 미달은 제작에서 제외됩니다.</p>

      <div className="mb-5 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white/60 p-3">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">엔티티 태그 (쉼표) — 업로드에 적용</label>
          <input className="w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm" placeholder="BTS, 정국"
            value={tags} onChange={e => setTags(e.target.value)} />
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onUpload(e.target.files)} />
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
          {busy ? '업로드 중…' : '+ 이미지 업로드'}
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center">
          <span className="text-3xl">🖼</span>
          <p className="text-sm text-slate-400">아직 이미지가 없어요 — 업로드하면 기사 제작 시 매칭됩니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map(a => (
            <div key={a.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white">
              {urls[a.id]
                ? <img src={urls[a.id]} alt={a.alt ?? ''} className="h-32 w-full object-cover" />
                : <div className="flex h-32 w-full items-center justify-center bg-slate-50 text-slate-300">로딩…</div>}
              <button onClick={() => onDelete(a.id)} aria-label="삭제"
                className="absolute right-1.5 top-1.5 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">🗑</button>
              <div className="px-2 py-1.5 text-[11px] text-slate-500">
                <p className="truncate">{a.w}×{a.h}{a.usable === false ? ' · ⚠ 사용불가' : ''}</p>
                {a.entityTags.length > 0 && <p className="truncate text-slate-400">{a.entityTags.join(', ')}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function imageDims(file: File): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
