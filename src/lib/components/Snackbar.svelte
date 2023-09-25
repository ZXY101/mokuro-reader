<script lang="ts">
  import { snackbarStore } from '$lib/util/snackbar';
  import { Toast } from 'flowbite-svelte';
</script>

{#if $snackbarStore?.message && $snackbarStore?.visible}
  <Toast position="bottom-right" class="z-50">{$snackbarStore?.message}</Toast>
{/if}
