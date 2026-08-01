// Extension pages cannot run inline scripts under MV3, so the localized copy is
// filled in from here instead of being baked into welcome.html.
const REVIEW_URL =
  'https://chromewebstore.google.com/detail/cipejegejindaigfnpffjkihnilkkflc/reviews';

document.querySelectorAll('[data-i18n]').forEach((element) => {
  const message = chrome.i18n.getMessage(element.dataset.i18n);

  if (message) {
    element.textContent = message;
  }
});

document.getElementById('review-link').href = REVIEW_URL;
document.title = chrome.i18n.getMessage('appName');
