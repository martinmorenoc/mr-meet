import { sortDictionaryByValue } from '../utils';
import { driveBaseUrl } from './constants';
import { File } from './types';

interface FileNames {
    [key: string]: string
}

export default async function getFolderFileNames(folderId: string, type: 'folder' | 'spreadsheet', token: string) {
  try {
    const url = `${driveBaseUrl}?q=mimeType='application/vnd.google-apps.${type}' and parents in '${folderId}'`;
    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const response = await fetch(url, options)
      .then((data) => data.json());
    const fileNames: FileNames = {};
    response.files.forEach((file: File) => {
      fileNames[file.id] = file.name;
    });
    const sortFileNames = sortDictionaryByValue(fileNames);
    return sortFileNames;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
