// Firma de la versión release de Android con la clave propia de Hachiko.
//
// Expo genera android/app/build.gradle firmando el release con la clave de
// depuración (cualquiera puede tenerla). Este plugin agrega una firma "release"
// que lee el almacén de claves desde propiedades de Gradle, que el workflow de
// GitHub pasa desde secrets:
//   -PHACHIKO_UPLOAD_STORE_FILE=/ruta/hachiko-release.jks
//   -PHACHIKO_UPLOAD_STORE_PASSWORD=…  -PHACHIKO_UPLOAD_KEY_ALIAS=…  -PHACHIKO_UPLOAD_KEY_PASSWORD=…
// Sin esas propiedades el build sigue funcionando con la clave de depuración
// (solo para pruebas); el workflow nunca publica un release así.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (project.hasProperty('HACHIKO_UPLOAD_STORE_FILE')) {
                storeFile file(HACHIKO_UPLOAD_STORE_FILE)
                storePassword HACHIKO_UPLOAD_STORE_PASSWORD
                keyAlias HACHIKO_UPLOAD_KEY_ALIAS
                keyPassword HACHIKO_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('HACHIKO_UPLOAD_STORE_FILE')) return cfg;

    // 1) Declarar la firma release dentro de signingConfigs { … }
    const before = gradle;
    gradle = gradle.replace(/(signingConfigs\s*\{)/, `$1${RELEASE_SIGNING}`);
    if (gradle === before) throw new Error('withReleaseSigning: no se encontró signingConfigs en build.gradle');

    // 2) Que el buildType release la use cuando hay clave (si no, la de depuración)
    const releaseBlock = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseBlock.test(gradle)) throw new Error('withReleaseSigning: no se encontró la firma del buildType release');
    gradle = gradle.replace(
      releaseBlock,
      "$1signingConfig project.hasProperty('HACHIKO_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
