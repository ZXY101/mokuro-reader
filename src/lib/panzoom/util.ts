import { settings, type ZoomModes } from '$lib/settings';
import panzoom from 'panzoom';
import type { PanZoom } from 'panzoom';
import { get, writable } from 'svelte/store';

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
    onTouch: (e) => e.touches.length > 1,
    // Panzoom typing is wrong here
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    filterKey: (e: any) => {
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        return true;
      }
    }
  });

  panzoomStore.set(pz);
}

type PanX = 'left' | 'center' | 'right';
type PanY = 'top' | 'center' | 'bottom';

export function panAlign(alignX: PanX, alignY: PanY) {
  if (!pz || !container) {
    return;
  }

  const { scale } = pz.getTransform();
  const { innerWidth, innerHeight } = window;
  const { offsetWidth, offsetHeight } = container;

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
      x = innerWidth - offsetWidth * scale;
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
      y = innerHeight - offsetHeight * scale;
      break;
  }

  pz?.moveTo(x, y);
}

export function zoomOriginal() {
  pz?.moveTo(0, 0);
  pz?.zoomTo(0, 0, 1 / pz.getTransform().scale);
  panAlign('center', 'center');
}

export function zoomFitToWidth() {
  if (!pz || !container) {
    return;
  }
  const { innerWidth } = window;

  const scale = (1 / pz.getTransform().scale) * (innerWidth / container.offsetWidth);

  pz.moveTo(0, 0);
  pz.zoomTo(0, 0, scale);
  panAlign('center', 'top');
}

export function zoomFitToScreen() {
  if (!pz || !container) {
    return;
  }
  const { innerWidth, innerHeight } = window;
  const scaleX = innerWidth / container.offsetWidth;
  const scaleY = innerHeight / container.offsetHeight;
  const scale = (1 / pz.getTransform().scale) * Math.min(scaleX, scaleY);
  pz.moveTo(0, 0);
  pz.zoomTo(0, 0, scale);
  panAlign('center', 'center');
}

export function keepZoomStart() {
  panAlign('center', 'top');
}

export function zoomDefault() {
  const zoomDefault = get(settings).zoomDefault;
  switch (zoomDefault) {
    case 'zoomFitToScreen':
      zoomFitToScreen();
      return;
    case 'zoomFitToWidth':
      zoomFitToWidth();
      return;
    case 'zoomOriginal':
      zoomOriginal();
      return;
    case 'keepZoomStart':
      keepZoomStart();
      return;
  }
}
