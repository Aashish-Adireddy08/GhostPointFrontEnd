import manifest from '../package.json';

export const appVersion = manifest.version;
export const buildCommit = (import.meta.env.VITE_BUILD_COMMIT || 'development').slice(0, 7);
