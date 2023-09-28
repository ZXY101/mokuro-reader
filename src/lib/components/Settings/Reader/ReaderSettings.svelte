<script lang="ts">
  import { AccordionItem } from 'flowbite-svelte';
  import ReaderSelects from './ReaderSelects.svelte';
  import ReaderToggles from './ReaderToggles.svelte';
  import { isReader } from '$lib/util';
</script>

<AccordionItem open={isReader()}>
  <span slot="header">Reader</span>
  <div class="flex flex-col gap-5">
    <ReaderSelects />
    <hr class="border-gray-100 opacity-10" />
    <ReaderToggles />
  </div>
</AccordionItem>
