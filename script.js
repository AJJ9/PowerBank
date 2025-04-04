/**
 * Script for the Scarcity Experiment Website
 */

// --- Constants ---
const minimumViewingTime = 30000; // 30 seconds in milliseconds
const surveyBaseUrl = 'https://qualtricsxm8lxkfg4x2.qualtrics.com/jfe/form/SV_8uYDRNeIueQwyVw'; // !! IMPORTANT: Replace with your Qualtrics Post-Survey URL !!
const googleAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbwx9o_U4b6H53rjOxj5zIUZqPUeDgFSjf7IbqZ6YVYkOdMPeLDojLpJo5MToZ5ivRB-/exec'; // !! IMPORTANT: Replace with your deployed GAS Web App URL !!

// --- Global Variables ---
let scarcityTimerInterval = null;
let minimumViewingTimeoutId = null;
let cartClicked = false;
let isContinueEnabled = false;
let participantId = 'missing_pid';
let assignedPlatform = 'desktop';
let assignedCondition = 'control';



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
    if (!googleAppsScriptUrl || googleAppsScriptUrl === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
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

        if (!surveyBaseUrl || surveyBaseUrl === 'YOUR_QUALTRICS_POST_SURVEY_ANONYMOUS_LINK_HERE') {
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
