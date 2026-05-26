import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

function Probe() {
  const { settings, setApiKey } = useSettings();
  return (
    <div>
      <span data-testid="key">{settings.apiKey || 'empty'}</span>
      <button onClick={() => setApiKey('sk-x')}>set</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());

describe('SettingsContext', () => {
  it('provides default settings when localStorage is empty', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    expect(screen.getByTestId('key')).toHaveTextContent('empty');
  });

  it('persists changes to localStorage', () => {
    render(<SettingsProvider><Probe /></SettingsProvider>);
    act(() => { screen.getByText('set').click(); });
    expect(screen.getByTestId('key')).toHaveTextContent('sk-x');
    expect(localStorage.getItem('nie:settings')).toContain('sk-x');
  });

  it('loads settings from localStorage on mount', () => {
    localStorage.setItem('nie:settings', JSON.stringify({ apiKey: 'sk-stored' }));
    render(<SettingsProvider><Probe /></SettingsProvider>);
    expect(screen.getByTestId('key')).toHaveTextContent('sk-stored');
  });
});
