import { sheetsBaseUrl } from './constants';

export default async function addSheet(sheetName: string, spreadsheetId: string, token: string) {
  try {
    const url = `${sheetsBaseUrl}/${spreadsheetId}:batchUpdate`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requests: [{
          addSheet: {
            properties: {
              title: sheetName,
              index: 0,
            },
          },
        }],
      }),
    };
    await fetch(url, options).then((response) => response.json());
  } catch (error: any) {
    throw new Error(error.message);
  }
}
