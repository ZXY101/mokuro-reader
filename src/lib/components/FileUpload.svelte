<script lang="ts">
  import { A, Fileupload, Label } from 'flowbite-svelte';

  export let files: FileList | undefined = undefined;
  export let onUpload: ((files: FileList) => void) | undefined = undefined;

  let input: HTMLInputElement;

  function handleChange() {
    if (files && onUpload) {
      onUpload(files);
    }
  }

  function onClick() {
    input.click();
  }
</script>

<input
  type="file"
  bind:files
  bind:this={input}
  on:change={handleChange}
  {...$$restProps}
  class="hidden"
/>

<A on:click={onClick}><slot>Upload</slot></A>
