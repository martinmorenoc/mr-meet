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
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab.id) {
          chrome.tabs.sendMessage(
            tab.id,
            { message: 'isTabOpenAndHasParticipants' },
            async ({ isTabOpenAndHasParticipants }) => {
              if (tab.id && isTabOpenAndHasParticipants) {
                const gettedFolder = await getFileByName(chrome.i18n.getMessage('mrMeetFolderName'), 'folder', authToken);
                const mrMeetFolder = gettedFolder || await createFolder(chrome.i18n.getMessage('mrMeetFolderName'), authToken);
                chrome.storage.sync.set({ mrMeetFolderId: mrMeetFolder.id });
                const classNames = await getFolderFileNames(mrMeetFolder.id, 'folder', authToken);
                chrome.tabs.sendMessage(
                  tab.id,
                  {
                    message: 'showAttendanceModal',
                    classNames,
                    authToken,
                  },
                );
              }
            },
          );
        }
      });
    });
  };

  const randomSelect = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab.id) {
        chrome.tabs.sendMessage(
          tab.id,
          { message: 'isTabOpenAndHasParticipants' },
          ({ isTabOpenAndHasParticipants }) => {
            if (tab.id && isTabOpenAndHasParticipants) {
              chrome.tabs.sendMessage(
                tab.id,
                { message: 'showRandomSelectModal' },
              );
            }
          },
        );
      }
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
      <h1>{chrome.i18n.getMessage('titlePopup')}</h1>
      <p>{description}</p>
      <button
        disabled={!isInMeeting}
        className="button-25"
        type="button"
        onClick={takeAttendance}
      >
        {chrome.i18n.getMessage('attendanceButton')}
      </button>
      <button
        disabled={!isInMeeting}
        className="button-25"
        type="button"
        onClick={randomSelect}
      >
        {chrome.i18n.getMessage('randomSelectButton')}
      </button>
      <br />
      <hr className="solid" />
      <p>{chrome.i18n.getMessage('likeExtensionText')}</p>
      <a
        href="https://chrome.google.com/webstore/detail/mr-meet-take-attendance-i/cipejegejindaigfnpffjkihnilkkflc"
        target="_blank"
        rel="noreferrer"
      >
        {chrome.i18n.getMessage('rateUsText')}
      </a>
    </div>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
  document.getElementById('root'),
);
