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
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    throw new Error(`Invalid domain: "${domain}"`);
  }
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  if (!config.domains.includes(domain.toLowerCase())) {
    config.domains.push(domain.toLowerCase());
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
  return config.domains;
}
