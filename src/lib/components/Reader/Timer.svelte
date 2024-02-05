<script lang="ts">
  import { volumeStats } from '$lib/settings';

  export let active = true;
</script>

<div
  class:text-primary-700={!active}
  class="mix-blend-difference z-10 fixed opacity-50 right-20 top-5 p-10 m-[-2.5rem]"
>
  <p>{active ? 'Timer active' : 'Timer idle'} | Minutes read: {$volumeStats?.timeReadInMinutes}</p>
</div>
