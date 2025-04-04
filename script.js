/**
 * Script for the Scarcity Experiment Website
 */

// --- Constants ---
const minimumViewingTime = 30000; // 30 seconds in milliseconds
const surveyBaseUrl = 'YOUR_POST_SURVEY_LINK_HERE'; // !! IMPORTANT: Replace with your Qualtrics Post-Survey URL !!
const googleAppsScriptUrl = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL'; // !! IMPORTANT: Replace with your deployed GAS Web App URL !!

// --- Global Variables ---
let scarcityTimerInterval = null;
let minimumViewingTimeoutId = null;
let cartClicked = false;
let isContinueEnabled = false;
let participantId = 'missing_pid';
let assignedPlatform = 'desktop';
let assignedCondition = 'control';

/*
===============================================================================
== INSTRUCTIONS FOR GOOGLE APPS SCRIPT (GAS) DATA LOGGING SETUP             ==
===============================================================================

To record the experimental data, you need to set up a simple Google Apps Script
connected to a Google Sheet. Follow these steps:

1.  CREATE A GOOGLE SHEET:
    - Go to sheets.google.com and create a new blank spreadsheet.
    - Name it something descriptive (e.g., "Scarcity Experiment Data").
    - Add header row(s) in the first row corresponding to the data you expect
      to log. The order matters for the script below. A good order is:
      `timestamp`, `pid`, `platform`, `condition`, `action`, `cartClicked`
      (Note: `cartClicked` might be null/undefined for some actions like pageLoad).

2.  OPEN THE SCRIPT EDITOR:
    - In your Google Sheet, go to "Tools" > "Script editor".
    - A new browser tab will open with the script editor. Delete any existing
      code (like `function myFunction() {}`).

3.  WRITE THE `doPost(e)` FUNCTION:
    - Copy and paste the following script code into the editor:

    ```javascript
    // Google Apps Script Code for doPost(e)
    function doPost(e) {
      // Check if postData exists and has content
      if (!e || !e.postData || !e.postData.contents) {
        // Return an error response if data is missing
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No data received' })).setMimeType(ContentService.MimeType.JSON);
      }

      // --- Configuration ---
      var sheetName = 'Sheet1'; // Or the exact name of your sheet tab
      // --- End Configuration ---

      try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
        if (!sheet) {
          throw new Error("Sheet '" + sheetName + "' not found.");
        }

        // Parse the JSON data sent from the website script
        var data = JSON.parse(e.postData.contents);

        // Define the order of columns based on your sheet headers
        // Ensure this matches the headers you set up in Step 1!
        var rowData = [
          data.timestamp || new Date().toISOString(), // Use received timestamp or current time as fallback
          data.pid || '',
          data.platform || '',
          data.condition || '',
          data.action || '',
          data.cartClicked // This might be undefined/null for some actions, which is fine
          // Add any other data fields you might send here, in order
        ];

        // Append the data as a new row in the sheet
        sheet.appendRow(rowData);

        // Return a success response (optional, but good practice)
        // Note: 'no-cors' mode in fetch won't read this response, but it confirms script ran
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', received: data })).setMimeType(ContentService.MimeType.JSON);

      } catch (error) {
        // Log the error (visible in Apps Script > Executions)
        Logger.log('Error processing request: ' + error.toString());
        Logger.log('Received data: ' + e.postData.contents);

        // Return an error response
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString(), received: e.postData.contents })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    ```

4.  SAVE THE SCRIPT:
    - Click the floppy disk icon (Save project). Give your script project a name
      (e.g., "Experiment Logger").

5.  DEPLOY AS A WEB APP:
    - Click the "Deploy" button (usually top right).
    - Select "New deployment".
    - Click the gear icon next to "Select type" and choose "Web app".
    - Configure the deployment:
        - Description: (Optional) e.g., "Scarcity study data logger v1"
        - Execute as: "Me" (Your Google Account)
        - Who has access: **"Anyone"** (This is crucial for your website to send data without login)
    - Click "Deploy".

6.  AUTHORIZE THE SCRIPT:
    - Google will ask for authorization to access your spreadsheet. Review the
      permissions (it will need to manage your spreadsheets) and click "Allow".
      You might see a "Google hasn't verified this app" screen. If so, click
      "Advanced" and then "Go to [Your Script Name] (unsafe)". This is normal
      for personal scripts.

7.  COPY THE WEB APP URL:
    - After deployment, a box will appear showing the "Web app URL".
    - **Copy this entire URL.** This is the endpoint your website needs to send data to.
    - Click "Done".

8.  UPDATE `script.js`:
    - Paste the copied Web App URL into the `googleAppsScriptUrl` constant at the
      top of *this* `script.js` file, replacing the placeholder text.

9.  (Optional) REDEPLOYING:
    - If you make changes to the Apps Script code later, you MUST redeploy.
    - Click "Deploy" > "Manage deployments".
    - Select your active deployment, click the pencil (Edit) icon.
    - Change "Version" to "New version".
    - Click "Deploy". You do NOT need to copy the URL again unless you created
      a completely new deployment.

*/


// --- Utility Functions ---

/**
 * Retrieves a URL query parameter by name.
 */
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Sends data asynchronously to the configured Google Apps Script Web App.
 * @param {object} dataObject The data to log (must be JSON serializable).
 */
function logData(dataObject) {
    if (!googleAppsScriptUrl || googleAppsScriptUrl === 'https://script.google.com/macros/s/AKfycbwx9o_U4b6H53rjOxj5zIUZqPUeDgFSjf7IbqZ6YVYkOdMPeLDojLpJo5MToZ5ivRB-/exec') {
        console.warn("logData: Google Apps Script URL is not configured. Logging to console only.");
        console.log("Logging Data (Simulated):", dataObject);
        return; // Don't attempt fetch if URL is missing
    }

    console.log("Attempting to log:", dataObject);

    fetch(googleAppsScriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Crucial for simple GAS endpoints not returning CORS headers
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        // Redirect set to 'follow' is default but good to be explicit if needed
        redirect: 'follow',
        // Body needs to be a stringified JSON object
        body: JSON.stringify(dataObject)
    })
    .then(response => {
        // Note: With mode: 'no-cors', we cannot access response details (status, body)
        console.log('Log request sent to Google Apps Script.');
    })
    .catch(error => {
        console.error('Error sending data to Google Apps Script:', error);
        // Consider implementing a fallback or retry mechanism if critical
    });
}

/**
 * Formats remaining seconds into MM:SS format.
 */
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Shows and enables the 'Continue to Survey' button.
 */
function enableContinue() {
    if (isContinueEnabled) return;

    if (minimumViewingTimeoutId) {
        clearTimeout(minimumViewingTimeoutId);
        minimumViewingTimeoutId = null;
    }

    const continueButton = document.getElementById('continue-button');
    if (continueButton) {
        console.log("Enabling Continue button.");
        continueButton.style.display = 'block'; // Or 'inline-block' based on CSS
        continueButton.disabled = false;
        isContinueEnabled = true;
    } else {
        console.error("Continue button not found when trying to enable!");
    }
}

/**
 * Starts the 30-second countdown timer for the time scarcity condition.
 */
function startTimer() {
    const timerDisplay = document.getElementById('timer');
    const scarcityMessageDiv = document.getElementById('scarcity-message');
    const addToCartButton = document.getElementById('add-to-cart-button');

    if (!timerDisplay || !scarcityMessageDiv || !addToCartButton) {
        console.error("Timer elements not found!");
        return;
    }

    let timeLeft = 30;
    timerDisplay.textContent = formatTime(timeLeft);

    scarcityTimerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = formatTime(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(scarcityTimerInterval);
            scarcityMessageDiv.textContent = "Offer expired!";
            scarcityMessageDiv.classList.remove('time-limited');
            addToCartButton.disabled = true;

            logData({
                pid: participantId,
                platform: assignedPlatform,
                condition: assignedCondition,
                action: 'timerExpired',
                cartClicked: cartClicked,
                timestamp: new Date().toISOString()
            });

            enableContinue();
            console.log("Time scarcity offer expired.");
        }
    }, 1000);
}


// --- Main Execution ---

window.addEventListener('DOMContentLoaded', () => {

    const scarcityMessageDiv = document.getElementById('scarcity-message');
    const addToCartButton = document.getElementById('add-to-cart-button');
    const continueButton = document.getElementById('continue-button');

    if (!scarcityMessageDiv || !addToCartButton || !continueButton) {
        console.error("Essential page elements not found! Aborting setup.");
        return;
    }

    participantId = getUrlParameter('pid') || 'missing_pid';
    assignedPlatform = (window.innerWidth < 768) ? 'mobile' : 'desktop';
    const conditions = ['control', 'time', 'quantity'];
    const randomIndex = Math.floor(Math.random() * conditions.length);
    assignedCondition = conditions[randomIndex];

    logData({
        pid: participantId,
        platform: assignedPlatform,
        condition: assignedCondition,
        action: 'pageLoad',
        timestamp: new Date().toISOString()
    });

    switch (assignedCondition) {
        case 'control':
            scarcityMessageDiv.innerHTML = "✓ In Stock";
            break;
        case 'quantity':
            scarcityMessageDiv.innerHTML = "Limited stock! Only <strong>3</strong> left!";
            scarcityMessageDiv.classList.add('quantity-limited');
            break;
        case 'time':
            scarcityMessageDiv.innerHTML = `Offer ends in: <span id="timer" style="font-weight:bold;">${formatTime(30)}</span>`;
            scarcityMessageDiv.classList.add('time-limited');
            startTimer();
            break;
        default:
            scarcityMessageDiv.innerHTML = "✓ In Stock";
    }

    console.log(`Starting minimum viewing timer (${minimumViewingTime / 1000}s)`);
    minimumViewingTimeoutId = setTimeout(() => {
        console.log("Minimum viewing time elapsed.");
        minimumViewingTimeoutId = null;
        logData({
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'minViewTimeReached',
            cartClicked: cartClicked,
            timestamp: new Date().toISOString()
        });
        enableContinue();
    }, minimumViewingTime);

    addToCartButton.addEventListener('click', () => {
        if (addToCartButton.disabled) return;

        cartClicked = true;
        addToCartButton.disabled = true;
        addToCartButton.textContent = "Added!";

        console.log("Add to Cart clicked.");
        logData({
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'addToCartClick',
            timestamp: new Date().toISOString()
        });
        enableContinue();
    });

    continueButton.addEventListener('click', () => {
        if (continueButton.disabled) return;

        console.log("Continue button clicked. Preparing redirection.");
        logData({
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'continueClick',
            cartClicked: cartClicked,
            timestamp: new Date().toISOString()
        });

        if (!surveyBaseUrl || surveyBaseUrl === 'https://qualtricsxm8lxkfg4x2.qualtrics.com/jfe/form/SV_8uYDRNeIueQwyVw') {
             console.error("Post Survey URL is not configured! Cannot redirect.");
             alert("Error: Survey URL is missing. Cannot proceed."); // User feedback
             return;
        }

        const redirectUrl = `${surveyBaseUrl}?pid=${encodeURIComponent(participantId)}&platform=${encodeURIComponent(assignedPlatform)}&condition=${encodeURIComponent(assignedCondition)}`;
        console.log("Redirecting to:", redirectUrl);
        window.location.href = redirectUrl;
    });

    console.log(`Initial Setup Complete: PID=${participantId}, Platform=${assignedPlatform}, Condition=${assignedCondition}`);

}); // End of DOMContentLoaded listener


// --- Cleanup on Page Unload ---
window.addEventListener('beforeunload', () => {
    console.log("Page unloading. Clearing timers.");
    if (scarcityTimerInterval) {
        clearInterval(scarcityTimerInterval);
    }
    if (minimumViewingTimeoutId) {
        clearTimeout(minimumViewingTimeoutId);
    }
});