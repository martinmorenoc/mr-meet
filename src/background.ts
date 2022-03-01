import addAttendanceDetailToSheet from './services/addAttendanceDetailToSheet';
import addSheet from './services/addSheet';
import addSummaryFormulasToSheet from './services/addSummaryFormulasToSheet';
import createClassFolder from './services/createClassFolder';
import createClassSpreadsheet from './services/createClassSpreadsheet';
import getFolderFileNames from './services/getFolderFileNames';
import getSheetContent from './services/getSheetContent';

chrome.runtime.onMessage.addListener(
  async (request) => {
    try {
      if (request.message === 'takeAttendance') {
        let classFolderId;
        if (!request.classFolderId) {
          const { mrMeetFolderId } = await chrome.storage.sync.get(['mrMeetFolderId']);
          (
            {
              id: classFolderId,
            } = await createClassFolder(request.className, mrMeetFolderId, request.authToken));
        }
        const {
          participantNames, className, authToken, attendance,
        } = request;
        if (!classFolderId) classFolderId = request.classFolderId;
        const spreadsheetNames = await getFolderFileNames(classFolderId, 'spreadsheet', authToken);
        const spreadsheetClassName = `${className} ${attendance}`;
        let spreadsheetId = Object.keys(spreadsheetNames)
          .find((key) => spreadsheetNames[key] === spreadsheetClassName);
        if (!spreadsheetId) {
          (
            {
              id: spreadsheetId,
            } = await createClassSpreadsheet(spreadsheetClassName, classFolderId, authToken));
          await addSheet('Details', spreadsheetId, authToken);
          await addSheet('Summary', spreadsheetId, authToken);
          await addSummaryFormulasToSheet(spreadsheetId, authToken);
        }
        const sheetContent = await getSheetContent(spreadsheetId, 'Details', authToken);
        await addAttendanceDetailToSheet(participantNames, spreadsheetId, sheetContent, authToken);

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];
          if (tab.id) {
            chrome.tabs.sendMessage(
              tab.id,
              {
                message: 'success',
                spreadsheetId,
              },
            );
          }
        });
      }
    } catch (error: any) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab.id) {
          chrome.tabs.sendMessage(
            tab.id,
            {
              message: 'error',
              text: error.message,
            },
          );
        }
      });
    }
  },
);
