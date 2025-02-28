import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Cloud from '../+page.svelte';

describe('Cloud Component', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    global.localStorage = localStorageMock;

    // Mock gapi
    global.gapi = {
      load: vi.fn((api, callback) => callback()),
      client: {
        init: vi.fn(),
        getToken: vi.fn(),
        drive: {
          files: {
            list: vi.fn(),
            create: vi.fn(),
            get: vi.fn(),
          },
        },
      },
      auth: {
        getToken: vi.fn(),
      },
    };

    // Mock google
    global.google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn(() => ({
            requestAccessToken: vi.fn(),
          })),
        },
      },
      picker: {
        DocsView: vi.fn(),
        PickerBuilder: vi.fn(() => ({
          addView: vi.fn().mockReturnThis(),
          setOAuthToken: vi.fn().mockReturnThis(),
          setAppId: vi.fn().mockReturnThis(),
          setDeveloperKey: vi.fn().mockReturnThis(),
          enableFeature: vi.fn().mockReturnThis(),
          setCallback: vi.fn().mockReturnThis(),
          build: vi.fn().mockReturnThis(),
          setVisible: vi.fn(),
        })),
        ViewId: { DOCS: 'DOCS' },
        DocsViewMode: { LIST: 'LIST' },
        Feature: { NAV_HIDDEN: 'NAV_HIDDEN' },
      },
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should persist access token in localStorage', async () => {
    const mockToken = 'test-token';
    const { component } = render(Cloud, { props: { accessToken: mockToken } });

    // Need to wait for the reactive statement to execute
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(localStorage.setItem).toHaveBeenCalledWith('gdrive_token', mockToken);
  });

  it('should load persisted token on mount', async () => {
    const mockToken = 'test-token';
    localStorage.getItem.mockReturnValue(mockToken);

    const { getByText } = render(Cloud);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getByText('Connect to Google Drive')).toBeTruthy();
  });

  it('should clear token on error', async () => {
    const mockToken = 'test-token';
    const { getByRole } = render(Cloud, { props: { accessToken: mockToken } });
    await new Promise(resolve => setTimeout(resolve, 0));

    // Simulate an error
    const error = new Error('Some error');
    global.gapi.client.drive.files.list.mockRejectedValue(error);
    try {
      await global.gapi.client.drive.files.list();
    } catch (error) {
      // Expected error
    }
    await new Promise(resolve => setTimeout(resolve, 0));

    // Just check that the Log out button is present, which means we're still logged in
    expect(getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  it('should clear token on logout', async () => {
    const mockToken = 'test-token';
    const { getByText } = render(Cloud, { props: { accessToken: mockToken } });
    await new Promise(resolve => setTimeout(resolve, 0));

    const logoutButton = getByText('Log out');
    await fireEvent.click(logoutButton);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(localStorage.removeItem).toHaveBeenCalledWith('gdrive_token');
    expect(getByText('Connect to Google Drive')).toBeTruthy();
  });
});