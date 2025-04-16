<script lang="ts">
  import { settings } from '$lib/settings';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';

  // Create elements to hold our filter
  let styleElement: HTMLStyleElement | null = null;
  let svgElement: SVGElement | null = null;
  let canvasElement: HTMLCanvasElement | null = null;
  let isFirefox = false;
  let isMobile = false;

  // Function to detect browser
  function detectBrowser() {
    if (!browser) return;
    
    isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Function to apply the night mode filter
  function applyNightModeFilter() {
    if (!browser) return;
    
    // Detect browser
    detectBrowser();
    
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
      if (isFirefox || isMobile) {
        // For Firefox and mobile browsers, use a CSS-only approach
        styleElement.textContent = `
          /* Convert everything to red using CSS */
          
          /* Base filter for the entire page */
          html {
            filter: grayscale(100%) !important;
          }
          
          /* Apply red color to text elements */
          body, div, span, p, h1, h2, h3, h4, h5, h6, 
          a, button, input, select, textarea, label {
            color: #ff0000 !important;
          }
          
          /* Keep black text black */
          [style*="color: #000"], 
          [style*="color: black"], 
          [style*="color: rgb(0, 0, 0)"], 
          [style*="color: rgba(0, 0, 0"] {
            color: #000000 !important;
          }
          
          /* Handle images and media */
          img, video, canvas {
            filter: grayscale(100%) brightness(0.8) !important;
          }
          
          /* Handle SVG elements */
          svg * {
            stroke: #ff0000 !important;
            fill: #ff0000 !important;
          }
          
          /* Keep black SVG elements black */
          svg [stroke="#000000"], 
          svg [stroke="black"],
          svg [fill="#000000"],
          svg [fill="black"] {
            stroke: #000000 !important;
            fill: #000000 !important;
          }
          
          /* Handle form elements */
          input, select, textarea, button {
            background-color: #330000 !important;
            border-color: #ff0000 !important;
          }
          
          /* Handle links */
          a:link, a:visited, a:hover, a:active {
            color: #ff0000 !important;
          }
          
          /* Handle backgrounds */
          [style*="background-color"] {
            background-color: #000000 !important;
          }
          
          /* Remove background images */
          [style*="background-image"] {
            background-image: none !important;
          }
        `;
      } else {
        // Chrome-based browsers implementation using SVG filter
        styleElement.textContent = `
          html {
            filter: url('#night-mode-filter') !important;
          }
        `;
      }
    } else {
      // Turn off night mode
      styleElement.textContent = '';
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
      if (canvasElement) {
        canvasElement.remove();
      }
    }
  });
</script>

<!-- This component doesn't render any visible elements, it just applies the filter -->