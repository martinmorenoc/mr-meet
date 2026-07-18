import Swal from 'sweetalert2';

const showLoading = (title: string) =>
  Swal.fire({
    allowEscapeKey: false,
    allowOutsideClick: false,
    title,
    didOpen: () => {
      Swal.showLoading();
    },
  });

const takeAttendance = (
  className: string,
  token: string,
  meetingId: string,
  tabId: number | undefined,
  classFolderId?: string,
) => {
  const attendance = chrome.i18n.getMessage('attendance');
  chrome.runtime.sendMessage({
    message: 'takeAttendance',
    authToken: token,
    className,
    classFolderId,
    attendance,
    meetingId,
    tabId,
  });
};

const randomSelect = (participantNames: string[]) => {
  if (!participantNames.length) {
    Swal.fire({
      title: chrome.i18n.getMessage('somethingWentWrong'),
      text: chrome.i18n.getMessage('noParticipants'),
      icon: 'warning',
    });
    return;
  }

  const randomName = participantNames[Math.floor(Math.random() * participantNames.length)];
  Swal.fire({
    title: randomName + chrome.i18n.getMessage('hasBeenSelected'),
    icon: 'success',
  });
};

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  const { message } = msg;
  if (message === 'showLoading') {
    showLoading(msg.title);
  } else if (message === 'hideLoading') {
    Swal.close();
  } else if (message === 'showAttendanceModal') {
    Swal.close();
    await Swal.fire({
      title: chrome.i18n.getMessage('selectACourse'),
      input: 'select',
      inputOptions: msg.classNames,
      inputPlaceholder: chrome.i18n.getMessage('attendanceModalPlaceHolder'),
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: chrome.i18n.getMessage('attendanceModalConfirmButton'),
      cancelButtonText: chrome.i18n.getMessage('modalCancelButton'),
      denyButtonText: chrome.i18n.getMessage('attendanceModalNewCourseButton'),
      denyButtonColor: 'LightSeaGreen',
      inputValidator: (value) =>
        new Promise((resolve) => {
          if (!value) {
            resolve(chrome.i18n.getMessage('noCourseSelected'));
            return;
          }
          resolve(null);
        }),
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        showLoading(chrome.i18n.getMessage('takingAttendanceModalTitle'));
        takeAttendance(
          msg.classNames[result.value],
          msg.authToken,
          msg.meetingId,
          msg.tabId,
          result.value,
        );
      } else if (result.isDenied) {
        const { value: className } = await Swal.fire({
          title: chrome.i18n.getMessage('newCourseModalTitle'),
          input: 'text',
          inputPlaceholder: chrome.i18n.getMessage('newCourseModalPlaceHolder'),
          inputAttributes: {
            'aria-label': chrome.i18n.getMessage('newCourseModalAriaLabel'),
          },
          showCancelButton: true,
          inputValidator: (value) =>
            new Promise((resolve) => {
              const normalizedClassName = value?.trim().toLowerCase() ?? '';
              const existingClassNames = (Object.values(msg.classNames) as string[]).map((name) =>
                name.trim().toLowerCase(),
              );

              if (existingClassNames.includes(normalizedClassName)) {
                resolve(chrome.i18n.getMessage('newCourseModalAlreadyExists'));
                return;
              }
              resolve(null);
            }),
        });
        const trimmedClassName = className?.trim();
        if (trimmedClassName) {
          showLoading(chrome.i18n.getMessage('creatingFilesAndTakingAttendance'));
          takeAttendance(trimmedClassName, msg.authToken, msg.meetingId, msg.tabId);
        }
      }
    });
  } else if (message === 'showRandomSelectModal') {
    Swal.close();
    randomSelect(msg.participantNames);
  } else if (message === 'success') {
    Swal.fire({
      title: chrome.i18n.getMessage('attendanceTaken'),
      text: chrome.i18n.getMessage('openMessage'),
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: chrome.i18n.getMessage('open'),
    }).then((result) => {
      if (result.isConfirmed) {
        window.open(`https://docs.google.com/spreadsheets/d/${msg.spreadsheetId}`, '_blank');
      }
    });
  } else if (message === 'error') {
    Swal.close();
    Swal.fire({
      position: 'center',
      icon: 'error',
      title: chrome.i18n.getMessage('somethingWentWrong'),
      text: msg.text,
      showConfirmButton: true,
    });
  }
});
