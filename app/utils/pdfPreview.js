// Opens a generated PDF in a new browser tab.
//
// - The tab is opened immediately (inside the user's click) so popup blockers
//   allow it, shows "Generating preview…", then switches to the PDF with
//   location.replace (so Back doesn't land on the loading page).
// - The PDF's blob URL is kept alive while that tab is open. Clicking a link in
//   the PDF (e.g. the payment link) and pressing Back reloads the same blob URL,
//   which would show "Your file couldn't be accessed" if it had been revoked.
//   URLs are freed once their tab is closed, and only the most recent previews
//   are kept so memory can't grow without bound in a long session.

const MAX_LIVE_PREVIEWS = 10;
const livePreviews = []; // [{ url, tab }]
let sweepTimer = null;

const revoke = (entry) => URL.revokeObjectURL(entry.url);

const sweepClosedTabs = () => {
  for (let i = livePreviews.length - 1; i >= 0; i--) {
    if (livePreviews[i].tab.closed) revoke(livePreviews.splice(i, 1)[0]);
  }
  if (livePreviews.length === 0 && sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
};

const keepAlive = (url, tab) => {
  livePreviews.push({ url, tab });
  while (livePreviews.length > MAX_LIVE_PREVIEWS) revoke(livePreviews.shift());
  if (!sweepTimer) sweepTimer = setInterval(sweepClosedTabs, 5000);
};

/**
 * @param {() => Promise<Blob>} makeBlob builds the PDF
 * @returns {Promise<"opened" | "blocked" | "closed">} "closed" if the user closed
 *   the tab before the PDF was ready. Throws if makeBlob fails (the tab is closed).
 */
export async function openPdfInNewTab(makeBlob) {
  const tab = window.open("", "_blank");
  if (!tab) return "blocked";
  tab.document.write(
    '<!doctype html><title>Generating preview…</title>' +
      '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#525659;color:#fff;font-family:system-ui,sans-serif">' +
      "Generating preview…</body>"
  );
  tab.document.close();

  let blob;
  try {
    blob = await makeBlob();
  } catch (error) {
    if (!tab.closed) tab.close();
    throw error;
  }
  if (tab.closed) return "closed";

  const url = URL.createObjectURL(blob);
  keepAlive(url, tab);
  tab.location.replace(url);
  return "opened";
}
