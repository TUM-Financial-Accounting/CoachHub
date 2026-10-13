import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { emitAppEvent, useAppEvent } from './appEvents';

function Listener({ onOpen }: { onOpen: () => void }) {
  useAppEvent('open-search', onOpen);
  return null;
}

describe('app events', () => {
  it('delivers an emitted event to its subscriber only', async () => {
    const onOpen = vi.fn();
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Listener, { onOpen })));

    emitAppEvent('open-create-team');
    expect(onOpen).not.toHaveBeenCalled();
    emitAppEvent('open-search');
    expect(onOpen).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    emitAppEvent('open-search');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
