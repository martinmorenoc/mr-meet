import { driveBaseUrl } from './constants';
import { File } from './types';

export default async function createClassFolder(
  folderName: string,
  mrMeetFolderId: string,
  token: string,
) {
  try {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        parents: [mrMeetFolderId],
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    };
    const folder: File = await fetch(driveBaseUrl, options)
      .then((response) => response.json());
    return folder;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
