<script lang="ts">
	import { initPanzoom } from './util';
</script>

<div>
	<div use:initPanzoom>
		<slot />
	</div>
</div>
