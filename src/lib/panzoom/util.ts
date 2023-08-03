import panzoom from 'panzoom';
import type { PanZoom } from 'panzoom';
import { writable } from 'svelte/store';

let pz: PanZoom | undefined;
let container: HTMLElement | undefined;

export const panzoomStore = writable<PanZoom | undefined>(undefined);

export function initPanzoom(node: HTMLElement) {
  container = node;
  pz = panzoom(node, {
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
  });

  panzoomStore.set(pz)
}

type PanX = 'left' | 'center' | 'right'
type PanY = 'top' | 'center' | 'bottom'

export function panAlign(alignX: PanX, alignY: PanY) {
  if (!pz || !container) {
    return
  }

  const { scale } = pz.getTransform();
  const { innerWidth, innerHeight } = window
  const { offsetWidth, offsetHeight } = container

  let x = 0;
  let y = 0;

  switch (alignX) {
    case 'left':
      x = 0;
      break;
    case 'center':
      x = (innerWidth - offsetWidth * scale) / 2;
      break;
    case 'right':
      x = (innerWidth - offsetWidth * scale);
      break;
  }

  switch (alignY) {
    case 'top':
      y = 0;
      break;
    case 'center':
      y = (innerHeight - offsetHeight * scale) / 2;
      break;
    case 'bottom':
      y = (innerHeight - offsetHeight * scale);
      break;
  }

  pz?.moveTo(x, y)
}

export function zoomOriginal() {
  pz?.moveTo(0, 0);
  pz?.zoomTo(0, 0, 1 / pz.getTransform().scale);
  panAlign('center', 'center');
}