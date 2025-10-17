import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import QuickAccess from '../QuickAccess.svelte';
import { isReader } from '$lib/util';

vi.mock('$lib/util', () => ({
  isReader: vi.fn()
}));

describe('QuickAccess', () => {
  it('should navigate to series page when closing reader', async () => {
    // Mock isReader to return true
    vi.mocked(isReader).mockReturnValue(true);

    // Mock window.location using Object.defineProperty
    const originalLocation = window.location;
    delete (window as any).location;
    Object.defineProperty(window, 'location', {
      value: {
        href: '/series-uuid/volume-uuid',
        pathname: '/series-uuid/volume-uuid'
      },
      writable: true,
      configurable: true
    });

    const { getByText } = render(QuickAccess);
    const closeButton = getByText('Close reader');

    await fireEvent.click(closeButton);

    // Should navigate to /series-uuid
    expect(window.location.href).toBe('/series-uuid');

    // Restore window.location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true
    });
  });
});
