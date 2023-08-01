import panzoom from 'panzoom';
import type { PanZoom } from 'panzoom';
import { writable } from 'svelte/store';

export const pz = writable<PanZoom | undefined>(undefined);

export function initPanzoom(node: HTMLElement) {
  pz.set(
    panzoom(node, {
      bounds: false,
      maxZoom: 10,
      minZoom: 0.1,
      zoomDoubleClickSpeed: 1,
      enableTextSelection: true,
      beforeMouseDown: (e) => {
        const nodeName = (e.target as HTMLElement).nodeName;
        return nodeName === 'P';
      },
      beforeWheel: (e) => e.altKey,
      onTouch: (e) => e.touches.length > 1
    })
  );
}