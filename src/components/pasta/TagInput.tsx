import { useState, type KeyboardEvent } from 'react';

/**
 * 칩(태그) 입력. 단어 입력 후 Enter 또는 쉼표 → 칩으로 등록.
 * 빈 입력에서 Backspace → 마지막 칩 삭제. 칩 × 클릭 → 개별 삭제. 중복 자동 제거.
 */
export function TagInput({
  values,
  onChange,
  placeholder,
  tone = 'indigo',
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  tone?: 'indigo' | 'rose';
}) {
  const [draft, setDraft] = useState('');

  const chip = tone === 'rose'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-indigo-50 text-indigo-700 border-indigo-200';

  const commit = (raw: string) => {
    const v = raw.trim().replace(/,$/, '').trim();
    if (!v) return;
    if (values.includes(v)) { setDraft(''); return; }
    onChange([...values, v]);
    setDraft('');
  };

  const remove = (i: number) => onChange(values.filter((_, idx) => idx !== i));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      remove(values.length - 1);
    }
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-colors">
      {values.map((v, i) => (
        <span key={`${v}-${i}`} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${chip}`}>
          {v}
          <button
            type="button"
            onClick={() => remove(i)}
            className="leading-none opacity-60 hover:opacity-100"
            aria-label={`${v} 삭제`}
          >×</button>
        </span>
      ))}
      <input
        className="min-w-[80px] flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-slate-400"
        placeholder={values.length === 0 ? placeholder : ''}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}
