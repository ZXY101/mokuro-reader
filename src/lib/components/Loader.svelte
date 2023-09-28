<script lang="ts">
  import { Spinner } from 'flowbite-svelte';
</script>

<div class="flex flex-col gap-5 items-center justify-center h-full p-10">
  <Spinner size={'8'} />
  <slot>Loading...</slot>
</div>
