import Swal from 'sweetalert2';

const participantSwal = Swal.mixin({
  icon: 'warning',
  title: chrome.i18n.getMessage('somethingWentWrong'),
  showConfirmButton: true,
});

const takingAttendanceSwal = Swal.mixin({
  allowEscapeKey: false,
  allowOutsideClick: false,
  timer: 10000,
  timerProgressBar: true,
  didOpen: () => {
    Swal.showLoading();
  },
  didClose: () => {
    Swal.fire({
      icon: 'error',
      title: 'Timeout',
      text: chrome.i18n.getMessage('somethingWentWrong'),
      showConfirmButton: true,
    });
  },
});

const isTabOpenAndHasParticipants = () => {
  const participantsCount = document.querySelectorAll('[role=listitem]').length;
  if (participantsCount === 0) {
    participantSwal.fire({
      text: chrome.i18n.getMessage('openParticipantsTab'),
    });
    return false;
  } if (participantsCount === 1) {
    participantSwal.fire({
      text: chrome.i18n.getMessage('noParticipants'),
    });
    return false;
  }
  return true;
};

const collectParticipants = () => {
  const participantIds: string[] = [];
  const participantNames: string[] = [];
  const participantsList = Array.from(document.querySelectorAll('[role=listitem]'));
  participantsList.forEach((participantItem) => {
    const participantId = participantItem.getAttribute('data-participant-id')?.split('/')[3];
    if (participantId && !participantIds.includes(participantId!)) {
      const participantName = participantItem.querySelector('[class=zWGUib]')?.innerHTML;
      const isYou = participantItem.querySelector('[class=NnTWjc]');
      const isHostOrPresentation = participantItem.querySelector('[class=d93U2d]');
      if (participantName && !isYou && !isHostOrPresentation) {
        participantNames.push(participantName);
        participantIds.push(participantId);
      }
    }
  });
  return participantNames;
};

const takeAttendance = (className: string, token: string, classFolderId?: string) => {
  const attendance = chrome.i18n.getMessage('attendance');
  const participantNames = collectParticipants();
  chrome.runtime.sendMessage({
    message: 'takeAttendance',
    authToken: token,
    participantNames,
    className,
    classFolderId,
    attendance,
  });
};

const randomSelect = () => {
  const participantNames = collectParticipants();
  const randomName = participantNames[Math.floor(Math.random() * participantNames.length)];
  Swal.fire({
    title: randomName + chrome.i18n.getMessage('hasBeenSelected'),
    icon: 'success',
  });
};

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  const { message } = msg;
  if (message === 'showAttendanceModal') {
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
      inputValidator: (value) => new Promise((resolve) => {
        if (!value) {
          resolve(chrome.i18n.getMessage('noCourseSelected'));
        }
        resolve(null);
      }),
    }).then(async (result) => {
      if (result.isConfirmed && result.value) {
        takingAttendanceSwal.fire({
          title: chrome.i18n.getMessage('takingAttendanceModalTitle'),
        });
        takeAttendance(msg.classNames[result.value], msg.authToken, result.value);
      } else if (result.isDenied) {
        const { value: className } = await Swal.fire({
          title: chrome.i18n.getMessage('newCourseModalTitle'),
          input: 'text',
          inputPlaceholder: chrome.i18n.getMessage('newCourseModalPlaceHolder'),
          inputAttributes: {
            'aria-label': 'Type your class name here',
          },
          showCancelButton: true,
          inputValidator: (value) => new Promise((resolve) => {
            if (Object.values(msg.classNames).includes(value)) {
              resolve(chrome.i18n.getMessage('newCourseModalAlreadyExists'));
            }
            resolve(null);
          }),
        });
        if (className) {
          takingAttendanceSwal.fire({
            title: chrome.i18n.getMessage('creatingFilesAndTakingAttendance'),
            timer: 15000,
          });
          takeAttendance(className, msg.authToken);
        }
      }
    });
  } else if (message === 'showRandomSelectModal') {
    randomSelect();
  } else if (message === 'isTabOpenAndHasParticipants') {
    sendResponse({
      isTabOpenAndHasParticipants: isTabOpenAndHasParticipants(),
    });
  } else if (message === 'success') {
    Swal.fire({
      title: chrome.i18n.getMessage('attendanceTaken'),
      text: chrome.i18n.getMessage('openMessage'),
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: chrome.i18n.getMessage('open'),
    })
      .then((result) => {
        if (result.isConfirmed) {
          window.open(`https://docs.google.com/spreadsheets/d/${msg.spreadsheetId}`, '_blank');
        }
      });
  } else if (message === 'error') {
    Swal.fire({
      position: 'center',
      icon: 'error',
      title: chrome.i18n.getMessage('somethingWentWrong'),
      text: msg.text,
      showConfirmButton: true,
    });
  }
});
