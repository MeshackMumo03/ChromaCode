import * as FileSystem from 'expo-file-system/legacy';

/**
 * Uploads a local (or content://) URI to a backend endpoint as multipart/form-data.
 *
 * React Native's New Architecture has a well documented bug where passing a
 * `{ uri, name, type }` object to `FormData.append()` and sending it via `fetch`
 * throws `Unsupported FormDataPart implementation` on Android, especially for
 * `content://` URIs returned by the modern Android Photo Picker / Storage Access
 * Framework document picker. `expo-file-system`'s `uploadAsync` performs the
 * multipart upload natively (outside the JS bridge's FormData/Blob layer),
 * which avoids that bug entirely and also handles `content://` URIs correctly.
 */
export async function uploadFileToEndpoint(
  endpoint: string,
  uri: string,
  fieldName: string,
  token: string | null,
  fileName?: string,
  mimeType?: string,
): Promise<any> {
  // Some content:// URIs (e.g. from the SAF document picker or the modern
  // Android Photo Picker) can't be read directly by the native upload task
  // on every Android version, so copy them into the app's cache directory
  // first (preserving the original extension so mime-type sniffing works)
  // and upload the local copy instead.
  let uploadUri = uri;
  let tempUri: string | null = null;

  if (!uri.startsWith('file://')) {
    const cacheDir = FileSystem.cacheDirectory || '';
    const extMatch = fileName?.match(/\.[a-zA-Z0-9]+$/);
    const ext = extMatch ? extMatch[0] : '';
    const safeName = `upload-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    tempUri = `${cacheDir}${safeName}`;
    await FileSystem.copyAsync({ from: uri, to: tempUri });
    uploadUri = tempUri;
  }

  try {
    const result = await FileSystem.uploadAsync(endpoint, uploadUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName,
      mimeType,
      parameters: fileName ? { filename: fileName } : undefined,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    let parsed: any = null;
    try {
      parsed = JSON.parse(result.body);
    } catch {
      // Non-JSON response body; fall through with parsed = null
    }

    if (result.status < 200 || result.status >= 300) {
      const message = parsed?.message || `Upload failed with status ${result.status}`;
      throw new Error(message);
    }

    return parsed;
  } finally {
    if (tempUri) {
      FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
    }
  }
}
