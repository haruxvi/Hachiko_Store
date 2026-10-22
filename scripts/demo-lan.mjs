#!/usr/bin/env node
// Demo de Hachiko en un teléfono real, en UN comando:
//
//   node scripts/demo-lan.mjs
//
// 1. Detecta la IP de este computador en el Wi-Fi.
// 2. Levanta el entorno Docker aislado (base propia con datos de prueba; nunca
//    toca Neon) publicado también en esa IP.
// 3. Abre Expo con la app ya apuntando a ese Docker: se escanea el QR con el
//    teléfono (conectado al MISMO Wi-Fi) y listo. Expo Go con SDK 57 exige sesión
//    de Expo en ambos lados: en el PC basta con un token en EXPO_TOKEN.
// 4. Al cerrar Expo (Ctrl+C), el Docker vuelve a quedar solo en este computador.
//
// Opciones:
//   --ip=192.168.1.20   usar esta IP en vez de detectarla
//   --no-expo           solo levantar el Docker en la red
//   --keep              no cerrar el Docker a la red al salir
//   --dry-run           mostrar qué haría, sin ejecutar nada
//
// Solo usa Node (sin dependencias). Requiere Docker Desktop abierto.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(ROOT, 'mobile');
const args = new Set(process.argv.slice(2));
const flag = (name) => args.has(`--${name}`);
const ipArg = process.argv.slice(2).find((a) => a.startsWith('--ip='))?.slice(5);
const isWin = process.platform === 'win32';

const say = (msg = '') => console.log(msg);
const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

// ── 1. IP del Wi-Fi ─────────────────────────────────────────────────────────
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
// Adaptadores virtuales: sus IPs no son alcanzables desde el teléfono.
const VIRTUAL = /vEthernet|WSL|Docker|docker0|^br-|virbr|VirtualBox|VMware|Hyper-V|vboxnet|vmnet|bridge|utun|tailscale|zerotier|Loopback/i;
const WIFI = /wi-?fi|wlan|wireless|^en0$|^wlp/i;

function detectIp() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (VIRTUAL.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal && PRIVATE.test(a.address)) candidates.push({ name, ip: a.address });
    }
  }
  candidates.sort((a, b) => Number(WIFI.test(b.name)) - Number(WIFI.test(a.name)));
  return candidates;
}

const candidates = detectIp();
const ip = ipArg ?? process.env.HACHIKO_LAN_IP ?? candidates[0]?.ip;
if (!ip) fail('No encontré una IP de red local. Conéctate a un Wi-Fi (o al hotspot del teléfono) e intenta de nuevo, o indícala con --ip=...');
if (!PRIVATE.test(ip)) fail(`${ip} no es una IP de red privada. Por seguridad la demo solo se publica en redes locales.`);

const API_URL = `http://${ip}:3000`;
const env = { ...process.env, HACHIKO_LAN_IP: ip };
const COMPOSE_LAN = ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.lan.yml', 'up', '-d', '--build'];
const COMPOSE_LOCAL = ['compose', 'up', '-d'];

say('\n🐕  Hachiko · demo en red local\n');
say(`   IP de este computador: ${ip}${candidates.length > 1 && !ipArg ? `  (otras: ${candidates.slice(1).map((c) => c.ip).join(', ')}; usa --ip=... si no es la del Wi-Fi)` : ''}`);
say(`   API para el teléfono:  ${API_URL}`);
say('   Base de datos: Docker local con datos de prueba (Neon no se toca).');
say('\n   ⚠️  Usa solo una red de confianza (casa o hotspot propio): quien esté en el');
say('      mismo Wi-Fi puede abrir el sitio de desarrollo.\n');

if (flag('dry-run')) {
  say(`   [dry-run] docker ${COMPOSE_LAN.join(' ')}   (HACHIKO_LAN_IP=${ip})`);
  if (!flag('no-expo')) say(`   [dry-run] cd mobile && npx expo start --lan --clear   (EXPO_PUBLIC_API_URL=${API_URL})`);
  process.exit(0);
}

// ── 2. Docker ───────────────────────────────────────────────────────────────
const run = (cmd, argv, opts = {}) =>
  spawnSync(cmd, argv, { cwd: ROOT, stdio: 'inherit', shell: isWin, env, ...opts });

if (spawnSync('docker', ['info'], { stdio: 'ignore', shell: isWin }).status !== 0) {
  fail('Docker no responde. Abre Docker Desktop, espera a que diga "running" y vuelve a intentar.');
}

say('==> Levantando el entorno Docker (la primera vez tarda varios minutos: construye la imagen y carga datos de prueba)…');
if (run('docker', COMPOSE_LAN).status !== 0) fail('No se pudo levantar Docker. Revisa el mensaje de arriba.');

say('==> Esperando a que el sitio responda…');
const deadline = Date.now() + 15 * 60 * 1000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      ready = true;
      break;
    }
  } catch {
    // aún arrancando
  }
  await new Promise((r) => setTimeout(r, 5000));
  process.stdout.write('.');
}
say();
if (!ready) fail('El sitio no respondió a tiempo. Mira los logs con: docker compose logs app');

say(`\n✔ Sitio listo:   en este PC http://localhost:3000   ·   desde el teléfono ${API_URL}`);
say('  Cuentas de prueba:');
say('    Vendedor: vendedor@hachiko.local  /  Vendedor.Local2026');
say('    Cliente:  cliente@hachiko.local   /  Cliente.Local2026');
say('  Si el teléfono no carga la página: en Windows marca este Wi-Fi como red "Privada"');
say('  y permite Docker y Node en el firewall; algunas redes (universidad, café) aíslan');
say('  los dispositivos entre sí: ahí usa el hotspot de tu teléfono.\n');

if (flag('no-expo')) {
  say('  Docker queda publicado en la red. Para cerrarlo a solo este PC: docker compose up -d');
  process.exit(0);
}

// ── 3. Expo ─────────────────────────────────────────────────────────────────
if (!existsSync(join(MOBILE, 'node_modules'))) {
  say('==> Instalando dependencias de la app (solo la primera vez)…');
  if (run('npm', ['install', '--no-package-lock', '--no-audit', '--no-fund'], { cwd: MOBILE }).status !== 0) {
    fail('No se pudieron instalar las dependencias de la app.');
  }
}

// En Windows, `expo login --browser` se cae (pasa la URL a `cmd start` sin comillas y
// el `&` la corta); con un token de acceso en EXPO_TOKEN no hace falta el navegador.
if (run('npx', ['expo', 'whoami'], { cwd: MOBILE, stdio: 'ignore' }).status !== 0) {
  fail(
    'Expo Go (SDK 57) exige sesión de Expo en este PC y en la app.\n' +
      '   1. En expo.dev → Settings → Access tokens, crea un token.\n' +
      "   2. En esta terminal: $env:EXPO_TOKEN = '<tu token>'   (solo vive en esta terminal)\n" +
      '   3. Vuelve a ejecutar: node scripts/demo-lan.mjs',
  );
}
say('    En el iPhone, inicia sesión en Expo Go con la MISMA cuenta (Home → ícono de perfil).');

say('==> Abriendo Expo: escanea el QR con la cámara del teléfono (iPhone) o con Expo Go (Android).');
say('    Para terminar: Ctrl+C.\n');
// Desde el SDK 57, Expo Go en un iPhone físico exige sesión iniciada con la misma
// cuenta en el CLI (npx expo login) y en la app; --offline no lo evita.
const expo = spawn('npx', ['expo', 'start', '--lan', '--clear'], {
  cwd: MOBILE,
  stdio: 'inherit',
  shell: isWin,
  env: {
    ...env,
    // Las variables del entorno tienen prioridad sobre mobile/.env.local.
    EXPO_PUBLIC_API_URL: API_URL,
    // El QR debe anunciar la IP del Wi-Fi, no la de un adaptador virtual.
    REACT_NATIVE_PACKAGER_HOSTNAME: ip,
  },
});

// ── 4. Al salir, cerrar el Docker a la red ──────────────────────────────────
let closing = false;
function closeToLocal() {
  if (closing) return;
  closing = true;
  if (flag('keep')) {
    say('\n  Docker sigue publicado en la red (--keep). Para cerrarlo: docker compose up -d');
    return;
  }
  say('\n==> Cerrando el Docker a la red: vuelve a quedar solo en este computador…');
  spawnSync('docker', COMPOSE_LOCAL, { cwd: ROOT, stdio: 'ignore', shell: isWin });
  say('✔ Listo. Para apagarlo del todo: docker compose down');
}
process.on('SIGINT', () => {}); // Ctrl+C lo recibe Expo; nosotros esperamos a que termine
expo.on('exit', (code) => {
  closeToLocal();
  process.exit(code ?? 0);
});
