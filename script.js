/**
 * Script for the ChargeMax Product Page
 * Enhanced for scarcity nudge experiment
 */

// --- Constants ---
const minimumViewingTime = 30000; // 30 seconds in milliseconds
const surveyBaseUrl = 'https://qualtricsxm8lxkfg4x2.qualtrics.com/jfe/form/SV_8uYDRNeIueQwyVw'; // !! IMPORTANT: Replace with your Qualtrics Post-Survey URL !!
const googleAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbyhZBGWNGxsRoTVRpRHkpjXKuPtRRU7ao3AAxWOkAXnIhJWapX9WBnZyDwk6663NZKl/exec'; // Replace with your new deployment URL

// --- Global Variables ---
let scarcityTimerInterval = null;
let minimumViewingTimeoutId = null;
let cartClicked = false;
let isContinueEnabled = false;
let participantId = 'missing_pid';
let assignedPlatform = 'desktop';
let assignedCondition = 'control';
let galleryAutoRotateInterval = null;
let currentImageIndex = 0;
let pageLoadTimestamp = Date.now();
let interactionCount = 0;

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

    // Track interaction count for experimental analysis
    interactionCount++;
    document.querySelector('.product-details').setAttribute('data-interaction-count', interactionCount);

    // Enhanced data structure for the new Google Sheet app script
    const enhancedData = {
        ...dataObject,
        eventId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        timeOnPage: Math.round((Date.now() - pageLoadTimestamp) / 1000), // time in seconds
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
        userAgent: navigator.userAgent,
        interactionSequence: interactionCount, // Sequential interaction number
        experimentPhase: determineExperimentPhase(), // Current phase of the experiment
        cartStatus: cartClicked ? 'added' : 'not_added',
        deviceOrientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
        scrollDepth: getScrollDepth(),
        expandedSections: {
            accordion: Array.from(document.querySelectorAll('.accordion-item.active')).map(el => el.id),
            faq: Array.from(document.querySelectorAll('.faq-item.active')).map(el => el.id)
        }
    };

    console.log("Logging data:", enhancedData);

    fetch(googleAppsScriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Crucial for simple GAS endpoints not returning CORS headers
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
        body: JSON.stringify(enhancedData)
    })
    .then(response => {
        console.log('Log request sent to Google Apps Script.');
    })
    .catch(error => {
        console.error('Error sending data to Google Apps Script:', error);
        // Attempt to log the error for debugging
        try {
            localStorage.setItem('logError_' + Date.now(), JSON.stringify({
                error: error.toString(),
                data: JSON.stringify(enhancedData)
            }));
        } catch (e) {
            console.error('Could not save error to localStorage', e);
        }
    });
}

/**
 * Determines the current phase of the experiment based on user actions
 */
function determineExperimentPhase() {
    if (cartClicked) {
        return 'post_conversion';
    }
    
    if (isContinueEnabled) {
        return 'pre_exit';
    }
    
    // Check if timer is active for time-based condition
    if (assignedCondition === 'time' && scarcityTimerInterval) {
        return 'active_timer';
    }
    
    return 'product_viewing'; // Default phase
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
 * Shows and enables the 'Continue to Survey' button with enhanced animation.
 */
function enableContinue() {
    if (isContinueEnabled) return;

    if (minimumViewingTimeoutId) {
        clearTimeout(minimumViewingTimeoutId);
        minimumViewingTimeoutId = null;
    }

    const continueButton = document.getElementById('continue-button');
    const addToCartButton = document.getElementById('add-to-cart-button');
    
    if (continueButton && addToCartButton) {
        console.log("Enabling Continue button and disabling Add to Cart.");
        
        // Disable Add to Cart button if it's not already disabled
        if (!addToCartButton.disabled) {
            addToCartButton.disabled = true;
            
            // If the cart button hasn't been clicked yet, mark it as disabled visually
            if (!cartClicked) {
                addToCartButton.classList.add('disabled');
                addToCartButton.innerHTML = '<span class="btn-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></span><span>Add to Cart</span>';
            }
        }
        
        // Show and enable Continue button
        continueButton.style.display = 'flex'; // Using flex instead of block for centering
        continueButton.disabled = false;
        isContinueEnabled = true;
        
        // Add enhanced animation for continue button appearance
        continueButton.style.opacity = '0';
        continueButton.style.transform = 'translateY(10px)';
        setTimeout(() => {
            continueButton.style.opacity = '1';
            continueButton.style.transform = 'translateY(0)';
        }, 10);
        
        // Log event
        logData({
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'continueButtonEnabled',
            cartClicked: cartClicked,
            timestamp: new Date().toISOString()
        });
    } else {
        console.error("Required buttons not found when trying to enable continue!");
    }
}

/**
 * Starts the 30-second countdown timer for the time scarcity condition with enhanced visual feedback.
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
    
    // Add a subtle shake animation when timer starts to draw attention
    scarcityMessageDiv.classList.add('shake');
    setTimeout(() => {
        scarcityMessageDiv.classList.remove('shake');
    }, 1000);

    scarcityTimerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = formatTime(timeLeft);

        // Add visual cues based on remaining time
        if (timeLeft <= 10) {
            scarcityMessageDiv.classList.add('urgent');
            // Make the cart button pulse to draw attention as time gets low
            if (!cartClicked && !addToCartButton.disabled) {
                addToCartButton.classList.add('attention-pulse');
            }
        }
        
        // When timer is really low, add extra urgency
        if (timeLeft <= 5) {
            timerDisplay.style.color = '#DC2626'; // Bright red for urgency
            timerDisplay.style.fontWeight = '800';
        }

        if (timeLeft <= 0) {
            clearInterval(scarcityTimerInterval);
            scarcityMessageDiv.textContent = "Offer expired!";
            scarcityMessageDiv.classList.remove('time-limited', 'urgent');
            scarcityMessageDiv.classList.add('expired');
            addToCartButton.disabled = true;
            addToCartButton.classList.add('disabled');
            addToCartButton.classList.remove('attention-pulse');

            logData({
                pid: participantId,
                platform: assignedPlatform,
                condition: assignedCondition,
                action: 'timerExpired',
                cartClicked: cartClicked,
                timestamp: new Date().toISOString(),
                timeViewedSeconds: 30 - timeLeft // Added tracking for how long they viewed before expiry
            });

            enableContinue();
            console.log("Time scarcity offer expired.");
        }
    }, 1000);
}

/**
 * Changes the active gallery image with enhanced animation and accessibility support.
 */
function changeImage(index) {
    const dots = document.querySelectorAll('.gallery-dot');
    const images = document.querySelectorAll('.gallery-image');
    const galleryContainer = document.querySelector('.gallery-container');
    
    if (index < 0) index = images.length - 1;
    if (index >= images.length) index = 0;
    
    currentImageIndex = index;
    
    // Reset auto-rotation timer
    if (galleryAutoRotateInterval) {
        clearInterval(galleryAutoRotateInterval);
        startGalleryAutoRotation();
    }
    
    // Update ARIA states for accessibility
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
        dot.setAttribute('aria-selected', i === index);
    });
    
    // Show loading indicator
    galleryContainer.classList.add('loading');
    
    // Update images with smooth transition
    images.forEach((img, i) => {
        if (i === index) {
            // Preload the selected image
            const newImg = new Image();
            newImg.onload = function() {
                // Once image is loaded, show it with animation
                galleryContainer.classList.remove('loading');
                img.classList.add('active');
                setTimeout(() => {
                    img.style.opacity = '1';
                    img.style.transform = 'scale(1)';
                }, 50);
            };
            
            // In case of loading errors
            newImg.onerror = function() {
                galleryContainer.classList.remove('loading');
                img.classList.add('active');
                img.style.opacity = '1';
                img.style.transform = 'scale(1)';
            };
            
            // Start loading
            newImg.src = img.src;
            
            // If image is already cached, onload may not fire
            if (newImg.complete) {
                galleryContainer.classList.remove('loading');
                img.classList.add('active');
                setTimeout(() => {
                    img.style.opacity = '1';
                    img.style.transform = 'scale(1)';
                }, 50);
            }
        } else {
            img.style.opacity = '0';
            img.style.transform = 'scale(0.95)';
            setTimeout(() => {
                img.classList.remove('active');
            }, 500); // Increased from 300 for smoother transition
        }
    });
    
    // Log gallery interaction - REMOVED as requested
}

/**
 * Sets up the image gallery functionality with improved experience and accessibility.
 */
function setupGallery() {
    const dots = document.querySelectorAll('.gallery-dot');
    const images = document.querySelectorAll('.gallery-image');
    
    if (!dots.length || !images.length) {
        console.error("Gallery elements not found!");
        return;
    }
    
    // Initialize first image
    images[0].style.opacity = '1';
    images[0].style.transform = 'scale(1)';
    
    // Set up dot navigation
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            changeImage(index);
        });
    });
    
    // Enhanced swipe navigation for mobile with visual feedback
    const galleryContainer = document.querySelector('.gallery-container');
    if (galleryContainer) {
        let touchStartX = 0;
        let touchEndX = 0;
        let touchStartY = 0;
        let touchEndY = 0;
        let isSwiping = false;
        let swipeIndicator = null;
        
        // Create swipe indicators that we'll show during swipe
        const createSwipeIndicators = () => {
            const container = document.createElement('div');
            container.className = 'swipe-indicators';
            container.style.position = 'absolute';
            container.style.top = '50%';
            container.style.left = '0';
            container.style.right = '0';
            container.style.display = 'flex';
            container.style.justifyContent = 'space-between';
            container.style.pointerEvents = 'none';
            container.style.transform = 'translateY(-50%)';
            container.style.opacity = '0';
            container.style.transition = 'opacity 0.3s ease';
            container.style.zIndex = '5';
            
            const prevIndicator = document.createElement('div');
            prevIndicator.className = 'swipe-prev';
            prevIndicator.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40" stroke="#ffffff" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            prevIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
            prevIndicator.style.borderRadius = '50%';
            prevIndicator.style.padding = '10px';
            prevIndicator.style.marginLeft = '15px';
            prevIndicator.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
            
            const nextIndicator = document.createElement('div');
            nextIndicator.className = 'swipe-next';
            nextIndicator.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40" stroke="#ffffff" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            nextIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
            nextIndicator.style.borderRadius = '50%';
            nextIndicator.style.padding = '10px';
            nextIndicator.style.marginRight = '15px';
            nextIndicator.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
            
            container.appendChild(prevIndicator);
            container.appendChild(nextIndicator);
            galleryContainer.appendChild(container);
            
            return container;
        };
        
        galleryContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
            isSwiping = true;
            
            // Create indicators if they don't exist
            if (!swipeIndicator) {
                swipeIndicator = createSwipeIndicators();
            }
            
            // Show indicators with a small delay
            setTimeout(() => {
                if (isSwiping && swipeIndicator) {
                    swipeIndicator.style.opacity = '1';
                }
            }, 200);
        }, { passive: true }); // Using passive for better scroll performance
        
        galleryContainer.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            
            const currentX = e.changedTouches[0].screenX;
            const deltaX = currentX - touchStartX;
            
            // Highlight the appropriate indicator based on swipe direction
            if (swipeIndicator) {
                const prevIndicator = swipeIndicator.querySelector('.swipe-prev');
                const nextIndicator = swipeIndicator.querySelector('.swipe-next');
                
                if (deltaX > 30) { // Swiping right - prev image
                    prevIndicator.style.transform = 'scale(1.1)';
                    prevIndicator.style.background = 'rgba(0, 118, 251, 0.5)';
                    nextIndicator.style.transform = 'scale(1)';
                    nextIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
                } else if (deltaX < -30) { // Swiping left - next image
                    nextIndicator.style.transform = 'scale(1.1)';
                    nextIndicator.style.background = 'rgba(0, 118, 251, 0.5)';
                    prevIndicator.style.transform = 'scale(1)';
                    prevIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
                } else {
                    prevIndicator.style.transform = 'scale(1)';
                    nextIndicator.style.transform = 'scale(1)';
                    prevIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
                    nextIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
                }
            }
        }, { passive: true });
        
        galleryContainer.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            
            // Hide indicators
            if (swipeIndicator) {
                swipeIndicator.style.opacity = '0';
                // Reset indicator styles
                const prevIndicator = swipeIndicator.querySelector('.swipe-prev');
                const nextIndicator = swipeIndicator.querySelector('.swipe-next');
                if (prevIndicator && nextIndicator) {
                    prevIndicator.style.transform = 'scale(1)';
                    nextIndicator.style.transform = 'scale(1)';
                    prevIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
                    nextIndicator.style.background = 'rgba(0, 0, 0, 0.3)';
                }
            }
            
            isSwiping = false;
            handleSwipe();
        }, false);
        
        function handleSwipe() {
            // Calculate horizontal and vertical distance
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            
            // Only trigger if horizontal swipe is more significant than vertical
            if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
                if (deltaX < -50) { // More strict threshold
                    // Swipe left - next image
                    changeImage(currentImageIndex + 1);
                } else if (deltaX > 50) { // More strict threshold
                    // Swipe right - previous image
                    changeImage(currentImageIndex - 1);
                }
            }
        }
    }
    
    console.log("Gallery setup complete with enhanced accessibility.");
}

/**
 * Starts automatic rotation of gallery images.
 */
function startGalleryAutoRotation() {
    // Clear any existing interval
    if (galleryAutoRotateInterval) {
        clearInterval(galleryAutoRotateInterval);
    }
    
    // Set interval for rotation - reduced time for more engagement
    galleryAutoRotateInterval = setInterval(() => {
        changeImage(currentImageIndex + 1);
    }, 4000); // Changed from 5000 for more dynamic experience
    
    console.log("Gallery auto rotation started.");
}

/**
 * Initialize the accordion functionality with enhanced animations and accessibility.
 */
function setupAccordion() {
    const accordionItems = document.querySelectorAll('.accordion-item');
    
    accordionItems.forEach((item, index) => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');
        
        // Add ARIA attributes for accessibility
        const itemId = `accordion-item-${index}`;
        const contentId = `accordion-content-${index}`;
        
        header.setAttribute('id', itemId);
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('aria-controls', contentId);
        content.setAttribute('id', contentId);
        content.setAttribute('role', 'region');
        content.setAttribute('aria-labelledby', itemId);
        
        header.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all items with smooth animation
            accordionItems.forEach(otherItem => {
                const otherHeader = otherItem.querySelector('.accordion-header');
                otherHeader.setAttribute('aria-expanded', 'false');
                otherItem.classList.remove('active');
            });
            
            // If clicked item wasn't active, open it
            if (!isActive) {
                item.classList.add('active');
                header.setAttribute('aria-expanded', 'true');
                
                // Log accordion interaction with detailed information
                logData({
                    pid: participantId,
                    platform: assignedPlatform,
                    condition: assignedCondition,
                    action: 'contentExpand',
                    contentType: 'productDetails',
                    subAction: 'accordionOpen',
                    contentId: item.id,
                    sectionTitle: header.querySelector('span').textContent,
                    timestamp: new Date().toISOString(),
                    contentIndex: index
                });
            }
        });
    });
    
    console.log("Accordion setup complete with enhanced accessibility.");
}

/**
 * Initialize the FAQ accordion functionality with enhanced animations and accessibility.
 */
function setupFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach((item, index) => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        
        // Add ARIA attributes for accessibility
        const itemId = `faq-item-${index}`;
        const answerId = `faq-answer-${index}`;
        
        question.setAttribute('id', itemId);
        question.setAttribute('aria-expanded', 'false');
        question.setAttribute('aria-controls', answerId);
        answer.setAttribute('id', answerId);
        answer.setAttribute('role', 'region');
        answer.setAttribute('aria-labelledby', itemId);
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all items with smooth animation
            faqItems.forEach(otherItem => {
                const otherQuestion = otherItem.querySelector('.faq-question');
                otherQuestion.setAttribute('aria-expanded', 'false');
                otherItem.classList.remove('active');
            });
            
            // If clicked item wasn't active, open it
            if (!isActive) {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
                
                // Log FAQ interaction with detailed information
                logData({
                    pid: participantId,
                    platform: assignedPlatform,
                    condition: assignedCondition,
                    action: 'contentExpand',
                    contentType: 'faq',
                    subAction: 'faqOpen',
                    contentId: `faq-${index}`,
                    sectionTitle: question.querySelector('span').textContent,
                    timestamp: new Date().toISOString(),
                    contentIndex: index
                });
            }
        });
    });
    
    console.log("FAQ setup complete with enhanced accessibility.");
}

// --- Initialization & Event Setup ---
function detectDeviceType() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    return isMobile ? 'mobile' : 'desktop';
}

// --- Main Execution ---
window.addEventListener('DOMContentLoaded', () => {
    pageLoadTimestamp = Date.now();
    
    const scarcityMessageDiv = document.getElementById('scarcity-message');
    const addToCartButton = document.getElementById('add-to-cart-button');
    const continueButton = document.getElementById('continue-button');

    if (!scarcityMessageDiv || !addToCartButton || !continueButton) {
        console.error("Essential page elements not found! Aborting setup.");
        return;
    }

    // Add subtle animations on page load - staggered for better visual effect
    document.querySelectorAll('.product-layout > *').forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 100 + (index * 150));
    });

    // Set up initial values
    participantId = getUrlParameter('pid') || 'missing_pid';
    assignedPlatform = detectDeviceType();
    
    // For experimental control, we can either randomly assign or use URL param if present
    const conditionParam = getUrlParameter('condition');
    if (conditionParam && ['control', 'time', 'quantity'].includes(conditionParam)) {
        assignedCondition = conditionParam;
    } else {
        const conditions = ['control', 'time', 'quantity'];
        const randomIndex = Math.floor(Math.random() * conditions.length);
        assignedCondition = conditions[randomIndex];
    }

    // Log page load with enhanced tracking and experiment metadata
    logData({
    pid: participantId,
    platform: assignedPlatform,
    condition: assignedCondition,
    action: 'pageLoad',
    subAction: 'experimentStart',
    timestamp: new Date().toISOString(),
    experimentInfo: {
    minimumViewTime: minimumViewingTime / 1000, // in seconds
    conditionType: assignedCondition,
    conditionAssignment: conditionParam ? 'param' : 'random',
    referrer: document.referrer || 'direct',
        startTime: new Date().toISOString()
    },
    deviceInfo: {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
        language: navigator.language || 'unknown'
    },
        urlParams: Object.fromEntries(new URLSearchParams(window.location.search))
    });

    // Set up scarcity message based on condition
    switch (assignedCondition) {
        case 'control':
            scarcityMessageDiv.innerHTML = "✓ In Stock & Ready to Ship";
            scarcityMessageDiv.setAttribute('data-condition', 'control');
            break;
        case 'quantity':
            scarcityMessageDiv.innerHTML = "Limited stock! Only <strong>3</strong> units left!";
            scarcityMessageDiv.classList.add('quantity-limited');
            scarcityMessageDiv.setAttribute('aria-live', 'polite'); // Accessibility enhancement
            scarcityMessageDiv.setAttribute('data-condition', 'quantity');
            
            // Add initial fade-in animation
            scarcityMessageDiv.style.opacity = '0';
            scarcityMessageDiv.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                scarcityMessageDiv.style.opacity = '1';
                scarcityMessageDiv.style.transform = 'translateY(0)';
            }, 300);
            
            // Add attention-getting animation after a short delay
            setTimeout(() => {
                scarcityMessageDiv.classList.add('attention-animate');
                setTimeout(() => {
                    scarcityMessageDiv.classList.remove('attention-animate');
                    
                    // Schedule periodic subtle animations to keep drawing attention
                    const intervalId = setInterval(() => {
                        if (cartClicked) {
                            clearInterval(intervalId);
                            return;
                        }
                        
                        scarcityMessageDiv.classList.add('attention-animate');
                        setTimeout(() => {
                            scarcityMessageDiv.classList.remove('attention-animate');
                        }, 1000);
                    }, 15000); // Repeat every 15 seconds
                    
                }, 1000);
            }, 2000);
            break;
        case 'time':
            scarcityMessageDiv.innerHTML = `Limited-time offer ends in: <span id="timer" style="font-weight:bold;">${formatTime(30)}</span>`;
            scarcityMessageDiv.classList.add('time-limited');
            scarcityMessageDiv.setAttribute('aria-live', 'polite'); // Accessibility enhancement
            scarcityMessageDiv.setAttribute('data-condition', 'time');
            // Start timer after a short delay to ensure the user notices it
            setTimeout(() => {
                startTimer();
            }, 500);
            break;
        default:
            scarcityMessageDiv.innerHTML = "✓ In Stock & Ready to Ship";
            scarcityMessageDiv.setAttribute('data-condition', 'control');
    }

    // Start minimum viewing timer
    console.log(`Starting minimum viewing timer (${minimumViewingTime / 1000}s)`);
    minimumViewingTimeoutId = setTimeout(() => {
        console.log("Minimum viewing time elapsed.");
        minimumViewingTimeoutId = null;
        logData({
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'timeThreshold',
            subAction: 'minViewTimeReached',
            cartClicked: cartClicked,
            timestamp: new Date().toISOString(),
            experimentPhase: 'timed_threshold_reached'
        });
        enableContinue();
    }, minimumViewingTime);

    // Add to cart button click event with enhanced tracking and feedback
    addToCartButton.addEventListener('click', (event) => {
        if (addToCartButton.disabled) return;

        // Create and show visual feedback of the click with a ripple effect
        const ripple = document.createElement('span');
        ripple.classList.add('btn-ripple');
        addToCartButton.appendChild(ripple);
        
        const rect = addToCartButton.getBoundingClientRect();
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        
        setTimeout(() => {
            ripple.remove();
        }, 600); // Match ripple animation duration

        cartClicked = true;
        addToCartButton.disabled = true;
        addToCartButton.innerHTML = '<span class="btn-icon"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg></span><span>Added to Cart</span>';
        addToCartButton.classList.add('success');

        // Show product added confirmation indicator
        const confirmationIndicator = document.createElement('div');
        confirmationIndicator.classList.add('cart-confirmation');
        confirmationIndicator.setAttribute('role', 'alert');
        confirmationIndicator.textContent = 'Product added to cart!';
        document.body.appendChild(confirmationIndicator);
        
        // Animate confirmation and remove after delay
        setTimeout(() => {
            confirmationIndicator.classList.add('show');
        }, 50);
        
        setTimeout(() => {
            confirmationIndicator.classList.remove('show');
            setTimeout(() => confirmationIndicator.remove(), 300);
        }, 2500);

        // Add success animation
        addToCartButton.style.transform = 'scale(1.05)';
        setTimeout(() => {
            addToCartButton.style.transform = 'scale(1)';
        }, 200);

        console.log("Add to Cart clicked.");
        
        // Enhanced data tracking for experimental purposes with improved structure
        const timeElapsed = minimumViewingTimeoutId ? 
            Math.round((minimumViewingTime - (minimumViewingTimeoutId._idleStart + minimumViewingTimeoutId._idleTimeout - Date.now())) / 1000) : 
            Math.round(minimumViewingTime / 1000);
            
        logData({
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'conversion',
            subAction: 'addToCart',
            timestamp: new Date().toISOString(),
            timeToConversion: timeElapsed, // Track time spent before making decision
            scarcityVisible: Boolean(scarcityMessageDiv.offsetParent), // Check if scarcity message was visible
            sectionsExpandedCount: getExpandedSectionsCount(), // How many sections were opened
            sessionMetrics: {
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                scrollDepth: getScrollDepth(),
            },
            currentUrl: window.location.href
        });
        enableContinue();
    });

    // Continue button click event with enhanced data tracking
    continueButton.addEventListener('click', () => {
        if (continueButton.disabled) return;

        console.log("Continue button clicked. Preparing redirection.");
        
        // Calculate session duration and interaction metrics
        const sessionDuration = Date.now() - pageLoadTimestamp;
        const interactionsPerMinute = interactionCount / (sessionDuration / 60000);
        
        // Compile expanded sections information
        const expandedSections = {
            accordion: Array.from(document.querySelectorAll('.accordion-item.active')).map(el => el.id),
            faq: Array.from(document.querySelectorAll('.faq-item.active')).map(el => el.id)
        };
        
        // Log comprehensive exit data
        logData({
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'pageExit',
            subAction: 'surveyRedirect',
            cartClicked: cartClicked,
            timestamp: new Date().toISOString(),
            sessionMetrics: {
                duration: Math.round(sessionDuration / 1000), // Total time on page in seconds
                interactionsCount: interactionCount, // Track total interactions
                interactionsPerMinute: interactionsPerMinute.toFixed(2),
                expandedSections: expandedSections,
                sectionsExpandedCount: getExpandedSectionsCount(),
                scrollDepth: getScrollDepth()
            },
            conversionResult: cartClicked ? 'converted' : 'abandoned'
        });

        if (!surveyBaseUrl || surveyBaseUrl === 'YOUR_QUALTRICS_POST_SURVEY_ANONYMOUS_LINK_HERE') {
             console.error("Post Survey URL is not configured! Cannot redirect.");
             alert("Error: Survey URL is missing. Cannot proceed."); // User feedback
             return;
        }

        // Add loading state with animated spinner
        continueButton.innerHTML = '<span class="loading-spinner"></span><span>Please wait...</span>';
        continueButton.style.opacity = '0.9';
        continueButton.style.pointerEvents = 'none';

        // Build URL with additional experiment parameters
        const redirectUrl = `${surveyBaseUrl}?pid=${encodeURIComponent(participantId)}&platform=${encodeURIComponent(assignedPlatform)}&condition=${encodeURIComponent(assignedCondition)}&cartStatus=${cartClicked ? 'added' : 'not_added'}&timeOnPage=${Math.round(sessionDuration / 1000)}&interactionCount=${interactionCount}`;
        console.log("Redirecting to:", redirectUrl);
        
        // Short delay for better UX
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 500);
    });

    // Setup gallery, accordion and FAQ
    setupGallery();
    setupAccordion();
    setupFAQ();
    startGalleryAutoRotation();

    // Add event listeners for additional interaction tracking
    document.querySelector('.product-details').addEventListener('mousemove', debounce(() => {
        logData({
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'productDetailsFocus',
            timestamp: new Date().toISOString()
        });
    }, 2000)); // Only log once every 2 seconds

    console.log(`Initial Setup Complete: PID=${participantId}, Platform=${assignedPlatform}, Condition=${assignedCondition}`);

}); // End of DOMContentLoaded listener

/**
 * Utility function for debouncing
 * @param {function} func - The function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Get the count of currently expanded accordion and FAQ sections
 * @returns {number} Number of expanded sections
 */
function getExpandedSectionsCount() {
    const expandedAccordions = document.querySelectorAll('.accordion-item.active').length;
    const expandedFaqs = document.querySelectorAll('.faq-item.active').length;
    return expandedAccordions + expandedFaqs;
}

/**
 * Calculate how far the user has scrolled down the page
 * @returns {object} Scroll metrics
 */
function getScrollDepth() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    
    const scrolledToBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;
    const scrollPercentage = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    
    return {
        pixels: scrollTop,
        percentage: scrollPercentage > 100 ? 100 : scrollPercentage,
        reachedBottom: scrolledToBottom
    };
}

// --- Responsive Layout Adjustments ---
window.addEventListener('resize', () => {
    assignedPlatform = detectDeviceType();
});

// --- Cleanup on Page Unload ---
window.addEventListener('beforeunload', (e) => {
    console.log("Page unloading. Cleaning up resources.");
    
    // Clear all timers and intervals
    if (scarcityTimerInterval) {
        clearInterval(scarcityTimerInterval);
        scarcityTimerInterval = null;
    }
    
    if (minimumViewingTimeoutId) {
        clearTimeout(minimumViewingTimeoutId);
        minimumViewingTimeoutId = null;
    }
    
    if (galleryAutoRotateInterval) {
        clearInterval(galleryAutoRotateInterval);
        galleryAutoRotateInterval = null;
    }
    
    // Clear any other potential memory leaks
    const allTimeouts = document.querySelectorAll('[data-timeout-id]');
    allTimeouts.forEach(el => {
        const timeoutId = parseInt(el.getAttribute('data-timeout-id'));
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
    
    // Log session end with comprehensive data - this may not always succeed due to page unload timing
    const sessionDuration = Math.round((Date.now() - pageLoadTimestamp) / 1000);
    const expandedSections = {
        accordion: Array.from(document.querySelectorAll('.accordion-item.active')).map(el => el.id),
        faq: Array.from(document.querySelectorAll('.faq-item.active')).map(el => el.id)
    };
    
    // Use navigator.sendBeacon for more reliable logging on page unload
    if (navigator.sendBeacon) {
        const logData = {
            pid: participantId,
            platform: assignedPlatform,
            condition: assignedCondition,
            action: 'pageExit',
            subAction: 'browserUnload',
            cartClicked: cartClicked,
            cartStatus: cartClicked ? 'added' : 'not_added',
            timestamp: new Date().toISOString(),
            timeOnPage: sessionDuration,
            interactionSequence: interactionCount,
            experimentPhase: determineExperimentPhase(),
            sessionMetrics: {
                duration: sessionDuration,
                interactionCount: interactionCount,
                expandedSections: expandedSections,
                sectionsExpandedCount: getExpandedSectionsCount(),
                scrollDepth: getScrollDepth(),
                completed: false
            },
            conversionResult: cartClicked ? 'converted' : 'abandoned'
        };
        
        navigator.sendBeacon(googleAppsScriptUrl, JSON.stringify(logData));
    }
});
