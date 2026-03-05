const { join } = require('node:path');

const REQUIRED_ENV_VARS = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];

module.exports = async function notarizeMacApp(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const missing = REQUIRED_ENV_VARS.filter((envVar) => !process.env[envVar]);
  if (missing.length > 0) {
    console.log(
      `[notarize] Skipping notarization. Missing secrets: ${missing.join(', ')}.`
    );
    console.log(
      '[notarize] Configure APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID in CI to enable notarization.'
    );
    return;
  }

  const { notarize } = require('@electron/notarize');
  const appName = context.packager.appInfo.productFilename;
  const appPath = join(context.appOutDir, `${appName}.app`);

  console.log(`[notarize] Submitting ${appPath} for notarization...`);
  await notarize({
    appBundleId: context.packager.appInfo.id,
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
  console.log('[notarize] Notarization completed.');
};
