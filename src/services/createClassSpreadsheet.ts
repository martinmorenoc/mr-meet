import { driveBaseUrl } from './constants';
import { File } from './types';

export default async function createClassSpreadsheet(
  spreadsheetName: string,
  folderId: string,
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
        parents: [folderId],
        name: spreadsheetName,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      }),
    };
    const spreadsheet: File = await fetch(driveBaseUrl, options)
      .then((response) => response.json());
    return spreadsheet;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
