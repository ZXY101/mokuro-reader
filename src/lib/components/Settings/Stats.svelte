<script lang="ts">
  import { volumes } from '$lib/settings';
  import { AccordionItem, P } from 'flowbite-svelte';

  $: completed = $volumes
    ? Object.values($volumes).reduce((total: number, { completed }) => {
        if (completed) {
          total++;
        }
        return total;
      }, 0)
    : 0;

  $: pagesRead = $volumes
    ? Object.values($volumes).reduce((total: number, { progress }) => {
        total += progress;
        return total;
      }, 0)
    : 0;

  $: charsRead = $volumes
    ? Object.values($volumes).reduce((total: number, { chars }) => {
        total += chars;
        return total;
      }, 0)
    : 0;

  $: minutesRead = $volumes
    ? Object.values($volumes).reduce((total: number, { timeReadInMinutes }) => {
        total += timeReadInMinutes;
        return total;
      }, 0)
    : 0;
</script>

<AccordionItem>
  <span slot="header">Stats</span>
  <div>
    <p>Completed volumes: {completed}</p>
    <p>Pages read: {pagesRead}</p>
    <p>Characters read: {charsRead}</p>
    <p>Minutes read: {minutesRead}</p>
  </div>
</AccordionItem>
