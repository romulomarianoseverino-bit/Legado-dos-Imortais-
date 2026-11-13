/**
 * Arquitetura e Esquema de Planejamento para Atualização Centralizada (Web + Android).
 * NOTA: Este módulo define apenas o contrato de metadados HTTPS e avaliação local.
 * Nenhuma distribuição binária real de APK ou loja é simulada nesta fase.
 */

export type DistributionChannel = 'web' | 'android-playstore' | 'android-apk';
export type UpdateUrgency = 'none' | 'optional' | 'required';

export interface AppVersionManifest {
  schemaVersion: 1;
  appId: 'com.legadodosimortais.app';
  publishedAtIso: string;
  web: {
    latestVersion: string;
    minSupportedVersion: string;
    releaseNotes: string;
  };
  android: {
    latestVersionCode: number;
    latestVersionName: string;
    minSupportedVersionCode: number;
    channel: 'play-store-planned' | 'official-https-apk-planned';
    playStoreListingUrl?: string;
    officialApkHttpsUrl?: string;
    apkSha256?: string;
    releaseNotes: string;
  };
}

export interface UpdateEvaluationResult {
  channel: DistributionChannel;
  updateAvailable: boolean;
  urgency: UpdateUrgency;
  targetVersionLabel: string;
  actionType: 'reload-web' | 'play-in-app-update' | 'official-https-link' | 'up-to-date';
  integrityRequired: boolean;
  message: string;
}

export const PLANNED_MANIFEST_SAMPLE: AppVersionManifest = {
  schemaVersion: 1,
  appId: 'com.legadodosimortais.app',
  publishedAtIso: '2026-04-01T00:00:00Z',
  web: {
    latestVersion: '2.0.0',
    minSupportedVersion: '1.0.0',
    releaseNotes: 'Estilos visuais 3D/Cartoon/Anime, criador de personagens 3D e economia rebalanceada.'
  },
  android: {
    latestVersionCode: 1,
    latestVersionName: '1.0',
    minSupportedVersionCode: 1,
    channel: 'official-https-apk-planned',
    releaseNotes: 'Versão base Android Capacitor (build futuro via GitHub Actions).'
  }
};

export function compareSemver(a: string, b: string): number {
  const pa = String(a || '0.0.0')
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0.0.0')
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function evaluateUpdateAvailability(
  channel: DistributionChannel,
  currentWebVersion: string,
  currentAndroidVersionCode: number,
  manifest: AppVersionManifest
): UpdateEvaluationResult {
  if (channel === 'web') {
    const belowMin = compareSemver(currentWebVersion, manifest.web.minSupportedVersion) < 0;
    const newer = compareSemver(currentWebVersion, manifest.web.latestVersion) < 0;
    return {
      channel,
      updateAvailable: newer,
      urgency: belowMin ? 'required' : newer ? 'optional' : 'none',
      targetVersionLabel: manifest.web.latestVersion,
      actionType: newer ? 'reload-web' : 'up-to-date',
      integrityRequired: false,
      message: newer
        ? `Nova versão web ${manifest.web.latestVersion} disponível.`
        : 'Versão web atualizada.'
    };
  }

  const belowMinCode = currentAndroidVersionCode < manifest.android.minSupportedVersionCode;
  const newerCode = currentAndroidVersionCode < manifest.android.latestVersionCode;

  if (!newerCode) {
    return {
      channel,
      updateAvailable: false,
      urgency: 'none',
      targetVersionLabel: manifest.android.latestVersionName,
      actionType: 'up-to-date',
      integrityRequired: false,
      message: 'Aplicativo Android atualizado.'
    };
  }

  if (channel === 'android-playstore') {
    return {
      channel,
      updateAvailable: true,
      urgency: belowMinCode ? 'required' : 'optional',
      targetVersionLabel: manifest.android.latestVersionName,
      actionType: 'play-in-app-update',
      integrityRequired: false,
      message: `Atualização ${manifest.android.latestVersionName} disponível na Play Store.`
    };
  }

  const hasValidHttpsAndHash =
    typeof manifest.android.officialApkHttpsUrl === 'string' &&
    manifest.android.officialApkHttpsUrl.startsWith('https://') &&
    typeof manifest.android.apkSha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(manifest.android.apkSha256);

  return {
    channel,
    updateAvailable: true,
    urgency: belowMinCode ? 'required' : 'optional',
    targetVersionLabel: manifest.android.latestVersionName,
    actionType: hasValidHttpsAndHash ? 'official-https-link' : 'up-to-date',
    integrityRequired: true,
    message: hasValidHttpsAndHash
      ? `Versão Android ${manifest.android.latestVersionName} disponível no canal oficial HTTPS (SHA-256 verificado).`
      : 'Canal oficial HTTPS ou hash SHA-256 ainda não publicado.'
  };
}
