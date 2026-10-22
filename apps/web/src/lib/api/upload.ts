// Единственное исключение из «запросы только через RTK Query»: XMLHttpRequest даёт прогресс загрузки.
// Значения purpose — endpoints/media.md.
export type MediaPurpose =
  'POST' | 'REEL' | 'STORY' | 'AVATAR' | 'MESSAGE' | 'VOICE' | 'HIGHLIGHT_COVER';

// TODO(T0.5): вернуть тип MediaItem из schema.d.ts вместо unknown
export function uploadMedia(
  file: Blob,
  purpose: MediaPurpose,
  onProgress?: (percent: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/media');
    xhr.withCredentials = true;
    xhr.responseType = 'json';

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      // Ошибка отклоняется в том же виде, что у RTK Query, — getApiError её понимает.
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else reject({ status: xhr.status, data: xhr.response });
    };
    xhr.onerror = () => reject({ status: 'FETCH_ERROR', error: 'Network error' });

    // Content-Type не задаём: браузер сам добавит boundary.
    const body = new FormData();
    body.append('file', file);
    body.append('purpose', purpose);
    xhr.send(body);
  });
}
