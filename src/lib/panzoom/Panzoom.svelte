<script lang="ts">
	import { initPanzoom } from './util';
</script>

<div>
	<div class="container" use:initPanzoom>
		<slot />
	</div>
</div>

<style>
	.container {
		display: flex;
		justify-content: center;
	}
</style>
