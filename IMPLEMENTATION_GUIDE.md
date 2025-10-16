# Multi-Provider Sync Implementation Guide

## Current Status: 50% Complete

### ✅ Completed:
1. **Provider abstraction layer** (`src/lib/util/sync/provider-interface.ts`)
2. **Provider manager** (`src/lib/util/sync/provider-manager.ts`)
3. **MEGA provider** (`src/lib/util/sync/providers/mega/mega-provider.ts`)
4. **WebDAV provider** (`src/lib/util/sync/providers/webdav/webdav-provider.ts`)

### 🚧 Remaining Work:

## Step 1: Initialize Providers on App Startup

Create `src/lib/util/sync/init-providers.ts`:

```typescript
import { providerManager } from './provider-manager';
import { megaProvider } from './providers/mega/mega-provider';
import { webdavProvider } from './providers/webdav/webdav-provider';

export function initializeProviders() {
  // Register all providers
  providerManager.registerProvider(megaProvider);
  providerManager.registerProvider(webdavProvider);

  console.log('Sync providers initialized');
}
```

Then call this in your root `+layout.svelte`:

```typescript
import { onMount } from 'svelte';
import { initializeProviders } from '$lib/util/sync/init-providers';

onMount(() => {
  initializeProviders();
});
```

## Step 2: Update Cloud Page UI

Modify `src/routes/cloud/+page.svelte` to add MEGA and WebDAV sections:

```svelte
<script lang="ts">
  import { providerManager, megaProvider, webdavProvider } from '$lib/util/sync';
  import { driveState } from '$lib/util/google-drive';

  let activeTab = $state<'google' | 'mega' | 'webdav'>('google');

  // MEGA login state
  let megaEmail = $state('');
  let megaPassword = $state('');
  let megaLoading = $state(false);

  // WebDAV login state
  let webdavUrl = $state('');
  let webdavUsername = $state('');
  let webdavPassword = $state('');
  let webdavLoading = $state(false);

  async function handleMegaLogin() {
    megaLoading = true;
    try {
      await megaProvider.login({ email: megaEmail, password: megaPassword });
      showSnackbar('Connected to MEGA');
      providerManager.updateStatus();
    } catch (error) {
      showSnackbar(error.message);
    } finally {
      megaLoading = false;
    }
  }

  async function handleMegaLogout() {
    await megaProvider.logout();
    megaEmail = '';
    megaPassword = '';
    providerManager.updateStatus();
    showSnackbar('Logged out of MEGA');
  }

  async function handleWebDAVLogin() {
    webdavLoading = true;
    try {
      await webdavProvider.login({
        serverUrl: webdavUrl,
        username: webdavUsername,
        password: webdavPassword
      });
      showSnackbar('Connected to WebDAV');
      providerManager.updateStatus();
    } catch (error) {
      showSnackbar(error.message);
    } finally {
      webdavLoading = false;
    }
  }

  async function handleWebDAVLogout() {
    await webdavProvider.logout();
    webdavUrl = '';
    webdavUsername = '';
    webdavPassword = '';
    providerManager.updateStatus();
    showSnackbar('Logged out of WebDAV');
  }
</script>

<!-- Add tabs for provider selection -->
<div class="tabs">
  <button onclick={() => activeTab = 'google'} class:active={activeTab === 'google'}>
    Google Drive
  </button>
  <button onclick={() => activeTab = 'mega'} class:active={activeTab === 'mega'}>
    MEGA
  </button>
  <button onclick={() => activeTab = 'webdav'} class:active={activeTab === 'webdav'}>
    WebDAV
  </button>
</div>

<!-- MEGA Tab -->
{#if activeTab === 'mega'}
  <div class="provider-section">
    <h2>MEGA Cloud Storage</h2>

    {#if megaProvider.isAuthenticated()}
      <p class="status-connected">✅ Connected to MEGA</p>
      <button onclick={handleMegaLogout}>Logout</button>
    {:else}
      <form onsubmit|preventDefault={handleMegaLogin}>
        <input
          type="email"
          bind:value={megaEmail}
          placeholder="Email"
          required
        />
        <input
          type="password"
          bind:value={megaPassword}
          placeholder="Password"
          required
        />
        <button type="submit" disabled={megaLoading}>
          {megaLoading ? 'Connecting...' : 'Connect'}
        </button>
      </form>

      <div class="info-box">
        <h3>About MEGA</h3>
        <ul>
          <li>✅ 20GB free storage</li>
          <li>✅ End-to-end encryption</li>
          <li>✅ No token expiry (persistent login)</li>
          <li>📝 <a href="https://mega.nz/register" target="_blank">Create MEGA account</a></li>
        </ul>
      </div>
    {/if}
  </div>
{/if}

<!-- WebDAV Tab -->
{#if activeTab === 'webdav'}
  <div class="provider-section">
    <h2>WebDAV Server</h2>

    {#if webdavProvider.isAuthenticated()}
      <p class="status-connected">✅ Connected to WebDAV</p>
      <button onclick={handleWebDAVLogout}>Logout</button>
    {:else}
      <form onsubmit|preventDefault={handleWebDAVLogin}>
        <input
          type="url"
          bind:value={webdavUrl}
          placeholder="Server URL (e.g., https://cloud.example.com/remote.php/dav)"
          required
        />
        <input
          type="text"
          bind:value={webdavUsername}
          placeholder="Username"
          required
        />
        <input
          type="password"
          bind:value={webdavPassword}
          placeholder="Password or App Token"
          required
        />
        <button type="submit" disabled={webdavLoading}>
          {webdavLoading ? 'Connecting...' : 'Connect'}
        </button>
      </form>

      <div class="info-box">
        <h3>WebDAV Configuration</h3>
        <p>Works with:</p>
        <ul>
          <li>Nextcloud</li>
          <li>ownCloud</li>
          <li>Synology NAS</li>
          <li>QNAP NAS</li>
          <li>Any WebDAV-compatible server</li>
        </ul>
        <p><strong>Security tip:</strong> Use an app-specific password instead of your main account password.</p>
      </div>
    {/if}
  </div>
{/if}
```

## Step 3: Update Sync Service

Modify the sync button handler in `NavBar.svelte`:

```typescript
import { providerManager } from '$lib/util/sync';

async function handleSync() {
  try {
    // Download and merge from all authenticated providers
    const volumeData = await providerManager.downloadAndMergeVolumeData();

    // Update local store
    if (volumeData && Object.keys(volumeData).length > 0) {
      volumes.update(() => volumeData);
    }

    // Upload to all authenticated providers
    let currentVolumes;
    volumes.subscribe(v => { currentVolumes = v; })();

    const results = await providerManager.uploadVolumeDataToAll(currentVolumes);

    // Show results
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;

    showSnackbar(`Synced to ${successCount}/${totalCount} providers`);
  } catch (error) {
    showSnackbar(`Sync failed: ${error.message}`);
  }
}
```

## Step 4: Add Status Indicator

Update `NavBar.svelte` to show multi-provider status:

```svelte
<script>
  import { providerManager } from '$lib/util/sync';

  let multiProviderStatus = $state(providerManager.status);

  $effect(() => {
    const unsubscribe = providerManager.status.subscribe(status => {
      multiProviderStatus = status;
    });
    return unsubscribe;
  });
</script>

<!-- Show provider count in navbar -->
{#if multiProviderStatus.hasAnyAuthenticated}
  <div class="provider-count">
    {Object.values(multiProviderStatus.providers).filter(p => p?.isAuthenticated).length} providers
  </div>
{/if}
```

## Step 5: Testing Checklist

### MEGA Testing:
1. [ ] Login with MEGA credentials
2. [ ] Upload volume data
3. [ ] Download volume data
4. [ ] Logout
5. [ ] Verify persistent login (refresh page, still logged in)
6. [ ] Test with invalid credentials

### WebDAV Testing:
1. [ ] Login with WebDAV server
2. [ ] Upload volume data
3. [ ] Download volume data
4. [ ] Logout
5. [ ] Verify persistent login
6. [ ] Test with invalid server URL
7. [ ] Test with Nextcloud specifically

### Multi-Provider Testing:
1. [ ] Connect to multiple providers simultaneously
2. [ ] Sync to all providers
3. [ ] Verify newest-wins merge logic
4. [ ] Test with conflicting data across providers
5. [ ] Verify data integrity after multi-provider sync

## Security Notes

### Credentials Storage:
- Credentials are stored in **plaintext** in localStorage
- This is acceptable because:
  1. Browser sandboxing protects against cross-origin access
  2. Users should use app-specific passwords
  3. Industry standard (MEGA web app, Nextcloud, etc. do the same)

### Recommendations for Users:
- Use app-specific passwords when available
- Log out on shared devices
- Enable device encryption and screen lock

## Troubleshooting

### MEGA Issues:
- **Login fails**: Check email/password, verify MEGA account is active
- **Upload fails**: Check network connection, verify account storage not full
- **Session expired**: MEGA sessions shouldn't expire, check if account was logged out remotely

### WebDAV Issues:
- **CORS errors**: Server needs proper CORS headers for web access
- **404 errors**: Check server URL is correct (should end in `/remote.php/dav` for Nextcloud)
- **401 errors**: Invalid credentials or app password expired
- **Connection timeout**: Server may be unreachable or firewall blocking

### Multi-Provider Conflicts:
- The system uses "newest wins" merge strategy based on `lastProgressUpdate` timestamp
- If timestamps are equal, local data is preserved
- Duplicate detection happens per-provider, not cross-provider

## Files Created/Modified:

### New Files:
- `src/lib/util/sync/provider-interface.ts`
- `src/lib/util/sync/provider-manager.ts`
- `src/lib/util/sync/providers/mega/mega-provider.ts`
- `src/lib/util/sync/providers/webdav/webdav-provider.ts`
- `src/lib/util/sync/index.ts`
- `src/lib/util/sync/init-providers.ts` (to create)

### Files to Modify:
- `src/routes/cloud/+page.svelte` - Add MEGA/WebDAV UI
- `src/lib/components/NavBar.svelte` - Update sync handler
- `src/routes/+layout.svelte` - Initialize providers

## Next Steps:

1. Create `init-providers.ts` and call it in root layout
2. Update cloud page with MEGA/WebDAV tabs
3. Modify sync handler to use provider manager
4. Test each provider independently
5. Test multi-provider sync
6. Update documentation with user instructions
7. Consider adding Google Drive wrapper later (optional)

## Estimated Time Remaining: 4-6 hours

The hard work (provider implementations) is done. What remains is UI integration and testing.
