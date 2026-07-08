import { type InspectionReport, type InspectionStatus } from '../types';

export const SPREADSHEET_ID = '1oPtmW48ulGsJ3MTa1vpVJHVbo4-o3rrq9IVb-LnaEIA';
export const FOLDER_ID = '137gSHDKjx_fgop_NTPZNdCGFZzOVOFUG';

const EXPECTED_HEADERS = [
  'วันเวลาที่กรอก',
  'หมายเลขหม้อแปลง',
  'วันและเวลาตรวจสอบ',
  'ผลการตรวจสอบ',
  'พิกัด Latitude',
  'พิกัด Longitude',
  'ลิงก์รูปถ่าย',
  'รายละเอียดเพิ่มเติม',
  'ผู้กรอกรายงาน'
];

/**
 * Exponential backoff helper for resilient API requests
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (res.status === 429 || res.status >= 500) {
      if (retries > 0) {
        console.warn(`Request failed with status ${res.status}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Request failed with network error. Retrying in ${delay}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

/**
 * Fetches the sheet properties to identify the first tab name
 */
export async function getFirstSheetName(accessToken: string): Promise<string> {
  try {
    const res = await fetchWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (!res.ok) throw new Error('Cannot fetch spreadsheet metadata');
    const data = await res.json();
    if (data.sheets && data.sheets.length > 0) {
      return data.sheets[0].properties.title;
    }
    return 'Sheet1';
  } catch (err) {
    console.error('Error fetching sheet name, defaulting to Sheet1:', err);
    return 'Sheet1';
  }
}

/**
 * Checks if the header row exists and creates it if the spreadsheet is empty
 */
export async function initializeSheetHeaders(accessToken: string): Promise<string> {
  const sheetName = await getFirstSheetName(accessToken);
  try {
    // Read the first row to check headers
    const res = await fetchWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:I1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!res.ok) {
      console.warn('Could not read sheet headers, trying to write headers directly.');
    }

    const data = await res.json();
    const hasHeaders = data.values && data.values.length > 0 && data.values[0].length > 0;

    if (!hasHeaders) {
      console.log(`Sheet "${sheetName}" is empty. Initializing headers...`);
      const appendRes = await fetchWithRetry(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [EXPECTED_HEADERS]
          })
        }
      );
      if (!appendRes.ok) {
        throw new Error('Failed to append headers to spreadsheet');
      }
    }
    return sheetName;
  } catch (err) {
    console.error('Error in initializeSheetHeaders:', err);
    return sheetName;
  }
}

/**
 * Appends an inspection report as a new row in Google Sheets
 */
export async function appendInspectionReport(
  report: InspectionReport,
  accessToken: string
): Promise<void> {
  const sheetName = await initializeSheetHeaders(accessToken);

  const row = [
    report.timestamp,
    report.transformerId,
    report.inspectionDate,
    report.status,
    report.latitude,
    report.longitude,
    report.photoUrl,
    report.details,
    report.inspectorEmail
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A:I:append?valueInputOption=USER_ENTERED`;

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [row]
    })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to save data to Google Sheets: ${res.statusText}. ${JSON.stringify(errorData)}`
    );
  }
}

/**
 * Uploads a file (photo) to Google Drive in the target folder
 */
export async function uploadPhotoToDrive(
  file: File,
  accessToken: string
): Promise<{ id: string; webViewLink: string }> {
  const boundary = '314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  // Format file name with transformer details or timestamp
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `Transformer_Inspection_${Date.now()}.${extension}`;

  const metadata = {
    name: fileName,
    parents: [FOLDER_ID]
  };

  const metadataPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaPartHeader = `Content-Type: ${file.type || 'image/jpeg'}\r\n\r\n`;

  // Construct multipart body using a Blob to handle binary data correctly
  const multipartBlob = new Blob(
    [
      delimiter,
      metadataPart,
      delimiter,
      mediaPartHeader,
      file,
      close_delim
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';

  const res = await fetchWithRetry(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBlob
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Google Drive upload failed: ${res.statusText}. ${JSON.stringify(errData)}`);
  }

  const result = await res.json();
  const fileId = result.id;

  // Set file permissions to 'anyone with the link can view' so it can be viewed in the UI and report links
  try {
    const permissionUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
    const permRes = await fetchWithRetry(permissionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    if (!permRes.ok) {
      console.warn('Could not set public permissions on uploaded file:', fileId);
    }
  } catch (err) {
    console.error('Error sharing Google Drive file:', err);
  }

  return {
    id: fileId,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
  };
}

/**
 * Fetches recent report rows from the Google Sheet
 */
export async function fetchRecentReports(accessToken: string): Promise<InspectionReport[]> {
  const sheetName = await getFirstSheetName(accessToken);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}!A2:I100`;

  try {
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      console.warn('Could not fetch rows. Spreadsheet might be empty or uninitialized.');
      return [];
    }

    const data = await res.json();
    if (!data.values || data.values.length === 0) {
      return [];
    }

    return data.values.map((row: any[]) => ({
      timestamp: row[0] || '',
      transformerId: row[1] || '',
      inspectionDate: row[2] || '',
      status: (row[3] as InspectionStatus) || 'normal',
      latitude: row[4] || '',
      longitude: row[5] || '',
      photoUrl: row[6] || '',
      details: row[7] || '',
      inspectorEmail: row[8] || ''
    })).reverse(); // Show newest first
  } catch (err) {
    console.error('Error fetching recent reports:', err);
    return [];
  }
}
