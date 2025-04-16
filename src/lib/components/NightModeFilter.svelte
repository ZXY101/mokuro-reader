<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Create elements to hold our filter
  let styleElement: HTMLStyleElement | null = null;
  let svgElement: SVGElement | null = null;
  let overlayElement: HTMLDivElement | null = null;
  let isFirefox = false;

  // Function to detect Firefox
  function detectFirefox() {
    if (!browser) return false;
    return navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
  }

  // Function to apply the night mode filter
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Detect Firefox
    isFirefox = detectFirefox();
    
    // Create style element if it doesn't exist
    if (!styleElement) {
      styleElement = document.createElement('style');
      document.head.appendChild(styleElement);
    }
    
    // Create SVG filter element if it doesn't exist (for Chrome-based browsers)
    if (!svgElement) {
      svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgElement.setAttribute('width', '0');
      svgElement.setAttribute('height', '0');
      svgElement.style.position = 'absolute';
      svgElement.style.zIndex = '-9999';
      svgElement.style.visibility = 'hidden';
      
      // This implements a filter that approximates the Flutter color matrix:
      // [-1/3, -1/3, -1/3, 0, 255,  // red channel
      //  0, 0, 0, 0, 0,             // green channel
      //  0, 0, 0, 0, 0,             // blue channel
      //  0, 0, 0, 1, 0]             // alpha channel
      
      svgElement.innerHTML = `
        <defs>
          <filter id="night-mode-filter" color-interpolation-filters="sRGB">
            <!-- Convert to grayscale first -->
            <feColorMatrix type="matrix" 
              values="0.2126 0.7152 0.0722 0 0
                      0.2126 0.7152 0.0722 0 0
                      0.2126 0.7152 0.0722 0 0
                      0 0 0 1 0" />
                      
            <!-- Keep only the red channel -->
            <feColorMatrix type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0" />
          </filter>
        </defs>
      `;
      document.body.appendChild(svgElement);
    }
    
    // Apply the filter
    if ($settings.nightMode) {
      if (isFirefox) {
        // Firefox-specific implementation using a combination of CSS filters and overlay
        styleElement.textContent = `
          html {
            filter: grayscale(100%) !important;
          }
        `;
        
        // Create overlay element for Firefox if it doesn't exist
        if (!overlayElement) {
          overlayElement = document.createElement('div');
          overlayElement.style.position = 'fixed';
          overlayElement.style.top = '0';
          overlayElement.style.left = '0';
          overlayElement.style.width = '100%';
          overlayElement.style.height = '100%';
          overlayElement.style.backgroundColor = 'red';
          overlayElement.style.mixBlendMode = 'multiply';
          overlayElement.style.pointerEvents = 'none';
          overlayElement.style.zIndex = '9999';
          document.body.appendChild(overlayElement);
        }
      } else {
        // Chrome-based browsers implementation using SVG filter
        styleElement.textContent = `
          html {
            filter: url('#night-mode-filter') !important;
          }
        `;
        
        // Remove overlay if it exists (in case user switched browsers)
        if (overlayElement) {
          overlayElement.remove();
          overlayElement = null;
        }
      }
    } else {
      // Turn off night mode
      styleElement.textContent = '';
      
      // Remove overlay if it exists
      if (overlayElement) {
        overlayElement.remove();
        overlayElement = null;
      }
    }
  }

  // Watch for changes to the night mode setting
  $: if (browser && $settings) {
    applyNightModeFilter();
  }

  // Set up and clean up
  onMount(() => {
    applyNightModeFilter();
  });

  onDestroy(() => {
    if (browser) {
      if (styleElement) {
        styleElement.remove();
      }
      if (svgElement) {
        svgElement.remove();
      }
      if (overlayElement) {
        overlayElement.remove();
      }
    }
  });
</script>

<!-- This component doesn't render any visible elements, it just applies the filter -->