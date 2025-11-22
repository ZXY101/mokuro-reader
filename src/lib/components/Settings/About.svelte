<script lang="ts">
  import { READER_VERSION } from '$lib/consts';
  import { toClipboard } from '$lib/util';
  import { A, AccordionItem, Helper } from 'flowbite-svelte';
  import { GithubSolid } from 'flowbite-svelte-icons';
</script>

<AccordionItem>
  <span slot="header">About</span>
  <div class="flex flex-col gap-5">
    <div class="flex flex-row justify-between">
      <p class="font-semibold">Mokuro reader {READER_VERSION}</p>
      <a
        class="hover:text-primary-600"
        href="https://github.com/ZXY101/mokuro-reader"
        target="_blank"
      >
        <GithubSolid />
      </a>
    </div>
    <p>
      An online reader, gallery and stat tracker for <A href="https://github.com/kha-white/mokuro"
        >mokuro</A
      > processed manga.
    </p>
    <div>
      <p>
        To use the reader, manga must be processed with mokuro <A
          href="https://github.com/kha-white/mokuro/releases/tag/v0.2.2">0.2.0</A
        > or higher, which can be installed with:
      </p>
      <div role="none" onclick={toClipboard}>
        <code class="text-primary-600 bg-slate-900">pip3 install mokuro</code>
      </div>
    </div>
    <p>
      Once processed, upload your manga along with the <span class="text-primary-500">.mokuro</span>
      file.
    </p>
    <Helper
      >Created by <A href="https://github.com/ZXY101">ZXY101</A>, <A
        href="https://github.com/kha-white">kha-white</A
      > and <A href="https://github.com/Gnathonic">Gnathonic</A></Helper
    >
  </div>
</AccordionItem>
