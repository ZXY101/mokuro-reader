<script lang="ts">
  import { AccordionItem } from 'flowbite-svelte';
  import { page } from '$app/stores';
  import { isReader } from '$lib/util';
</script>

{#if isReader()}
  <AccordionItem>
    <span slot="header">Volume settings</span>
    <div class="flex flex-col gap-5">sdafsd</div>
    <div class="flex flex-col gap-5">sdafsd</div>
    <div class="flex flex-col gap-5">sdafsd</div>
  </AccordionItem>
{/if}
