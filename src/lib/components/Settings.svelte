<script lang="ts">
	import { Drawer, CloseButton, Toggle, Select, Input, Label, Button } from 'flowbite-svelte';
	import { UserSettingsSolid } from 'flowbite-svelte-icons';
	import { sineIn } from 'svelte/easing';
	import { resetSettings, settings, updateSetting } from '$lib/settings';
	import { promptConfirmation } from '$lib/util';

	let transitionParams = {
		x: 320,
		duration: 200,
		easing: sineIn
	};

	export let hidden = true;

	let selected = 'us';

	let countries = [
		{ value: 'us', name: 'auto' },
		{ value: 'ca', name: 'Canada' },
		{ value: 'fr', name: 'France' }
	];

	$: toggles = [
		{ key: 'rightToLeft', text: 'Right to left', value: $settings.rightToLeft },
		{ key: 'singlePageView', text: 'Single page view', value: $settings.singlePageView },
		{ key: 'textEditable', text: 'Editable text', value: $settings.textEditable },
		{ key: 'textBoxBorders', text: 'Text box borders', value: $settings.textBoxBorders },
		{ key: 'displayOCR', text: 'OCR enabled', value: $settings.displayOCR },
		{ key: 'boldFont', text: 'Bold font', value: $settings.boldFont }
	];

	function onChange(event: Event) {
		updateSetting('backgroundColor', (event.target as HTMLInputElement).value);
	}

	function onReset() {
		hidden = true;
		promptConfirmation('Restore default settings?', resetSettings);
	}
</script>

<Drawer
	placement="right"
	transitionType="fly"
	width="lg:w-1/4 md:w-1/2 w-full"
	{transitionParams}
	bind:hidden
	id="settings"
>
	<div class="flex items-center">
		<h5 id="drawer-label" class="inline-flex items-center mb-4 text-base font-semibold">
			<UserSettingsSolid class="w-4 h-4 mr-2.5" />Settings
		</h5>
		<CloseButton on:click={() => (hidden = true)} class="mb-4 dark:text-white" />
	</div>
	<div class="flex flex-col gap-5">
		{#each toggles as { key, text, value }}
			<Toggle size="small" checked={value} on:change={() => updateSetting(key, !value)}
				>{text}</Toggle
			>
		{/each}
		<div>
			<Label>Fontsize:</Label>
			<Select items={countries} bind:value={selected} />
		</div>
		<div>
			<Label>Background color:</Label>
			<Input type="color" on:change={onChange} value={$settings.backgroundColor} />
		</div>
		<Button outline on:click={onReset}>Reset</Button>
	</div>
</Drawer>
