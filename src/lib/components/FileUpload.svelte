<script lang="ts">
  import { A, Fileupload, Label } from 'flowbite-svelte';

  interface Props {
    files?: FileList | undefined;
    onUpload?: ((files: FileList) => void) | undefined;
    children?: import('svelte').Snippet;
    [key: string]: any
  }

  let { files = $bindable(undefined), onUpload = undefined, children, ...rest }: Props = $props();

  let input: HTMLInputElement = $state();

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
  onchange={handleChange}
  {...rest}
  class="hidden"
/>

<A on:click={onClick}>{#if children}{@render children()}{:else}Upload{/if}</A>
