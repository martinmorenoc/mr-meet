import { sheetsBaseUrl } from './constants';

export default async function getSheetContent(
  spreadsheetId: string,
  sheetName: string,
  token: string,
) {
  const range = `${sheetName}!A1:Z1000`;
  try {
    const url = `${sheetsBaseUrl}/${spreadsheetId}/values/${range}`;
    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const response = await fetch(url, options)
      .then((data) => data.json());
    return response.values;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
