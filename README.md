# Mokuro reader 

An online reader, gallery and stat tracker for [mokuro](https://github.com/kha-white/mokuro) processed manga.

https://github.com/ZXY101/mokuro-reader/assets/39561296/45a214a8-3f69-461c-87d7-25b17dea3060

## Features:
- Stat tracking (volumes read, pages read, characters read & minutes read)
- Extensive customization and profile support
- Anki connect integration & image cropping
- Installation and offline support
- CBZ file support for import and export
- Google Drive integration for cloud storage
- Smart sorting for manga files
- Memory-efficient processing for mobile devices
- Collapsible progress tracker for background operations

## Usage:
You can find the reader hosted [here](https://reader.mokuro.app/).

To import your manga, process it with mokuro and then upload your manga along with the generated `.mokuro` file.

As of the moment base mokuro does not generate the `.mokuro` file, you need to install and use `mokuro 0.2.0-beta.6`.

```bash
pip install git+https://github.com/kha-white/mokuro.git@web-reader
```

Once installed and your manga is processed, import your manga into the reader.

### Importing Files
You can import manga in several ways:
- Upload local files (folders, zip files, or CBZ files)
- Import directly from Google Drive
- Select multiple files and folders at once

### Exporting to CBZ
You can export your manga to CBZ format with various options:
- Include mokuro data in the CBZ file
- Customize filenames
- Export individual volumes

## Development:

### Requirements
- Node.js (latest LTS version recommended)
- npm

Clone the repo:
```bash
git clone https://github.com/Gnathonic/mokuro-reader
cd mokuro-reader
```

Install dependencies:
```bash
npm install
```

Start the dev server:
```bash
npm run dev
```

### Testing
Run the tests:
```bash
npm test
```

Generate test coverage report:
```bash
npm run test:coverage
```

### Technology Stack
- **Svelte 5**: Latest version of the Svelte framework
- **SvelteKit 2**: Full-stack framework for building web applications
- **Vite 6**: Next generation frontend tooling
- **TypeScript**: For type safety and better developer experience
- **Tailwind CSS**: Utility-first CSS framework
- **Flowbite**: UI component library built on top of Tailwind CSS
- **Vitest**: Testing framework compatible with Vite
