chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },   // sites reais escondem componentes em iframes
    files: ["picker.js"],
  });
});
