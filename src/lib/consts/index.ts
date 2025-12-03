import pkg from '../../../package.json';

export const READER_VERSION = pkg.version;

// Configurable via env var - defaults to upstream, use fork for beta/dev builds
// Set VITE_GITHUB_REPO=Gnathonic/mokuro-reader for beta deployments
export const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'ZXY101/mokuro-reader';
