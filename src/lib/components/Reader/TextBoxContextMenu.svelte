<script lang="ts">
  interface Props {
    x: number;
    y: number;
    lines: string[];
    ankiEnabled: boolean;
    onCopy: () => void;
    onCopyRaw: () => void;
    onAddToAnki: (selection: string) => void;
    onClose: () => void;
  }

  let { x, y, lines, ankiEnabled, onCopy, onCopyRaw, onAddToAnki, onClose }: Props = $props();

  // Capture selection at mount time (before it might be cleared)
  const selection = window.getSelection()?.toString().trim() || '';
  const hasSelection = selection.length > 0;

  // Full text from all lines
  const fullText = lines.join('');
  const fullTextStripped = fullText.replace(/[\n\r\t]/g, '');

  // Adjust position to keep menu in viewport
  let menuElement: HTMLDivElement | undefined = $state();
  let adjustedX = $state(x);
  let adjustedY = $state(y);

  $effect(() => {
    if (menuElement) {
      const rect = menuElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust X if menu would overflow right edge
      if (x + rect.width > viewportWidth) {
        adjustedX = x - rect.width;
      } else {
        adjustedX = x;
      }

      // Adjust Y if menu would overflow bottom edge
      if (y + rect.height > viewportHeight) {
        adjustedY = y - rect.height;
      } else {
        adjustedY = y;
      }
    }
  });

  function copySelection() {
    const text = selection.replace(/[\n\r\t]/g, '');
    navigator.clipboard.writeText(text);
    onCopy();
    onClose();
  }

  function copySelectionRaw() {
    navigator.clipboard.writeText(selection);
    onCopyRaw();
    onClose();
  }

  function copyAll() {
    navigator.clipboard.writeText(fullTextStripped);
    onCopy();
    onClose();
  }

  function copyAllRaw() {
    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    onCopyRaw();
    onClose();
  }

  function handleAddToAnki() {
    onAddToAnki(selection);
    onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onclick={onClose} onkeydown={handleKeydown} />

<div
  bind:this={menuElement}
  class="context-menu"
  style:left="{adjustedX}px"
  style:top="{adjustedY}px"
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
  oncontextmenu={(e) => e.preventDefault()}
  role="menu"
  tabindex="-1"
>
  {#if hasSelection}
    <!-- Selection-specific options -->
    <button type="button" class="menu-item" onclick={copySelection}>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy selection</span>
    </button>
    <button type="button" class="menu-item" onclick={copySelectionRaw}>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        <line x1="12" y1="13" x2="19" y2="13"></line>
        <line x1="12" y1="17" x2="19" y2="17"></line>
      </svg>
      <span>Copy selection with line breaks</span>
    </button>
  {:else}
    <!-- No selection - copy full text box -->
    <button type="button" class="menu-item" onclick={copyAll}>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy all</span>
    </button>
    <button type="button" class="menu-item" onclick={copyAllRaw}>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        <line x1="12" y1="13" x2="19" y2="13"></line>
        <line x1="12" y1="17" x2="19" y2="17"></line>
      </svg>
      <span>Copy all with line breaks</span>
    </button>
  {/if}
  {#if ankiEnabled}
    <div class="divider"></div>
    <button type="button" class="menu-item" onclick={handleAddToAnki}>
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      <span>Add to Anki</span>
    </button>
  {/if}
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 9999;
    min-width: 160px;
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    box-shadow:
      0 10px 15px -3px rgb(0 0 0 / 0.1),
      0 4px 6px -4px rgb(0 0 0 / 0.1);
    padding: 0.25rem 0;
    font-size: 0.875rem;
  }

  :global(.dark) .context-menu {
    background-color: #1f2937;
    border-color: #374151;
    color: #f3f4f6;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font-size: inherit;
  }

  .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .menu-item:hover {
    background-color: #f3f4f6;
  }

  :global(.dark) .menu-item:hover {
    background-color: #374151;
  }

  .divider {
    height: 1px;
    margin: 0.25rem 0;
    background-color: #e5e7eb;
  }

  :global(.dark) .divider {
    background-color: #374151;
  }
</style>
