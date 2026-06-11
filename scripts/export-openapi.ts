// Exporta la especificación OpenAPI a docs/api/openapi.json para revisión
// humana y herramientas externas (Redocly, Postman, etc.).
// Uso: pnpm docs:api
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openApiSpec } from '../src/lib/docs/openapi';

const outDir = join(__dirname, '..', 'docs', 'api');
mkdirSync(outDir, { recursive: true });

const outFile = join(outDir, 'openapi.json');
writeFileSync(outFile, JSON.stringify(openApiSpec, null, 2) + '\n', 'utf8');

console.log(`OpenAPI spec escrita en ${outFile}`);
