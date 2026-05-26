import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { HistoryProvider, useHistory } from './HistoryContext';
import type { ConvertedResult } from '../types';

function make(id: string): ConvertedResult {
  return {
    id, sourceArticleIds: ['a'], sourceTitle: 't', createdAt: parseInt(id), valueScore: 5,
    valueReason: '', facts: { people: [], numbers: [], places: [], dates: [] },
    englishDraft: '', channels: { site: '', x: '', medium: '' },
    factReport: { ok: true, missing: [] },
    bannedHits: { site: [], x: [], medium: [] },
    stylePreset: 'kpop', model: 'gpt-4o-mini',
  };
}

function Probe() {
  const { history, addEntry, clear } = useHistory();
  return (
    <div>
      <span data-testid="count">{history.length}</span>
      <button onClick={() => addEntry(make(String(Date.now() + Math.random())))}>add</button>
      <button onClick={clear}>clear</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe('HistoryContext', () => {
  it('starts empty', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('adds entries and persists', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    act(() => screen.getByText('add').click());
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(localStorage.getItem('nie:history')).toBeTruthy();
  });

  it('caps history at 20 entries (FIFO)', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    act(() => {
      for (let i = 0; i < 25; i++) screen.getByText('add').click();
    });
    expect(parseInt(screen.getByTestId('count').textContent || '0')).toBe(20);
  });

  it('clear empties history', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    act(() => screen.getByText('add').click());
    act(() => screen.getByText('clear').click());
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
