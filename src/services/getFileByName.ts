import { driveBaseUrl } from './constants';
import { getFileByNameResponse } from './types';

export default async function getFileByName(fileName: string, type: 'folder' | 'spreadsheet', token: string) {
  try {
    const url = `${driveBaseUrl}?q=name='${fileName}'&mimeType=application/vnd.google-apps.${type}`;
    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const { files }: getFileByNameResponse = await fetch(url, options)
      .then((response) => response.json());
    return files[0];
  } catch (error) {
    throw new Error('');
  }
}
