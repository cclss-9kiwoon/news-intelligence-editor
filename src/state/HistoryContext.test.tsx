import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { HistoryProvider, useHistory } from './HistoryContext';
import type { ConvertedResult } from '../types';

function make(id: string): ConvertedResult {
  return {
    schemaVersion: 3,
    id,
    sourceArticleIds: ['a'],
    sourceTitle: 't',
    createdAt: parseInt(id) || Date.now(),
    model: 'gpt-4o-mini',
    categoryId: 'music',
    summary: '요약',
    headline: '헤드라인',
    body: '본문',
    tags: ['a'],
    imagePrompt: 'prompt',
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

  it('adds entries and persists under the v2 key', () => {
    render(<HistoryProvider><Probe /></HistoryProvider>);
    act(() => screen.getByText('add').click());
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(localStorage.getItem('nie:history.v2')).toBeTruthy();
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

  it('version guard: discards entries that are not the current schema version', () => {
    // Stale entries (no/old schemaVersion) stored under the v2 key are dropped on load.
    localStorage.setItem('nie:history.v2', JSON.stringify([
      { id: 'old1', sourceTitle: 'legacy', channels: {} },  // no schemaVersion
      { ...make('111'), schemaVersion: 2 },                  // wrong version
      make('222'),                                           // valid v3
    ]));
    render(<HistoryProvider><Probe /></HistoryProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
