import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const python = process.env.PYTHON_PATH || join(root, '.venv', ...(process.platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']));
