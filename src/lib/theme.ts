export const colors = {
	backgroundColor: '#1b1b20',

	primaryColor: '#2e3042',
	primaryAccentColor: '#263447',

	secondaryColor: '#dfdfe9',
	secondaryAccentColor: ' #adadbb',

	dangerColor: '#be3329',
	dangerAccentColor: '#ddaeb2',
	dangerActivecolor: '#b69092'
};

export function colorAlpha(hex: string, alpha: number) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

	if (result) {
		const { r, g, b } = {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		}
		return `rgba(${r},${g},${b},${alpha})`
	}
}