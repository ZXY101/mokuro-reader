<script lang="ts">
    import { AccordionItem, Kbd } from 'flowbite-svelte';
  </script>
  
  <AccordionItem>
    <span slot="header">Keyboard Shortcuts</span>
    <div class="flex flex-col gap-3">
        <p class="flex justify-between">
            <span class="font-bold">Left Page:</span>
            <span>
                <Kbd class="px-2 py-1.5">←</Kbd> | 
                <Kbd class="px-2 py-1.5">A</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Right Page:</span>
            <span>
                <Kbd class="px-2 py-1.5">→</Kbd> | 
                <Kbd class="px-2 py-1.5">D</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Scroll Up:</span>
            <span> 
                <Kbd class="px-2 py-1.5">W</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Scroll Down:</span>
            <span>
                <Kbd class="px-2 py-1.5">S</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Next Page:</span>
            <span>
                <Kbd class="px-2 py-1.5">↓</Kbd> | 
                <Kbd class="px-2 py-1.5">PgDn</Kbd> | 
                <Kbd class="px-2 py-1.5">Space</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Prev Page:</span>
            <span>
                <Kbd class="px-2 py-1.5">↑</Kbd> | 
                <Kbd class="px-2 py-1.5">PgUp</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">First Page:</span>
            <span>
                <Kbd class="px-2 py-1.5">Home</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Last Page:</span>
            <span>
                <Kbd class="px-2 py-1.5">End</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Toggle Fullscreen:</span>
            <span>
                <Kbd class="px-2 py-1.5">F</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Reset Pan/Zoom:</span>
            <span>
                <Kbd class="px-2 py-1.5">R</Kbd>
            </span>
        </p>
        <p class="flex justify-between">
            <span class="font-bold">Toggle Cover:</span>
            <span>
                <Kbd class="px-2 py-1.5">C</Kbd>
            </span>
        </p>
      </div>
      
  </AccordionItem>
  