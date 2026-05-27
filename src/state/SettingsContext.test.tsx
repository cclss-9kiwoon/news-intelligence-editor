import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

function Probe() {
  const { settings, setActiveCategoryId, addCategory, updateCategory, removeCategory } = useSettings();
  return (
    <div>
      <span data-testid="count">{settings.categories.length}</span>
      <span data-testid="active">{settings.activeCategoryId}</span>
      <span data-testid="screen-label">
        {settings.categories.find(c => c.id === 'screen')?.label}
      </span>
      <button onClick={() => setActiveCategoryId('screen')}>activate</button>
      <button onClick={() => addCategory()}>add</button>
      <button onClick={() => updateCategory('music', { label: 'EDITED' })}>edit</button>
      <button onClick={() => removeCategory('events')}>remove</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe('SettingsContext categories', () => {
  it('starts with 5 default categories and music active', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('5');
    expect(screen.getByTestId('active')).toHaveTextContent('music');
  });

  it('setActiveCategoryId switches the active lens', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    act(() => screen.getByText('activate').click());
    expect(screen.getByTestId('active')).toHaveTextContent('screen');
  });

  it('addCategory / updateCategory / removeCategory mutate the list', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    act(() => screen.getByText('add').click());
    expect(screen.getByTestId('count')).toHaveTextContent('6');
    act(() => screen.getByText('edit').click());
    expect(screen.getByTestId('screen-label')).toHaveTextContent('🎬');
    act(() => screen.getByText('remove').click());
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });
});
