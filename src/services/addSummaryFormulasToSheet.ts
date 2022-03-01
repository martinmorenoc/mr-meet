import { sheetsBaseUrl } from './constants';

export default async function addSummaryFormulasToSheet(spreadsheetId: string, token: string) {
  let values = [
    ["={'Details'!A:A}", 'Total Attendance', 'Attendance Percentage'],
  ];
  const formulas = Array.from({ length: 200 }, (_, i) => [
    '',
    `=IF(SUM({Details!B${i + 2}:${i + 2}}) = 0; ""; SUM({Details!B${i + 2}:${i + 2}}))`,
    `=IF(COUNT({Details!B${i + 2}:${i + 2}}) = 0; ""; CONCATENATE(B${i + 2}/COUNT({Details!B${i + 2}:${i + 2}})*100; "%"))`,
  ]);
  values = values.concat(formulas);
  const range = 'Summary!A1';
  try {
    const url = `${sheetsBaseUrl}/${spreadsheetId}/values/${range}?${new URLSearchParams({ valueInputOption: 'USER_ENTERED' })}`;
    const options = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        values,
      }),
    };
    await fetch(url, options).then((response) => response.json());
  } catch (error: any) {
    throw new Error(error.message);
  }
}
