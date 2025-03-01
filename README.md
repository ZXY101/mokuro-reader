# Mokuro reader 

An online reader, gallery and stat tracker for [mokuro](https://github.com/kha-white/mokuro) processed manga.

https://github.com/ZXY101/mokuro-reader/assets/39561296/45a214a8-3f69-461c-87d7-25b17dea3060

## Features:
- Stat tracking (volumes read, pages read, characters read & minutes read)
- Extensive customization and profile support
- Anki connect integration & image cropping
- Installation and offline support

## Usage:
You can find the reader hosted [here](https://reader.mokuro.app/).

To import your manga, process it with mokuro and then upload your manga along with the generated `.mokuro` file.

As of the moment base mokuro does not generate the `.mokuro` file, you need to install and use `mokuro 0.2.0-beta.6`.

```bash
pip install git+https://github.com/kha-white/mokuro.git@web-reader
```

Once installed and your manga is processed, import your manga into the reader.

## Development:

### Requirements
- **Node.js version 18.x** (this project is not compatible with Node.js 19+ or earlier versions)
- npm

You can use [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions:
```bash
# Install Node.js 18
nvm install 18
# Use Node.js 18
nvm use 18
```

Clone the repo:
```bash
git clone https://github.com/ZXY101/mokuro-reader
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
