/* =====================================================================
   THE COACH'S PLAYBOOK · AUTOMATION SCRIPT
   ---------------------------------------------------------------------
   Lives inside the "BFT Playbook" Google Sheet (Extensions → Apps Script).

   What it does, every time a coach submits the Tally form:
     1. Tally pings this script. It adds a row to "Entries" (Status: Processing).
     2. About a minute later it picks the row up and:
          · saves the photo to Cloudinary
          · asks Gemini where the whiteboard's corners are, what's written
            on it, and for a one-liner + subheading
          · has Cloudinary straighten, crop and brighten the photo
          · fills in the row and sets Status to Live
     3. The website asks this script for all Live rows and shows them.

   You shouldn't need to edit anything in here. Captions are controlled
   by the "Prompts" tab, and everything else by the "Settings" tab.
   Use the "Playbook" menu in the Sheet for setup and fixes.
   ===================================================================== */

const TAB = { entries: 'Entries', coaches: 'Coaches', sessions: 'Sessions', prompts: 'Prompts', settings: 'Settings', log: 'Log' };

const COACH_COLS = [
  'Name', 'Role', 'Specialty', 'Years coaching', 'One-liner', 'Bio',
  'Favourite session', 'Signature doodle', 'Instagram', 'Photo URL', 'Show on site'
];

const COLS = [
  'ID', 'Received', 'Date', 'Session', 'Coach', 'Week', 'Coach note',
  'Status', 'Preview', 'One-liner', 'Subheading',
  'Clean photo', 'Original photo', 'Transcript', 'Tally photo', 'Details', 'Photo info'
];

const STATUS = { processing: 'Processing', live: 'Live', hidden: 'Hidden', retry: 'Retry', error: 'Error' };

const DEFAULT_CLEANUP = 'e_improve:indoor/e_auto_contrast/e_sharpen:60/c_limit,w_1800/q_auto';
const DEFAULT_MODEL = 'gemini-3.5-flash';

const DEFAULT_PROMPT = [
  "You're writing captions for The Coach's Playbook, a flipbook of whiteboard sketches drawn by the coaches at BFT Beauty World, a gym in Singapore. Members flip through it to see what each class was about.",
  '',
  'This board is from the {session} session on {date}, drawn by Coach {coach}.',
  'Week of the program: {week}',
  "Note from the coach: {coach_note}",
  '',
  'Look at the photo and write:',
  '',
  "ONE-LINER: one witty line in the coach's voice, max 80 characters. Hook it to something specific on this board: a number, a tempo, a move, the format, or a doodle. A member should smirk, then want to try the class.",
  '',
  'SUBHEADING: one or two plain sentences telling a member what the session involves. Max 160 characters. Only use facts that are on the board.',
  '',
  'TRANSCRIPT: everything written on the board, in reading order, as plain text. If you can\'t read a word, write [unclear]. Never guess numbers.',
  '',
  'WEEK: if the board shows the program week (like 1/4, 3/8, Final), return it exactly. Otherwise return an empty string.',
  '',
  "Style rules: use contractions. No em dashes. No hashtags or emojis. No gym clichés like 'crush it', 'beast mode', 'no pain no gain' or 'level up'. Never invent numbers or moves that aren't on the board.",
  '',
  'One-liners we like, for tone:',
  '{examples}'
].join('\n');

const DEFAULT_EXAMPLES = [
  "0-2-0 means two full seconds on the way down. Yes, I'm counting.",
  'Screen 2 is slow on purpose. The wobble is the workout.',
  'Fifteen seconds is short. Make it feel long.',
  "Your partner rests while you work. Try not to take it personally.",
  "There's a mountain on the board. You're climbing it three times.",
  'Thirty-five seconds, six sets, six zones. Bring a towel. Bring two.',
  'Stay in the purple. I can see your heart rate on the screen.',
  'Ken the Hen has better legs than most of you. Let\'s fix that.',
  'Six sets, no stopping. Pikachu did it with tiny legs.',
  "Cardio? Ewww. I know. I drew a cat so you'd forgive me."
].join('\n');

// Technical instructions the script always adds, so edits to the Prompts tab can't break it.
const FIXED_INSTRUCTIONS = [
  '',
  '---',
  'ALSO: find the whiteboard\'s writing surface (inside the frame) and give its four corners as [y, x] integers on a 0-1000 scale, where [0, 0] is the top-left of the photo and [1000, 1000] is the bottom-right.',
  'If you can\'t see all four corners of the board, set board_found to false and still fill in the other fields.'
].join('\n');

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    one_liner:    { type: 'STRING' },
    subheading:   { type: 'STRING' },
    transcript:   { type: 'STRING' },
    week:         { type: 'STRING' },
    board_found:  { type: 'BOOLEAN' },
    top_left:     { type: 'ARRAY', items: { type: 'INTEGER' } },
    top_right:    { type: 'ARRAY', items: { type: 'INTEGER' } },
    bottom_right: { type: 'ARRAY', items: { type: 'INTEGER' } },
    bottom_left:  { type: 'ARRAY', items: { type: 'INTEGER' } }
  },
  required: ['one_liner', 'subheading', 'transcript', 'week', 'board_found',
             'top_left', 'top_right', 'bottom_right', 'bottom_left']
};


/* =====================================================================
   MENU
   ===================================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Playbook')
    .addItem('1. Set up the sheet', 'setupSheet')
    .addItem('2. Enter API keys', 'enterKeys')
    .addItem('3. Test my keys', 'testKeys')
    .addItem('4. Show the link for Tally', 'showWebhookUrl')
    .addSeparator()
    .addItem('Redo the selected row', 'redoSelectedRow')
    .addItem('Process waiting boards now', 'processPending')
    .addSeparator()
    .addItem('Import the 13 old boards (one time)', 'importLegacyBoards')
    .addSeparator()
    .addItem('Enter Tally API key', 'enterTallyKey')
    .addItem('Sync coaches and sessions to Tally now', 'syncToTally')
    .addItem('Turn on automatic Tally sync', 'turnOnTallySync')
    .addToUi();
}


/* =====================================================================
   1. SETUP
   ===================================================================== */

function setupSheet() {
  const ss = SpreadsheetApp.getActive();

  // --- Entries
  let en = ss.getSheetByName(TAB.entries);
  const isNewEntries = !en;
  if (!en) en = ss.insertSheet(TAB.entries, 0);
  en.getRange(1, 1, 1, COLS.length).setValues([COLS])
    .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF');
  en.setFrozenRows(1);
  en.setFrozenColumns(0);
  const col = n => COLS.indexOf(n) + 1;
  if (isNewEntries) {
    const widths = { 'ID': 110, 'Received': 130, 'Date': 95, 'Session': 130, 'Coach': 100, 'Week': 60,
      'Coach note': 200, 'Status': 95, 'Preview': 130, 'One-liner': 280, 'Subheading': 300,
      'Clean photo': 200, 'Original photo': 200, 'Transcript': 300, 'Tally photo': 150,
      'Details': 250, 'Photo info': 150 };
    Object.keys(widths).forEach(n => en.setColumnWidth(col(n), widths[n]));
  }
  // Plain text so Sheets doesn't turn "1/4" or "2026-09-27" into dates
  ['ID', 'Date', 'Week', 'Received'].forEach(n => en.getRange(2, col(n), en.getMaxRows() - 1, 1).setNumberFormat('@'));
  ['One-liner', 'Subheading', 'Coach note', 'Transcript', 'Details'].forEach(n =>
    en.getRange(2, col(n), en.getMaxRows() - 1, 1).setWrap(true));

  const statusRange = en.getRange(2, col('Status'), en.getMaxRows() - 1, 1);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.values(STATUS), true).setAllowInvalid(false).build());
  const rules = [
    [STATUS.live, '#D9F2E3', '#0B6B35'], [STATUS.error, '#FDE0D6', '#B33A00'],
    [STATUS.hidden, '#EEEEEE', '#777777'], [STATUS.processing, '#E0F4FC', '#006E99'],
    [STATUS.retry, '#E0F4FC', '#006E99']
  ].map(([v, bg, fg]) => SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(v).setBackground(bg).setFontColor(fg).setRanges([statusRange]).build());
  en.setConditionalFormatRules(rules);
  ['Photo info', 'Tally photo'].forEach(n => en.hideColumns(col(n)));

  // --- Coaches
  let co = ss.getSheetByName(TAB.coaches);
  if (!co) {
    co = ss.insertSheet(TAB.coaches, 1);
    co.getRange(1, 1, 1, COACH_COLS.length).setValues([COACH_COLS])
      .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF');
    co.getRange(2, 1, 1, COACH_COLS.length).setValues([[
      'Jay', 'Coach', 'e.g. strength and tempo work', '', '',
      'Two or three sentences: how long they\'ve coached, what they love programming, one fun fact members wouldn\'t guess.',
      '', '', '', '', 'Yes'
    ]]);
    const wCoach = { 'Name': 120, 'Role': 90, 'Specialty': 200, 'Years coaching': 90, 'One-liner': 260,
      'Bio': 320, 'Favourite session': 160, 'Signature doodle': 160, 'Instagram': 140, 'Photo URL': 260, 'Show on site': 90 };
    Object.keys(wCoach).forEach((n, i) => co.setColumnWidth(i + 1, wCoach[n]));
    co.getRange(2, 1, co.getMaxRows() - 1, COACH_COLS.length).setWrap(true).setVerticalAlignment('top');
    co.setFrozenRows(1);
    const showCol = COACH_COLS.indexOf('Show on site') + 1;
    co.getRange(2, showCol, co.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(['Yes', 'No'], true).setAllowInvalid(false).build());
  }

  // --- Sessions
  ensureSessionsTab_();

  // --- Prompts
  let pr = ss.getSheetByName(TAB.prompts);
  if (!pr) {
    pr = ss.insertSheet(TAB.prompts);
    pr.getRange('A1:C1').setValues([['What', 'Text (edit freely)', 'Notes']])
      .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF');
    pr.getRange('A2:C3').setValues([
      ['Caption prompt', DEFAULT_PROMPT,
       'This is what Gemini reads for every new board. Placeholders in {curly brackets} get filled in automatically: {session} {date} {coach} {week} {coach_note} {examples}. Change the tone here, no code needed.'],
      ['Example one-liners', DEFAULT_EXAMPLES,
       'One per line. Gemini copies the tone of these. Swap in your favourites as the Playbook grows.']
    ]);
    pr.setColumnWidth(1, 160); pr.setColumnWidth(2, 620); pr.setColumnWidth(3, 300);
    pr.getRange('A2:C3').setWrap(true).setVerticalAlignment('top');
    pr.setFrozenRows(1);
  }

  // --- Settings
  let st = ss.getSheetByName(TAB.settings);
  if (!st) {
    st = ss.insertSheet(TAB.settings);
    st.getRange('A1:C1').setValues([['Setting', 'Value', 'What it does']])
      .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF');
    st.getRange(2, 1, 6, 3).setValues([
      ['New boards go', STATUS.live, 'Live = straight onto the website. Change to Hidden if you ever want to check boards before they go up (then flip each one to Live yourself).'],
      ['Straighten photos', 'Yes', 'Yes = crop to the whiteboard and fix the angle. No = keep the whole photo and just brighten it.'],
      ['Photo cleanup', DEFAULT_CLEANUP, 'Cloudinary touch-ups applied after straightening. Ask Claude before changing this one.'],
      ['Gemini model', DEFAULT_MODEL, 'Which Gemini model writes the captions. Only change it if Google retires this one.'],
      ['Cloudinary folder', 'bft-playbook', 'Folder name in Cloudinary where photos are stored.'],
      ['Email me if something breaks', 'Yes', 'Yes = you get an email when a board fails to process.']
    ]);
    st.setColumnWidth(1, 200); st.setColumnWidth(2, 380); st.setColumnWidth(3, 520);
    st.getRange('A2:C7').setWrap(true).setVerticalAlignment('top');
    st.setFrozenRows(1);
  }

  // --- Log
  let lg = ss.getSheetByName(TAB.log);
  if (!lg) {
    lg = ss.insertSheet(TAB.log);
    lg.getRange('A1:C1').setValues([['When', 'Where', 'What happened']]).setFontWeight('bold');
    lg.setColumnWidth(1, 150); lg.setColumnWidth(2, 140); lg.setColumnWidth(3, 700);
  }

  // Remove the empty default tab if it's still there
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  // Secret for the Tally link
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WEBHOOK_SECRET')) props.setProperty('WEBHOOK_SECRET', Utilities.getUuid().replace(/-/g, ''));

  // Safety net: check for stuck boards every 15 minutes
  const has = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'processPending');
  if (!has) ScriptApp.newTrigger('processPending').timeBased().everyMinutes(15).create();

  ss.setActiveSheet(en);
  alert_('Playbook', 'All set up.\n\nNext: Playbook → 2. Enter API keys.');
}


/* =====================================================================
   2–4. KEYS AND LINKS
   ===================================================================== */

function enterKeys() {
  let ui;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {
    throw new Error('Run this one from the Sheet: Playbook → 2. Enter API keys (it needs to pop up input boxes, which only works from there).');
  }
  const p = PropertiesService.getScriptProperties();
  const ask = [
    ['GEMINI_API_KEY', 'Gemini API key\n(aistudio.google.com → Get API key)'],
    ['CLOUDINARY_CLOUD_NAME', 'Cloudinary cloud name\n(Cloudinary → Settings → API Keys, shown at the top)'],
    ['CLOUDINARY_API_KEY', 'Cloudinary API key'],
    ['CLOUDINARY_API_SECRET', 'Cloudinary API secret']
  ];
  for (const [k, label] of ask) {
    const note = p.getProperty(k) ? '\n\nAlready saved. Leave blank to keep it.' : '';
    const r = ui.prompt('Playbook keys', label + note, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    const v = r.getResponseText().trim();
    if (v) p.setProperty(k, v);
  }
  ui.alert('Saved. The keys are stored inside the script, not in the sheet, so nobody sees them if you share it.\n\nNext: Playbook → 3. Test my keys.');
}

function testKeys() {
  const results = [];
  try {
    const k = keys_();
    // Gemini
    try {
      const res = UrlFetchApp.fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + config_().model + ':generateContent', {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          headers: { 'x-goog-api-key': k.gemini },
          payload: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the word OK.' }] }] })
        });
      results.push(res.getResponseCode() === 200 ? '✅ Gemini works' : '❌ Gemini: ' + shortErr_(res));
    } catch (e) { results.push('❌ Gemini: ' + e.message); }
    // Cloudinary
    try {
      const res = UrlFetchApp.fetch('https://api.cloudinary.com/v1_1/' + k.cloud + '/ping', {
        muteHttpExceptions: true,
        headers: { Authorization: 'Basic ' + Utilities.base64Encode(k.cloudKey + ':' + k.cloudSecret) }
      });
      results.push(res.getResponseCode() === 200 ? '✅ Cloudinary works' : '❌ Cloudinary: ' + shortErr_(res));
    } catch (e) { results.push('❌ Cloudinary: ' + e.message); }
  } catch (e) { results.push('❌ ' + e.message); }
  alert_('Playbook keys', results.join('\n'));
}

// Shows a popup when run from the Sheet's menu; falls back to the execution log
// when run directly from the Apps Script editor (no popup available there).
function alert_(title, message) {
  try {
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(title + '\n' + message);
  }
}

function showWebhookUrl() {
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  let url = ScriptApp.getService().getUrl();
  if (!secret) { alert_('Playbook', 'Run Playbook → 1. Set up the sheet first.'); return; }
  if (!url) {
    alert_('Playbook', 'The script isn\'t published yet.\n\nIn the Apps Script tab: Deploy → New deployment → gear icon → Web app.\nExecute as: Me. Who has access: Anyone. Then click Deploy and come back here.');
    return;
  }
  url = url.replace(/\/dev$/, '/exec');
  alert_('Link for Tally',
    'Paste this into Tally → your form → Integrations → Webhooks:\n\n' + url + '?key=' + secret +
    '\n\nLink for the website (the developer needs this one):\n\n' + url);
}


/* =====================================================================
   TALLY → SHEET  (runs when a coach submits)
   ===================================================================== */

function doPost(e) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (!e || !e.parameter || !secret || e.parameter.key !== secret) {
      log_('Tally', 'Ignored a request with a wrong or missing key.');
      return json_({ ok: false, error: 'bad key' });
    }
    const body = JSON.parse(e.postData.contents);
    const d = body.data || {};
    const f = parseTally_(d.fields || []);
    const id = String(d.submissionId || d.responseId || body.eventId || Utilities.getUuid());

    const lock = LockService.getDocumentLock();
    lock.waitLock(8000);
    try {
      const sh = entries_();
      if (findRow_(sh, id)) return json_({ ok: true, duplicate: true });
      const h = headers_(sh);
      const row = new Array(sh.getLastColumn()).fill('');
      const put = (name, v) => { if (h[name]) row[h[name] - 1] = v; };
      put('ID', id);
      put('Received', Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd HH:mm'));
      put('Date', f.date);
      put('Session', f.session);
      put('Coach', f.coach);
      put('Week', f.week);
      put('Coach note', f.note);
      put('Tally photo', f.photoUrl);
      put('Status', f.photoUrl ? STATUS.processing : STATUS.error);
      put('Details', f.photoUrl ? 'Waiting to be processed (about a minute).' : 'No photo came through from Tally.');
      sh.appendRow(row);
    } finally {
      lock.releaseLock();
    }
    scheduleSoon_();
    return json_({ ok: true });
  } catch (err) {
    log_('Tally', 'Could not read a submission: ' + err.message);
    return json_({ ok: false, error: String(err.message) });
  }
}

function parseTally_(fields) {
  const low = s => String(s || '').trim().toLowerCase();
  const find = (label, type) => fields.find(x => low(x.label).indexOf(label) === 0 && (!type || x.type === type));
  const text = x => {
    if (!x || x.value == null) return '';
    const v = x.value;
    if (Array.isArray(v)) {
      if (x.options) return v.map(id => { const o = x.options.find(o => o.id === id); return o ? o.text : String(id); }).join(', ');
      return v.map(String).join(', ');
    }
    return String(v).trim();
  };
  const dropdown = label => {
    const x = find(label, 'DROPDOWN') || find(label);
    if (!x) return '';
    let t = text(x);
    // "Other" answers: Tally sends the typed text in a companion field
    if (!t || low(t) === 'other') {
      const other = fields.find(y => y !== x && y.key && x.key && y.key.indexOf(x.key) === 0 && y.value);
      if (other) t = String(other.value).trim();
    }
    return t;
  };
  const photo = find('photo of the whiteboard');
  const file = photo && Array.isArray(photo.value) && photo.value[0];
  return {
    date: text(find('date of the session')),
    session: dropdown('session'),
    coach: dropdown('who drew it'),
    week: text(find('week of the program')),
    note: text(find('anything we should know')),
    photoUrl: file ? file.url : ''
  };
}


/* =====================================================================
   PROCESSING  (photo + captions)
   ===================================================================== */

function runSoon() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runSoon')
    .forEach(t => ScriptApp.deleteTrigger(t));
  processPending();
}

function scheduleSoon_() {
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'runSoon');
  if (!exists) ScriptApp.newTrigger('runSoon').timeBased().after(10 * 1000).create();
}

function processPending() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return; // another run is already on it
  const started = Date.now();
  try {
    const done = {};
    while (Date.now() - started < 4.5 * 60 * 1000) {
      const sh = entries_();
      const h = headers_(sh);
      const vals = sh.getDataRange().getValues();
      const next = vals.slice(1).find(r => {
        const s = r[h['Status'] - 1];
        return (s === STATUS.processing || s === STATUS.retry) && !done[r[h['ID'] - 1]];
      });
      if (!next) return;
      const id = String(next[h['ID'] - 1]);
      done[id] = true;
      processOne_(id);
    }
    scheduleSoon_(); // ran out of time, pick up the rest in a minute
  } finally {
    lock.releaseLock();
  }
}

function redoSelectedRow() {
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== TAB.entries) { alert_('Playbook', 'Click a row in the Entries tab first.'); return; }
  const r = sh.getActiveRange().getRow();
  if (r < 2) { alert_('Playbook', 'Click a row with a board in it (not the header).'); return; }
  const h = headers_(sh);
  sh.getRange(r, h['Status']).setValue(STATUS.retry);
  sh.getRange(r, h['Details']).setValue('Redoing…');
  SpreadsheetApp.flush();
  processPending();
}

function processOne_(id) {
  const sh = entries_();
  const h = headers_(sh);
  const cfg = config_();
  const r0 = findRow_(sh, id);
  if (!r0) return;
  const get = name => String(sh.getRange(findRow_(sh, id), h[name]).getValue() || '').trim();
  const set = (name, v) => sh.getRange(findRow_(sh, id), h[name]).setValue(v);

  try {
    const k = keys_();
    const session = get('Session'), coach = get('Coach');
    // Sheets can turn the Date cell into a real date; keep it as yyyy-MM-dd
    const rawDate = sh.getRange(findRow_(sh, id), h['Date']).getValue();
    const date = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : String(rawDate || '').trim();

    // 1. Save the photo to Cloudinary (only the first time)
    let info = null;
    try { info = JSON.parse(get('Photo info') || 'null'); } catch (e) { info = null; }
    if (!info) {
      const tallyUrl = get('Tally photo');
      if (!tallyUrl) throw new Error('No photo link from Tally.');
      const photoRes = UrlFetchApp.fetch(tallyUrl, { muteHttpExceptions: true });
      if (photoRes.getResponseCode() !== 200) throw new Error('Could not download the photo from Tally (the link may have expired).');
      const name = [date || 'undated', slug_(session || 'board'), id.slice(-6)].join('-');
      const up = cloudUpload_(photoRes.getBlob().setName(name + '.jpg'), cfg.folder + '/' + name, k);
      info = { publicId: up.public_id, w: up.width, h: up.height };
      set('Photo info', JSON.stringify(info));
      set('Original photo', cloudUrl_(k.cloud, 'q_auto', info.publicId));
    }

    // 2. Ask Gemini for captions, transcript and board corners
    const small = UrlFetchApp.fetch(cloudUrl_(k.cloud, 'c_limit,w_1600,h_1600/q_80', info.publicId)).getBlob();
    const prompt = buildPrompt_({ session, coach, date, week: get('Week'), note: get('Coach note') });
    const ai = askGemini_(prompt, small, cfg, k);

    // 3. Straighten + clean the photo, with fallbacks if Cloudinary refuses
    const attempts = [];
    if (cfg.straighten) {
      const s = straighten_(ai, info.w, info.h);
      if (s) attempts.push({ how: 'straightened', t: s.distort + '/' + s.crop + '/' + cfg.cleanup });
      const c = cropOnly_(ai, info.w, info.h);
      if (c) attempts.push({ how: 'cropped (could not straighten)', t: c + '/' + cfg.cleanup });
    }
    attempts.push({ how: cfg.straighten ? 'whole photo (board edges not found)' : 'whole photo', t: cfg.cleanup });
    let clean = '', how = '';
    for (const a of attempts) {
      const url = cloudUrl_(k.cloud, a.t, info.publicId);
      if (UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getResponseCode() === 200) { clean = url; how = a.how; break; }
    }
    if (!clean) throw new Error('Cloudinary could not clean the photo. Check the "Photo cleanup" setting.');

    // 4. Fill in the row
    set('One-liner', tidy_(ai.one_liner));
    set('Subheading', tidy_(ai.subheading));
    set('Transcript', ai.transcript || '');
    if (!get('Week') && ai.week) set('Week', ai.week);
    set('Clean photo', clean);
    const pr = findRow_(sh, id);
    sh.getRange(pr, h['Preview']).setFormula('=IMAGE("' + clean + '")');
    sh.setRowHeight(pr, 90);
    set('Details', 'Done ' + Utilities.formatDate(new Date(), 'Asia/Singapore', 'd MMM, h:mm a') + '. Photo ' + how + '.');
    set('Status', cfg.newStatus);
    CacheService.getScriptCache().remove('live');
  } catch (err) {
    set('Status', STATUS.error);
    set('Details', err.message + '  →  Fix it, then use Playbook → Redo the selected row.');
    log_('Board ' + id, err.message);
    if (cfg.emailErrors) {
      try {
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
          'Playbook: a board failed to process',
          'Board ' + id + ' (' + get('Session') + ', ' + get('Coach') + ') failed:\n\n' + err.message +
          '\n\nOpen the BFT Playbook sheet, fix the problem, click the row and use Playbook → Redo the selected row.\n\n' +
          SpreadsheetApp.getActive().getUrl());
      } catch (e) { /* email is best effort */ }
    }
  }
}


/* =====================================================================
   CLOUDINARY
   ===================================================================== */

function cloudUpload_(blob, publicId, k) {
  const params = {
    invalidate: 'true',
    overwrite: 'true',
    public_id: publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    transformation: 'c_limit,w_2400,h_2400' // keeps phone photos a sensible size
  };
  const toSign = Object.keys(params).sort().map(p => p + '=' + params[p]).join('&') + k.cloudSecret;
  const payload = Object.assign({}, params, { api_key: k.cloudKey, signature: sha1Hex_(toSign), file: blob });
  const res = UrlFetchApp.fetch('https://api.cloudinary.com/v1_1/' + k.cloud + '/image/upload',
    { method: 'post', payload: payload, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Cloudinary upload failed: ' + shortErr_(res));
  return JSON.parse(res.getContentText());
}

function cloudUrl_(cloud, transform, publicId) {
  return 'https://res.cloudinary.com/' + cloud + '/image/upload/' + (transform ? transform + '/' : '') + publicId + '.jpg';
}

// Works out the Cloudinary "distort + crop" that turns the tilted board into a flat rectangle.
function straighten_(ai, W, H) {
  const pts = corners_(ai, W, H);
  if (!pts) return null;
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const w = Math.round((d(pts[0], pts[1]) + d(pts[3], pts[2])) / 2);
  const h = Math.round((d(pts[0], pts[3]) + d(pts[1], pts[2])) / 2);
  if (w < W * 0.25 || h < H * 0.25) return null; // suspiciously small, don't trust it
  const M = homography_(pts, [[0, 0], [w, 0], [w, h], [0, h]]);
  if (!M) return null;
  const img = [[0, 0], [W, 0], [W, H], [0, H]].map(p => project_(M, p));
  if (img.some(p => !p)) return null;
  const xs = img.map(p => p[0]), ys = img.map(p => p[1]);
  const minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
  const maxX = Math.max.apply(null, xs), maxY = Math.max.apply(null, ys);
  const limit = 3 * Math.max(W, H);
  if (maxX - minX > limit || maxY - minY > limit) return null; // too extreme an angle
  const moved = img.map(p => [Math.round(p[0] - minX), Math.round(p[1] - minY)]);
  return {
    distort: 'e_distort:' + moved.map(p => p.join(':')).join(':'),
    crop: 'c_crop,x_' + Math.round(-minX) + ',y_' + Math.round(-minY) + ',w_' + w + ',h_' + h
  };
}

// Simpler fallback: just crop to the box around the board.
function cropOnly_(ai, W, H) {
  const pts = corners_(ai, W, H);
  if (!pts) return null;
  const x0 = Math.max(0, Math.min.apply(null, pts.map(p => p[0])));
  const y0 = Math.max(0, Math.min.apply(null, pts.map(p => p[1])));
  const x1 = Math.min(W, Math.max.apply(null, pts.map(p => p[0])));
  const y1 = Math.min(H, Math.max.apply(null, pts.map(p => p[1])));
  if (x1 - x0 < W * 0.25 || y1 - y0 < H * 0.25) return null;
  return 'c_crop,x_' + Math.round(x0) + ',y_' + Math.round(y0) + ',w_' + Math.round(x1 - x0) + ',h_' + Math.round(y1 - y0);
}

function corners_(ai, W, H) {
  if (!ai || !ai.board_found) return null;
  const pts = ['top_left', 'top_right', 'bottom_right', 'bottom_left'].map(key => {
    const p = ai[key];
    if (!Array.isArray(p) || p.length < 2) return null;
    const y = Number(p[0]), x = Number(p[1]);
    if (!isFinite(x) || !isFinite(y)) return null;
    return [Math.max(0, Math.min(1000, x)) / 1000 * W, Math.max(0, Math.min(1000, y)) / 1000 * H];
  });
  return pts.some(p => !p) ? null : pts;
}

// 4-point perspective transform (maps src corners onto dst corners).
function homography_(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const hv = solve_(A, b);
  if (!hv) return null;
  return [[hv[0], hv[1], hv[2]], [hv[3], hv[4], hv[5]], [hv[6], hv[7], 1]];
}

function project_(M, p) {
  const X = M[0][0] * p[0] + M[0][1] * p[1] + M[0][2];
  const Y = M[1][0] * p[0] + M[1][1] * p[1] + M[1][2];
  const Z = M[2][0] * p[0] + M[2][1] * p[1] + M[2][2];
  if (!(Z > 1e-6)) return null;
  const out = [X / Z, Y / Z];
  return isFinite(out[0]) && isFinite(out[1]) ? out : null;
}

function solve_(A, b) {
  const n = b.length;
  const m = A.map((row, i) => row.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    if (Math.abs(m[piv][c]) < 1e-12) return null;
    const tmp = m[c]; m[c] = m[piv]; m[piv] = tmp;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}


/* =====================================================================
   GEMINI
   ===================================================================== */

function buildPrompt_(v) {
  const pr = SpreadsheetApp.getActive().getSheetByName(TAB.prompts);
  const map = {};
  if (pr) pr.getDataRange().getValues().slice(1).forEach(r => { map[String(r[0]).trim()] = String(r[1]); });
  const template = map['Caption prompt'] || DEFAULT_PROMPT;
  const examples = map['Example one-liners'] || DEFAULT_EXAMPLES;
  const fill = {
    session: v.session || 'unknown',
    coach: v.coach || 'unknown',
    date: prettyDate_(v.date),
    week: v.week || 'not given',
    coach_note: v.note || 'none',
    examples: examples
  };
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in fill ? fill[key] : m)) + FIXED_INSTRUCTIONS;
}

function askGemini_(prompt, imageBlob, cfg, k) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + cfg.model + ':generateContent';
  const body = {
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: 'image/jpeg', data: Utilities.base64Encode(imageBlob.getBytes()) } }
    ] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA, temperature: 0.8 }
  };
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': k.gemini }, payload: JSON.stringify(body)
    });
    const code = res.getResponseCode();
    if (code === 200) break;
    if (code === 429 || code >= 500) { Utilities.sleep(15000 * (attempt + 1)); continue; }
    break;
  }
  if (res.getResponseCode() !== 200) throw new Error('Gemini error: ' + shortErr_(res));
  const j = JSON.parse(res.getContentText());
  const cand = j.candidates && j.candidates[0];
  const txt = cand && cand.content && cand.content.parts ? cand.content.parts.map(p => p.text || '').join('') : '';
  if (!txt) throw new Error('Gemini returned nothing' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.');
  const out = JSON.parse(txt);
  if (!out.one_liner || !out.subheading) throw new Error('Gemini left the one-liner or subheading empty.');
  return out;
}


/* =====================================================================
   WEBSITE → reads Live boards from here
   ===================================================================== */

function doGet() {
  const cache = CacheService.getScriptCache();
  let out = cache.get('live');
  if (!out) {
    const sh = entries_();
    const vals = sh.getDataRange().getDisplayValues();
    const h = headers_(sh);
    const g = (r, n) => (h[n] ? String(r[h[n] - 1] || '').trim() : '');
    const boards = vals.slice(1)
      .filter(r => g(r, 'Status') === STATUS.live && g(r, 'Clean photo'))
      .map(r => ({
        id: [g(r, 'Date'), slug_(g(r, 'Session')), g(r, 'ID').slice(-6)].join('-'),
        date: g(r, 'Date'),
        program: g(r, 'Session'),
        category: categoryFor_(g(r, 'Session')),
        progression: g(r, 'Week'),
        coach: g(r, 'Coach'),
        quip: g(r, 'One-liner'),
        note: g(r, 'Subheading'),
        image: g(r, 'Clean photo'),
        original: g(r, 'Original photo'),
        transcript: g(r, 'Transcript')
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    out = JSON.stringify({ updated: new Date().toISOString(), coaches: coaches_(), boards: boards });
    if (out.length < 90000) cache.put('live', out, 120);
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// Starting list used to fill the Sessions tab the first time it's created.
// After that, the Sessions tab is the master list: edit it there, not here.
const SESSION_CATEGORY = {
  'Balance': 'Strength', 'Pause Reps': 'Strength', 'Power': 'Strength', 'Strength': 'Strength',
  'Cardio Summit': 'Cardio', 'Cardio U': 'Cardio', 'Summit': 'Cardio',
  'HIIT': 'HIIT',
  'Shred': 'Hybrid', 'Strength Endurance': 'Hybrid'
};
// The website's workout types. The Sessions tab's Type column must use one of these.
const CATEGORIES = ['Cardio', 'Strength', 'HIIT', 'Hybrid'];

// Creates the Sessions tab (the master list of sessions) if it isn't there yet,
// pre-filled with the sessions above. Safe to call any time.
function ensureSessionsTab_() {
  const ss = SpreadsheetApp.getActive();
  let se = ss.getSheetByName(TAB.sessions);
  if (se) return se;
  const co = ss.getSheetByName(TAB.coaches);
  se = ss.insertSheet(TAB.sessions, co ? co.getIndex() : 2);
  se.getRange(1, 1, 1, 3).setValues([['Session', 'Type', 'Notes']])
    .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF');
  const rows = Object.keys(SESSION_CATEGORY).sort().map(k => [k, SESSION_CATEGORY[k], '']);
  se.getRange(2, 1, rows.length, 3).setValues(rows);
  se.getRange(2, 2, se.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(CATEGORIES, true).setAllowInvalid(false)
    .setHelpText('Pick the workout type the website files this session under.').build());
  se.setColumnWidth(1, 200); se.setColumnWidth(2, 110); se.setColumnWidth(3, 320);
  se.setFrozenRows(1);
  return se;
}

// Session name -> Type, read from the Sessions tab (once per run).
let SESSION_MAP_ = null;
function sessionMap_() {
  if (SESSION_MAP_) return SESSION_MAP_;
  const map = {};
  const se = SpreadsheetApp.getActive().getSheetByName(TAB.sessions);
  if (se && se.getLastRow() > 1) {
    se.getRange(2, 1, se.getLastRow() - 1, 2).getDisplayValues().forEach(r => {
      const n = String(r[0]).trim(), t = String(r[1]).trim();
      if (n) map[n.toLowerCase()] = CATEGORIES.indexOf(t) >= 0 ? t : 'Hybrid';
    });
  } else {
    Object.keys(SESSION_CATEGORY).forEach(k => { map[k.toLowerCase()] = SESSION_CATEGORY[k]; });
  }
  SESSION_MAP_ = map;
  return map;
}

function categoryFor_(session) {
  return sessionMap_()[String(session || '').trim().toLowerCase()] || 'Hybrid';
}

// Reads the "Coaches" tab into the shape the website's coach cards expect.
function coaches_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.coaches);
  if (!sh) return [];
  const vals = sh.getDataRange().getDisplayValues();
  const h = {};
  (vals[0] || []).forEach((name, i) => { if (name) h[String(name).trim()] = i; });
  const g = (r, n) => (n in h ? String(r[h[n]] || '').trim() : '');
  return vals.slice(1)
    .filter(r => g(r, 'Name') && g(r, 'Show on site') !== 'No')
    .map(r => ({
      id: slug_(g(r, 'Name')),
      name: g(r, 'Name'),
      role: g(r, 'Role') || 'Coach',
      specialty: g(r, 'Specialty'),
      yearsCoaching: g(r, 'Years coaching'),
      oneLiner: g(r, 'One-liner'),
      bio: g(r, 'Bio'),
      favouriteSession: g(r, 'Favourite session'),
      signatureDoodle: g(r, 'Signature doodle'),
      instagram: g(r, 'Instagram'),
      photo: g(r, 'Photo URL')
    }));
}


/* =====================================================================
   SMALL HELPERS
   ===================================================================== */

function entries_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(TAB.entries);
  if (!sh) throw new Error('No "Entries" tab. Run Playbook → 1. Set up the sheet.');
  return sh;
}

function headers_(sh) {
  const row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const h = {};
  row.forEach((name, i) => { if (name) h[String(name).trim()] = i + 1; });
  return h;
}

function findRow_(sh, id) {
  const h = headers_(sh);
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, h['ID'], last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function config_() {
  const st = SpreadsheetApp.getActive().getSheetByName(TAB.settings);
  const m = {};
  if (st) st.getDataRange().getValues().slice(1).forEach(r => { m[String(r[0]).trim()] = String(r[1]).trim(); });
  const newStatus = [STATUS.live, STATUS.hidden].indexOf(m['New boards go']) >= 0 ? m['New boards go'] : STATUS.live;
  return {
    newStatus: newStatus,
    straighten: !/^no/i.test(m['Straighten photos'] || 'Yes'),
    cleanup: (m['Photo cleanup'] || DEFAULT_CLEANUP).replace(/^\/+|\/+$/g, ''),
    model: m['Gemini model'] || DEFAULT_MODEL,
    folder: slug_(m['Cloudinary folder'] || 'bft-playbook'),
    emailErrors: !/^no/i.test(m['Email me if something breaks'] || 'Yes')
  };
}

function keys_() {
  const p = PropertiesService.getScriptProperties();
  const k = {
    gemini: p.getProperty('GEMINI_API_KEY'),
    cloud: p.getProperty('CLOUDINARY_CLOUD_NAME'),
    cloudKey: p.getProperty('CLOUDINARY_API_KEY'),
    cloudSecret: p.getProperty('CLOUDINARY_API_SECRET')
  };
  const missing = [];
  if (!k.gemini) missing.push('Gemini API key');
  if (!k.cloud || !k.cloudKey || !k.cloudSecret) missing.push('Cloudinary keys');
  if (missing.length) throw new Error('Missing ' + missing.join(' and ') + '. Use Playbook → 2. Enter API keys.');
  return k;
}

function log_(where, msg) {
  try {
    const lg = SpreadsheetApp.getActive().getSheetByName(TAB.log);
    if (!lg) return;
    lg.appendRow([Utilities.formatDate(new Date(), 'Asia/Singapore', 'yyyy-MM-dd HH:mm'), where, msg]);
    if (lg.getLastRow() > 600) lg.deleteRows(2, 100);
  } catch (e) { /* never let logging break anything */ }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function shortErr_(res) {
  const t = res.getContentText();
  try {
    const j = JSON.parse(t);
    return (j.error && (j.error.message || j.error)) || t.slice(0, 200);
  } catch (e) { return res.getResponseCode() + ' ' + t.slice(0, 200); }
}

function sha1Hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function slug_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
}

function prettyDate_(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso || 'unknown date';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return Number(m[3]) + ' ' + months[Number(m[2]) - 1] + ' ' + m[1];
}

// House style: no em dashes, tidy spacing.
function tidy_(s) {
  return String(s || '').replace(/\s*—\s*/g, ', ').replace(/\s+–\s+/g, ', ').replace(/\s+/g, ' ').trim();
}


/* =====================================================================
   COACHES + SESSIONS TABS → TALLY FORM  (keeps the two dropdowns in sync)
   ---------------------------------------------------------------------
   The Coaches and Sessions tabs are the master lists. Their names are
   written into the "Who drew it?" and "Session" dropdowns of the Tally
   form, in the same order as the tabs. Runs by itself whenever either
   tab changes (after Playbook → Turn on automatic Tally sync), or on
   demand from the menu.
   ===================================================================== */

const TALLY_FORM_ID = 'obW8Je';
const TALLY_LISTS = [
  { tab: 'coaches',  column: 'Name',    question: 'Who drew it?', label: 'coaches' },
  { tab: 'sessions', column: 'Session', question: 'Session',      label: 'sessions' }
];

function enterTallyKey() {
  const ui = SpreadsheetApp.getUi();
  const p = PropertiesService.getScriptProperties();
  const note = p.getProperty('TALLY_API_KEY') ? '\n\nAlready saved. Leave blank to keep it.' : '';
  const r = ui.prompt('Tally API key', 'Paste your Tally API key\n(tally.so → Settings → API keys → Create API key)' + note, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const v = r.getResponseText().trim();
  if (v) p.setProperty('TALLY_API_KEY', v);
  ui.alert(v ? 'Saved. Next: Playbook → Turn on automatic Tally sync.' : 'Nothing changed.');
}

function turnOnTallySync() {
  const ss = SpreadsheetApp.getActive();
  ensureSessionsTab_();
  ScriptApp.getProjectTriggers()
    .filter(t => ['onCoachesChange', 'onMasterListChange'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onMasterListChange').forSpreadsheet(ss).onChange().create();
  let msg;
  try { msg = syncTally_(true); } catch (err) { msg = '❌ ' + err.message; }
  SpreadsheetApp.getUi().alert('Automatic Tally sync is on.\n\nAny time you add, rename or remove a row on the Coaches or Sessions tab, the matching dropdown in the Tally form updates within a few seconds.\n\n' + msg);
}

// Runs on every change to the spreadsheet; only acts on the Coaches and Sessions tabs.
function onMasterListChange(e) {
  try {
    const sheet = e && e.source ? e.source.getActiveSheet() : null;
    if (sheet && [TAB.coaches, TAB.sessions].indexOf(sheet.getName()) < 0) return;
    syncTally_(false);
  } catch (err) {
    log_('Tally sync', 'Failed: ' + err.message);
  }
}
function onCoachesChange(e) { onMasterListChange(e); } // older trigger name, kept so it still works

function syncToTally() {
  let msg;
  try { ensureSessionsTab_(); msg = syncTally_(true); } catch (err) { msg = '❌ ' + err.message; log_('Tally sync', 'Failed: ' + err.message); }
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* run from editor */ }
  return msg;
}

function listFromTab_(tabName, column) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return [];
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const c = head.indexOf(column);
  if (c < 0) return [];
  const seen = {};
  return sh.getRange(2, c + 1, sh.getLastRow() - 1, 1).getDisplayValues()
    .map(r => String(r[0]).trim())
    .filter(n => n && !seen[n.toLowerCase()] && (seen[n.toLowerCase()] = true));
}

function syncTally_(force) {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty('TALLY_API_KEY');
  if (!apiKey) throw new Error('No Tally API key yet. Use Playbook → Enter Tally API key.');

  const lists = TALLY_LISTS.map(l => Object.assign({}, l, { names: listFromTab_(TAB[l.tab], l.column) }));
  lists.forEach(l => { if (!l.names.length) throw new Error('No names found in the ' + l.column + ' column of the ' + TAB[l.tab] + ' tab.'); });
  const sig = JSON.stringify(lists.map(l => l.names));
  if (!force && p.getProperty('TALLY_LISTS_SYNCED') === sig) return 'Already up to date.';

  const headers = { Authorization: 'Bearer ' + apiKey };
  const res = UrlFetchApp.fetch('https://api.tally.so/forms/' + TALLY_FORM_ID, { headers: headers, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not read the Tally form: ' + shortErr_(res));
  let blocks = JSON.parse(res.getContentText()).blocks || [];

  const notes = [];
  let changed = false;
  lists.forEach(l => {
    const r = replaceDropdown_(blocks, l.question, l.names);
    blocks = r.blocks;
    if (r.changed) { changed = true; notes.push(l.label + ': ' + r.note); }
  });

  if (changed) {
    const up = UrlFetchApp.fetch('https://api.tally.so/forms/' + TALLY_FORM_ID, {
      method: 'patch', contentType: 'application/json', headers: headers, muteHttpExceptions: true,
      payload: JSON.stringify({ blocks: blocks, status: 'PUBLISHED' })
    });
    if (up.getResponseCode() !== 200) throw new Error('Tally refused the update: ' + shortErr_(up));
    log_('Tally sync', 'Dropdowns updated. ' + notes.join(' '));
  }
  p.setProperty('TALLY_LISTS_SYNCED', sig);
  const counts = lists.map(l => l.names.length + ' ' + l.label).join(', ');
  return changed ? '✅ Tally form updated (' + counts + '). ' + notes.join(' ')
                 : '✅ The Tally form already matches your tabs (' + counts + ').';
}

// Rewrites the options of the dropdown that follows the question titled `question`.
// Existing options keep their ids; an "Other" option, if the form has one, stays last.
function replaceDropdown_(blocks, question, names) {
  const plain = b => {
    const h = b.payload && b.payload.safeHTMLSchema;
    return (h ? JSON.stringify(h).replace(/<[^>]*>|[\[\]"]/g, '') : String((b.payload && (b.payload.text || b.payload.title)) || '')).trim();
  };
  const t = blocks.findIndex(b => b.type === 'TITLE' && plain(b).toLowerCase() === question.toLowerCase());
  if (t < 0 || !blocks[t + 1] || blocks[t + 1].type !== 'DROPDOWN_OPTION') {
    throw new Error('Could not find the "' + question + '" dropdown in the Tally form. Was the question renamed?');
  }
  const groupUuid = blocks[t + 1].groupUuid;
  let end = t + 1;
  while (blocks[end] && blocks[end].groupUuid === groupUuid) end++;
  const old = blocks.slice(t + 1, end);
  const isOther = b => !!(b.payload && b.payload.isOtherOption);
  const other = old.find(isOther);
  const template = old.find(b => !isOther(b)) || old[0];
  const byName = {};
  old.forEach(b => { if (!isOther(b)) byName[String(b.payload.text || '').trim().toLowerCase()] = b; });
  const current = old.filter(b => !isOther(b)).map(b => String(b.payload.text || '').trim());
  if (JSON.stringify(current) === JSON.stringify(names)) return { blocks: blocks, changed: false };

  const opts = names.map(n => {
    const existing = byName[n.toLowerCase()];
    const b = JSON.parse(JSON.stringify(existing || template));
    if (!existing) b.uuid = Utilities.getUuid();
    b.payload.text = n;
    b.payload.isOtherOption = false;
    return b;
  });
  if (other) opts.push(other);
  opts.forEach((b, i) => {
    b.groupUuid = groupUuid;
    b.payload.index = i;
    b.payload.isFirst = i === 0;
    b.payload.isLast = i === opts.length - 1;
  });
  const added = names.filter(n => !current.some(c => c.toLowerCase() === n.toLowerCase()));
  const removed = current.filter(c => !names.some(n => n.toLowerCase() === c.toLowerCase()));
  const note = (added.length ? 'added ' + added.join(', ') + '. ' : '') + (removed.length ? 'removed ' + removed.join(', ') + '. ' : '') + (!added.length && !removed.length ? 'reordered. ' : '');
  return { blocks: blocks.slice(0, t + 1).concat(opts, blocks.slice(end)), changed: true, note: note.trim() };
}


/* =====================================================================
   ONE-TIME: bring the 13 boards from the first version of the site
   (the old data.js file) into the Entries tab as Live rows, and carry
   over Jay's photo. Safe to run twice: rows already there are skipped.
   Playbook → Import the 13 old boards. Can be deleted once it's done.
   ===================================================================== */

const LEGACY_BOARDS = [
 {
  "ID": "LGCY01",
  "Date": "2026-02-19",
  "Session": "Strength",
  "Coach": "Jay",
  "Week": "",
  "One-liner": "0-2-0 means two full seconds on the way down. Yes, I'm counting.",
  "Subheading": "Four exercises, four sets. Warm up, slow it down on a 0-2-0 tempo, then load up for 8 to 10 reps.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260219183642.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260219183642.jpg",
  "Transcript": "Strength. 4 exercises, 4 sets. 1: Warm ups, mobility drills, 2 mins each screen. 2: Tempo work, 0-2-0. 3: 8-10RM load. KB walk, BB back squat, deadlift, lunges.",
  "Details": "Imported from the first version of the site (data.js id: strength-4-sets).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260219183642\"}"
 },
 {
  "ID": "LGCY02",
  "Date": "2026-02-20",
  "Session": "Balance",
  "Coach": "Sherlyn",
  "Week": "Final",
  "One-liner": "Screen 2 is slow on purpose. The wobble is the workout.",
  "Subheading": "Screens 1 and 3 get 45 seconds of work. Screen 2 is slow and controlled, technique first.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260220183806.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260220183806.jpg",
  "Transcript": "Final! Ba-lance. Screen 1 and 3: 4 exercises, 45 secs of work, 20s rest, x3. Screen 2: 2 exercises, slow and controlled, technique first. 5 reps, you go I go, 6 mins.",
  "Details": "Imported from the first version of the site (data.js id: balance-final).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260220183806\"}"
 },
 {
  "ID": "LGCY03",
  "Date": "2026-03-11",
  "Session": "HIIT",
  "Coach": "Kenny",
  "Week": "1/8",
  "One-liner": "Fifteen seconds is short. Make it feel long.",
  "Subheading": "Near max effort, always. Five sets of 15 seconds on, 10 off.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260311173705.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260311173705.jpg",
  "Transcript": "HIIT, high intensity interval training, progression 1/8. Focus: near max effort always. 5 sets, 15s on / 10s off. Use rest between exercises to reset and recover. 1: Machines (ski erg, row, bikes): accelerate fast, maintain and hold. 2: Explosives (box jumps, battle ropes): vertical force output, trunk control. 3: Mixed conditioning (burpees, powerbag thrusters): watch posture when tired, control breathing.",
  "Details": "Imported from the first version of the site (data.js id: hiit-1-of-8).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260311173705\"}"
 },
 {
  "ID": "LGCY04",
  "Date": "2026-04-03",
  "Session": "Cardio Summit",
  "Coach": "Meldon",
  "Week": "",
  "One-liner": "Your partner rests while you work. Try not to take it personally.",
  "Subheading": "Six zones. Finish your targets, swap with your partner, keep alternating for six minutes. Consistency, not kill your partner!",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260403100613.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260403100613.jpg",
  "Transcript": "Cardio Summit, 3 April. Training intention: build cardio endurance. 6 zones: main exercise (odd numbers) and accessory (even numbers). Focus on high sustainable aerobic output, about 85-89%. Finish your targets, then swap with partner and keep alternating for 6 mins. Consistency, not kill your partner!",
  "Details": "Imported from the first version of the site (data.js id: cardio-summit-april).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260403100613\"}"
 },
 {
  "ID": "LGCY05",
  "Date": "2026-04-22",
  "Session": "Cardio Summit",
  "Coach": "Meldon",
  "Week": "5/8",
  "One-liner": "There's a mountain on the board. You're climbing it three times.",
  "Subheading": "Three sets of 60 seconds per exercise. Climb the mountain at 85 to 89% heart rate, rest at the peak.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260422180429.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260422180429.jpg",
  "Transcript": "Cardio Summit, progression 5/8. Steady effort heart rate climbing to 85-89%, rest, times 3. Per exercise: 3 sets of 60 secs. Improve aerobic power and anaerobic tolerance.",
  "Details": "Imported from the first version of the site (data.js id: cardio-summit-5-of-8).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260422180429\"}"
 },
 {
  "ID": "LGCY06",
  "Date": "2026-05-09",
  "Session": "Shred",
  "Coach": "Kenny",
  "Week": "Final",
  "One-liner": "Cardio first or strength first? Either way, you're sweating by zone two.",
  "Subheading": "Pick your order: cardio first or strength first. Work under fatigue and keep every rep clean.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260509103441.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260509103441.jpg",
  "Transcript": "Shred, final progression. Cardio, strength 1, cardio, strength 2, or strength 1, cardio, strength 2, cardio. Cardio: 1 set x 45s, summit style. Strength: 3 sets x 40s on / 35s off. Work under fatigue, improve quality movements. Cardio first? Improve cardiovascular endurance. Good luck. Strength first? Build strength baby! Have fun.",
  "Details": "Imported from the first version of the site (data.js id: shred-final).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260509103441\"}"
 },
 {
  "ID": "LGCY07",
  "Date": "2026-06-08",
  "Session": "Strength Endurance",
  "Coach": "Jay",
  "Week": "2nd",
  "One-liner": "Thirty-five seconds, six sets, six zones. Bring a towel. Bring two.",
  "Subheading": "Six zones, two exercises each. Superset 35 seconds per exercise, six sets per zone.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260608183814.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260608183814.jpg",
  "Transcript": "Strength Endurance, 2nd progression. Focus: building and improving overall endurance, strength and cardio. 6 zones, 2 exercises per zone. Superset, 35 secs per exercise, rest 30 secs, 6 sets per zone. DB RDL: hinge, neutral spine, tension in hamstrings. KB shoulder press: stable trunk, brace, reset after each rep. Deadball squat: avoid knees collapsing and excessive fwd lean. Dips/pushups: shoulder positioning, range of motion.",
  "Details": "Imported from the first version of the site (data.js id: strength-endurance-2).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260608183814\"}"
 },
 {
  "ID": "LGCY08",
  "Date": "2026-06-25",
  "Session": "Summit",
  "Coach": "Sherlyn",
  "Week": "4th",
  "One-liner": "Stay in the purple. I can see your heart rate on the screen.",
  "Subheading": "Controlled intensity, steady state. Keep it in the purple zone, 80 to 89% heart rate. I have the power!",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260625091223.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260625091223.jpg",
  "Transcript": "Summit, 4th progression. Set 1, set 2, set 3, maintain purple heart rate 80-89%. Target your aerobic capacity, improve your cardiovascular endurance. Controlled intensity and maintain steady state workout. Focus on movement efficiency and breathing techniques. I have the power!",
  "Details": "Imported from the first version of the site (data.js id: summit-4th).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260625091223\"}"
 },
 {
  "ID": "LGCY09",
  "Date": "2026-08-13",
  "Session": "Summit",
  "Coach": "Meldon",
  "Week": "3/6",
  "One-liner": "Every round gets longer. Your breathing shouldn't get louder.",
  "Subheading": "Work time climbs from 35 to 60 seconds. Build momentum, pace your breathing, swap in a zone.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260813083249.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260813083249.jpg",
  "Transcript": "Summit, progression 3/6. Strategy: build momentum, pace your breathing, sustain your effort under fatigue. Format: ascending work time, 80-89% HR zone. 35, 45, 55, 60 sec, 50 sec rest, 8 sets total. 1 zone = 2 exercises, total 6 zones = 12 exercises, swap in a zone. Hip switches: tabletop position, shoulders and knees close, pivot feet, hips low. Alternate: mountain climber. Rower: push feet away first, lean back slightly, handle to sternum, 30-35 strokes per minute, watch the force curve.",
  "Details": "Imported from the first version of the site (data.js id: summit-3-of-6).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260813083249\"}"
 },
 {
  "ID": "LGCY10",
  "Date": "2026-08-17",
  "Session": "Pause Reps",
  "Coach": "Jay",
  "Week": "",
  "One-liner": "Ken the Hen has better legs than most of you. Let's fix that.",
  "Subheading": "Pause at mid-shin on the deadlift and at the bottom of the squat. No chicken legs today.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260817095546.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260817095546.jpg",
  "Transcript": "Program: 2 mins 30 secs, 5 reps per set. Pause reps: challenge your stability and control, more time under tension, no momentum. BB deadlift: pause at mid-shin, 65-75% of 5RM, maintain tension before pushing feet away from floor. KB front squat: pause at bottom of squat, maintain upright torso, push feet away from floor. Ken the (Jacked) Hen: no chicken legs today, let's build strong legs baby!",
  "Details": "Imported from the first version of the site (data.js id: pause-reps).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260817095546\"}"
 },
 {
  "ID": "LGCY11",
  "Date": "2026-09-04",
  "Session": "Cardio U",
  "Coach": "Sherlyn",
  "Week": "",
  "One-liner": "Six sets, no stopping. Pikachu did it with tiny legs.",
  "Subheading": "Six sets of 30 seconds, non-stop. If Pika can do it, so can you.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260904131209.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260904131209.jpg",
  "Transcript": "Cardio U. Intensity chart across 6 sets. 6 sets, 30s per set, non-stop. Controlled movements under fatigue. Improve aerobic endurance and recovery speed. Build stamina and pace control. If Pika can do it, so can you! Please wipe down the equipment once done too.",
  "Details": "Imported from the first version of the site (data.js id: cardio-u).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260904131209\"}"
 },
 {
  "ID": "LGCY12",
  "Date": "2026-09-25",
  "Session": "Cardio U",
  "Coach": "Kenny",
  "Week": "",
  "One-liner": "Cardio? Ewww. I know. I drew a cat so you'd forgive me.",
  "Subheading": "Three zones of four exercises, two laps each. Match your intensity to your heart rate and speed up as you go.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-IMG20260925090237.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-IMG20260925090237.jpg",
  "Transcript": "Cardio - ewww. Format: 3 zones of 4 exercises, 2 sets on each exercise, 2 laps in the zone. Complete all 3 zones. Objective: regulate intensity to match HR, heart rate control, pacing awareness, progressive acceleration. A-meow-tti.",
  "Details": "Imported from the first version of the site (data.js id: cardio-ewww).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-IMG20260925090237\"}"
 },
 {
  "ID": "LGCY13",
  "Date": "2026-09-26",
  "Session": "Power",
  "Coach": "Sherlyn",
  "Week": "1/4",
  "One-liner": "Grind like you mean it. Explode like you meant that too.",
  "Subheading": "Paired up, 90 seconds to finish both moves. Grind slow and controlled, then get explosive and sharp.",
  "Clean photo": "https://res.cloudinary.com/demyvto4/image/upload/c_limit,w_1800/q_auto/bft-playbook-legacy/full-power-1of4.jpg",
  "Original photo": "https://res.cloudinary.com/demyvto4/image/upload/q_auto/bft-playbook-legacy/original-power-1of4.jpg",
  "Transcript": "Power! 1/4. Format: 90 secs to finish both. Paired up, grind 1st and explosive 2nd exercises. Pair A sets 1,3,5,7,9. Pair B sets 2,4,6,8,10. Please read, if don't know, ask! Grind: movement should be slow and controlled, to activate your working muscles, shouldn't fatigue out. Explosive: fast and sharp movement, always come to a dead stop each rep, shouldn't struggle to complete reps. Front squat press, hang pull, KB swing.",
  "Details": "Imported from the first version of the site (data.js id: power-1of4).",
  "Photo info": "{\"publicId\": \"bft-playbook-legacy/full-power-1of4\"}"
 }
];
const LEGACY_JAY_PHOTO = 'https://kavyaj.github.io/bft-bw-flipbook/images/coaches/jay.jpg';

function importLegacyBoards() {
  const sh = entries_();
  const h = headers_(sh);
  let added = 0, skipped = 0;
  LEGACY_BOARDS.forEach(b => {
    if (findRow_(sh, b.ID)) { skipped++; return; }
    const row = new Array(sh.getLastColumn()).fill('');
    const put = (name, v) => { if (h[name]) row[h[name] - 1] = v; };
    Object.keys(b).forEach(k => put(k, b[k]));
    put('Received', 'legacy import');
    put('Status', STATUS.live);
    const r = sh.getLastRow() + 1;
    ['ID', 'Date', 'Week', 'Received'].forEach(n => { if (h[n]) sh.getRange(r, h[n]).setNumberFormat('@'); });
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    if (h['Preview']) sh.getRange(r, h['Preview']).setFormula('=IMAGE("' + b['Clean photo'] + '")');
    added++;
  });

  // Jay's photo from the old site, if his Photo URL cell is empty
  let photo = '';
  const co = SpreadsheetApp.getActive().getSheetByName(TAB.coaches);
  if (co && co.getLastRow() > 1) {
    const vals = co.getDataRange().getDisplayValues();
    const nameC = vals[0].indexOf('Name'), photoC = vals[0].indexOf('Photo URL');
    const r = vals.findIndex((row, i) => i > 0 && String(row[nameC]).trim().toLowerCase() === 'jay');
    if (r > 0 && photoC >= 0 && !String(vals[r][photoC]).trim()) {
      co.getRange(r + 1, photoC + 1).setValue(LEGACY_JAY_PHOTO);
      photo = ' Added Jay\'s photo to the Coaches tab.';
    }
  }
  try { CacheService.getScriptCache().remove('live'); } catch (e) {}
  log_('Import', 'Old boards: ' + added + ' added, ' + skipped + ' already there.' + photo);
  const msg = added + ' old boards added to Entries as Live' + (skipped ? ' (' + skipped + ' were already there)' : '') + '.' + photo +
    '\n\nThe coach names on these are placeholders. Fix any Coach cell if the artist is wrong.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}
