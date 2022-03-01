import Swal from 'sweetalert2';

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

chrome.runtime.onMessage.addListener(async (msg) => {
  const { message } = msg;
  if (message === 'showAttendanceModal') {
    const participantsCount = document.querySelectorAll('[role=listitem]').length;
    if (participantsCount === 0) {
      Swal.fire({
        icon: 'info',
        title: chrome.i18n.getMessage('somethingWentWrong'),
        text: chrome.i18n.getMessage('openParticipantsTab'),
        showConfirmButton: true,
      });
    } else if (participantsCount === 1) {
      Swal.fire({
        icon: 'info',
        title: chrome.i18n.getMessage('somethingWentWrong'),
        text: chrome.i18n.getMessage('noParticipants'),
        showConfirmButton: true,
      });
    } else {
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
          Swal.fire({
            title: chrome.i18n.getMessage('takingAttendanceModalTitle'),
            allowEscapeKey: false,
            allowOutsideClick: false,
            timer: 10000,
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
            Swal.fire({
              title: chrome.i18n.getMessage('creatingFilesAndTakingAttendance'),
              allowEscapeKey: false,
              allowOutsideClick: false,
              timer: 10000,
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
            takeAttendance(className, msg.authToken);
          }
        }
      });
    }
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
      showConfirmButton: false,
      timer: 3000,
    });
  }
});
