// Single source of truth for the application version.
// The actual value is read from package.json so it stays in one place.
import { version } from '../package.json';
export const APP_VERSION = version;
