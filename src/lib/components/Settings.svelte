<script lang="ts">
	import { Drawer, CloseButton, Toggle, Select, Input, Label, Button } from 'flowbite-svelte';
	import { UserSettingsSolid } from 'flowbite-svelte-icons';
	import { sineIn } from 'svelte/easing';
	import { resetSettings, settings, updateSetting } from '$lib/settings';
	import type { SettingsKey } from '$lib/settings';
	import { promptConfirmation } from '$lib/util';

	let transitionParams = {
		x: 320,
		duration: 200,
		easing: sineIn
	};

	export let hidden = true;

	let selected = 'auto';

	let fontSizes = [
		{ value: 'auto', name: 'auto' },
		{ value: '9', name: '9' },
		{ value: '10', name: '10' },
		{ value: '11', name: '11' },
		{ value: '12', name: '12' },
		{ value: '14', name: '14' },
		{ value: '16', name: '16' },
		{ value: '18', name: '18' },
		{ value: '20', name: '20' },
		{ value: '24', name: '24' },
		{ value: '32', name: '32' },
		{ value: '40', name: '40' },
		{ value: '48', name: '48' },
		{ value: '60', name: '60' }
	];

	$: toggles = [
		{ key: 'rightToLeft', text: 'Right to left', value: $settings.rightToLeft },
		{ key: 'singlePageView', text: 'Single page view', value: $settings.singlePageView },
		{ key: 'hasCover', text: 'First page is cover', value: $settings.hasCover },
		{ key: 'textEditable', text: 'Editable text', value: $settings.textEditable },
		{ key: 'textBoxBorders', text: 'Text box borders', value: $settings.textBoxBorders },
		{ key: 'displayOCR', text: 'OCR enabled', value: $settings.displayOCR },
		{ key: 'boldFont', text: 'Bold font', value: $settings.boldFont },
		{ key: 'pageNum', text: 'Show page number', value: $settings.pageNum }
	] as { key: SettingsKey; text: string; value: any }[];

	function onBackgroundColor(event: Event) {
		updateSetting('backgroundColor', (event.target as HTMLInputElement).value);
	}

	function onFontSize(event: Event) {
		updateSetting('fontSize', (event.target as HTMLInputElement).value);
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
			<Select items={fontSizes} bind:value={selected} on:change={onFontSize} />
		</div>
		<div>
			<Label>Background color:</Label>
			<Input type="color" on:change={onBackgroundColor} value={$settings.backgroundColor} />
		</div>
		<Button outline on:click={onReset}>Reset</Button>
	</div>
</Drawer>
