import { driveBaseUrl } from './constants';
import { File } from './types';

export default async function createFolder(folderName: string, token: string) {
  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    };
    const folder: File = await fetch(driveBaseUrl, options)
      .then((response) => response.json());

    return folder;
  } catch (error) {
    throw new Error('');
  }
}
