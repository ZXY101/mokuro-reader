<script lang="ts">
  import { A, Fileupload, Label } from 'flowbite-svelte';

  interface Props {
    files?: FileList | undefined;
    onUpload?: ((files: FileList) => void) | undefined;
    children?: import('svelte').Snippet;
    [key: string]: any
  }

  let { files = $bindable(undefined), onUpload = undefined, children, ...rest }: Props = $props();

  // Create a unique ID for the input
  const inputId = `file-input-${Math.random().toString(36).substring(2, 9)}`;

  $effect(() => {
    if (files && onUpload) {
      onUpload(files);
    }
  });
</script>

<label for={inputId} class="inline-flex items-center hover:underline text-primary-600 dark:text-primary-500 cursor-pointer">
  {#if children}{@render children()}{:else}Upload{/if}
</label>

<input
  id={inputId}
  type="file"
  bind:files
  {...rest}
  class="hidden"
/>
