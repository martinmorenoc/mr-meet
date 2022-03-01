import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import createFolder from './services/createFolder';
import getFileByName from './services/getFileByName';
import getFolderFileNames from './services/getFolderFileNames';

function Popup() {
  const [isInMeeting, setIsInMeeting] = useState<boolean>(false);
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].url?.includes('meet.google.com/')) {
        setIsInMeeting(true);
      }
    });
  }, []);
  const takeAttendance = () => {
    chrome.identity.getAuthToken({ interactive: true }, async (authToken: string) => {
      const gettedFolder = await getFileByName(chrome.i18n.getMessage('mrMeetFolderName'), 'folder', authToken);
      const mrMeetFolder = gettedFolder || await createFolder(chrome.i18n.getMessage('mrMeetFolderName'), authToken);
      chrome.storage.sync.set({ mrMeetFolderId: mrMeetFolder.id });
      const classNames = await getFolderFileNames(mrMeetFolder.id, 'folder', authToken);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab.id) {
          chrome.tabs.sendMessage(
            tab.id,
            {
              message: 'showAttendanceModal',
              classNames,
              authToken,
            },
          );
        }
      });
    });
  };
  let description;
  if (!isInMeeting) {
    description = chrome.i18n.getMessage('disabledDescriptionPopup');
  }
  return (
    // eslint-disable-next-line react/jsx-filename-extension
    <div className="container">
      <div>
        <img src="../images/128.png" width="100" height="100" alt="logo" />
      </div>
      <h2>{chrome.i18n.getMessage('titlePopup')}</h2>
      <p>{description}</p>
      <button
        disabled={!isInMeeting}
        className="button-25"
        type="button"
        onClick={takeAttendance}
      >
        {chrome.i18n.getMessage('attendanceButton')}
      </button>
    </div>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
  document.getElementById('root'),
);
