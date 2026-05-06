import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from './page';

vi.mock('@/components/GameShell', () => ({
  GameShell: () => <main>mock root game shell</main>
}));

vi.stubGlobal('React', React);

describe('HomePage root game entry', () => {
  it('uses the bare root path as the fixed game URL instead of linking to another route', () => {
    window.history.replaceState({}, '', '/');

    render(<HomePage />);

    expect(screen.getByText('mock root game shell')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '进入大厅' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
