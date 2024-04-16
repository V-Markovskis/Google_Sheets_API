const express = require("express");

const { google } = require("googleapis");
const {sheets} = require("googleapis/build/src/apis/sheets");
const testData = require('./test-data.js');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const port = 8080;

//This allows us to parse the incoming request body as JSON
app.use(express.json());

// With this, we'll listen for the server on port 8080
app.listen(port, () => console.log(`Listening on port ${port}`));

async function authSheets() {
    //Function for authentication object
    const auth = new google.auth.GoogleAuth({
        keyFile: "google-api-credentials.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    //Create client instance for auth
    const authClient = await auth.getClient();

    //Instance of the Sheets API
    const sheets = google.sheets({ version: "v4", auth: authClient });

    return {
        auth,
        authClient,
        sheets,
    };
}

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
const range = process.env.GOOGLE_SPREADSHEET_RANGE;

//from testData get longestObject index
const longestObjectIndex = testData.reduce((longestIndex, current, currentIndex) => {
    //check each testData array element keys length
    if (Object.keys(current).length > Object.keys(testData[longestIndex] || {}).length) {
        return currentIndex;
    }
    return longestIndex;
}, -1);

//find all keys of longestObject in testData
const longestObjectKeys = Object.keys(testData[longestObjectIndex]);

//convert testData into 2-dimensional array
const values = [...testData.map((o) => longestObjectKeys.map((k) => o[k] || ""))];


async function updateGoogleSheets() {
    try {
        const { sheets } = await authSheets();

        //clear existing data
        await sheets.spreadsheets.values.clear({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        //append data
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: "USER_ENTERED",
            resource: {
                values
            },
        });

        // Read rows from spreadsheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });
        console.log('Updated and fetched data from Google Sheets:', response.data.values);
    } catch (error) {
        console.error('Error updating Google Sheets:', error);
    }
}


app.get("/", async (req, res) => {
    console.log('Manual data request/update');
    await updateGoogleSheets();
    res.send('Google Sheets data successfully updated!');
});

//https://www.npmjs.com/package/node-cron
cron.schedule('*/2 * * * *', async () => {
    console.log('Upload data to Google Sheets every two minutes');
    await updateGoogleSheets();
});