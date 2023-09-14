<script lang="ts">
	import Reader from '$lib/components/Reader/Reader.svelte';
	import { settingsStore } from '$lib/settings';
</script>

<div style:background-color={$settingsStore.backgroundColor}><Reader /></div>
