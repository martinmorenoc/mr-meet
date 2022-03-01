import { manageAttendanceSheetContent } from '../utils';
import { sheetsBaseUrl } from './constants';

export default async function addAttendanceDetailToSheet(
  names: string[],
  spreadsheetId: string,
  content: string[][],
  token: string,
) {
  const newContent = manageAttendanceSheetContent(content, names);
  const range = 'Details!A1';
  try {
    const url = `${sheetsBaseUrl}/${spreadsheetId}/values/${range}?${new URLSearchParams({ valueInputOption: 'USER_ENTERED' })}`;
    const options = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        values: newContent,
      }),
    };
    await fetch(url, options).then((response) => response.json());
  } catch (error: any) {
    throw new Error(error.message);
  }
}
