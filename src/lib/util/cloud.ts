type FileInfo = {
  accessToken: string;
  metadata: any;
  fileId?: string;
  localStorageId: string;
  type: string;
}

const FILES_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export async function uploadFile({ accessToken, fileId, localStorageId, metadata, type }: FileInfo) {
  const json = localStorage.getItem(localStorageId) || '';
  const blob = new Blob([json], { type });

  const form = new FormData();

  form.append('resource', new Blob([JSON.stringify(metadata)], { type }));
  form.append('file', blob);


  const res = await fetch(
    `${FILES_API_URL}${fileId ? `/${fileId}` : ''}?uploadType=multipart`,
    {
      method: fileId ? 'PATCH' : 'POST',
      headers: new Headers({ Authorization: 'Bearer ' + accessToken }),
      body: form
    }
  );

  return await res.json()
}

