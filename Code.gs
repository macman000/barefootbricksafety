// Barefoot Brick Safety Administration - report saver
// Receives incident reports from the website and adds them to report.txt in your GitHub repo.
//
// Fill in these three lines:
const OWNER  = 'your-github-username';   // e.g. 'mac-123'
const REPO   = 'your-repo-name';         // e.g. 'brick-safety'
const BRANCH = 'main';
const PATH   = 'report.txt';
// Your GitHub token goes in Project Settings > Script Properties as GITHUB_TOKEN (not in this file).

function doPost(e) {
  const entry = ((e && e.postData && e.postData.contents) || '').slice(0, 5000);
  if (!entry.trim()) return reply('empty');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // one report at a time, so two people submitting at once don't overwrite each other
  try {
    const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
    if (!token) return reply('no token');

    const url = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + PATH;
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };

    // Read the current report.txt (if it exists yet)
    let sha = null, current = '';
    const res = UrlFetchApp.fetch(url + '?ref=' + BRANCH, { headers: headers, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const file = JSON.parse(res.getContentText());
      sha = file.sha;
      current = Utilities.newBlob(Utilities.base64Decode(file.content.replace(/\n/g, ''))).getDataAsString('UTF-8');
    }

    // Write it back with the new report added to the end
    const body = {
      message: 'New brick incident report',
      content: Utilities.base64Encode(current + entry, Utilities.Charset.UTF_8),
      branch: BRANCH
    };
    if (sha) body.sha = sha;

    const put = UrlFetchApp.fetch(url, {
      method: 'put', headers: headers, contentType: 'application/json',
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    return reply(put.getResponseCode() < 300 ? 'ok' : 'github error ' + put.getResponseCode());
  } finally {
    lock.releaseLock();
  }
}

function reply(text) {
  return ContentService.createTextOutput(text);
}
