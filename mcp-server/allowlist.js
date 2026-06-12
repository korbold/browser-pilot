import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../config/allowlist.json');

export function listDomains() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')).domains;
}

export function isAllowed(url) {
  try {
    const hostname = new URL(url).hostname;
    return listDomains().some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

export function addDomain(domain) {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  if (!config.domains.includes(domain)) {
    config.domains.push(domain);
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
  return config.domains;
}
