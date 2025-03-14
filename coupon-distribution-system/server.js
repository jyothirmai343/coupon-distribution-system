const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());

// Database simulation (in production, use a real database)
let coupons = [
  { code: 'SAVE10NOW', discount: '10%' },
  { code: 'FREESHIP22', discount: 'Free Shipping' },
  { code: 'BUY1GET50', discount: '50% off second item' },
  { code: 'WELCOME25', discount: '25% off' },
  { code: 'FLASH15OFF', discount: '15% off' }
];

// Tracking variables
let currentCouponIndex = 0;
let claimedCoupons = {};  // Format: {ipAddress: {timestamp, couponIndex, sessionId}}
let sessionClaims = {};   // Format: {sessionId: {timestamp, couponIndex}}

// Restriction times (in milliseconds)
const IP_RESTRICTION_TIME = 3600000; // 1 hour
const SESSION_RESTRICTION_TIME = 7200000; // 2 hours

// Generate unique session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Rate limiter to prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

app.use('/api', limiter);

// Session check middleware
app.use((req, res, next) => {
  // Check if user has a session cookie
  if (!req.cookies.sessionId) {
    // Create new session ID
    const sessionId = generateSessionId();
    // Set cookie to expire in 24 hours
    res.cookie('sessionId', sessionId, { maxAge: 86400000, httpOnly: true });
    req.sessionId = sessionId;
  } else {
    req.sessionId = req.cookies.sessionId;
  }
  next();
});

// Endpoint to get next available coupon
app.get('/api/coupon', (req, res) => {
  const ip = req.ip;
  const sessionId = req.sessionId;
  const currentTime = Date.now();
  
  // Check IP restriction
  if (claimedCoupons[ip] && 
      (currentTime - claimedCoupons[ip].timestamp) < IP_RESTRICTION_TIME) {
    const timeLeft = Math.ceil((IP_RESTRICTION_TIME - (currentTime - claimedCoupons[ip].timestamp)) / 60000);
    return res.status(429).json({ 
      error: true, 
      message: `Please wait ${timeLeft} minutes before claiming another coupon from this location.` 
    });
  }
  
  // Check session restriction
  if (sessionClaims[sessionId] && 
      (currentTime - sessionClaims[sessionId].timestamp) < SESSION_RESTRICTION_TIME) {
    const timeLeft = Math.ceil((SESSION_RESTRICTION_TIME - (currentTime - sessionClaims[sessionId].timestamp)) / 60000);
    return res.status(429).json({ 
      error: true, 
      message: `Please wait ${timeLeft} minutes before claiming another coupon from this browser.` 
    });
  }
  
  // Get the next coupon in round-robin fashion
  const coupon = coupons[currentCouponIndex];
  
  // Update tracking information
  claimedCoupons[ip] = {
    timestamp: currentTime,
    couponIndex: currentCouponIndex,
    sessionId: sessionId
  };
  
  sessionClaims[sessionId] = {
    timestamp: currentTime,
    couponIndex: currentCouponIndex
  };
  
  // Move to next coupon for next request (round-robin)
  currentCouponIndex = (currentCouponIndex + 1) % coupons.length;
  
  // Log the claim (in production, store in database)
  console.log(`Coupon ${coupon.code} claimed by IP: ${ip}, Session: ${sessionId.substring(0, 8)}...`);
  
  // Return the coupon
  res.json({
    success: true,
    coupon: coupon,
    message: `You've claimed: ${coupon.code} (${coupon.discount})`
  });
});

// Get time remaining before a user can claim another coupon
app.get('/api/status', (req, res) => {
  const ip = req.ip;
  const sessionId = req.sessionId;
  const currentTime = Date.now();
  
  let ipRestriction = null;
  let sessionRestriction = null;
  
  if (claimedCoupons[ip]) {
    const timeElapsed = currentTime - claimedCoupons[ip].timestamp;
    if (timeElapsed < IP_RESTRICTION_TIME) {
      ipRestriction = Math.ceil((IP_RESTRICTION_TIME - timeElapsed) / 60000);
    }
  }
  
  if (sessionClaims[sessionId]) {
    const timeElapsed = currentTime - sessionClaims[sessionId].timestamp;
    if (timeElapsed < SESSION_RESTRICTION_TIME) {
      sessionRestriction = Math.ceil((SESSION_RESTRICTION_TIME - timeElapsed) / 60000);
    }
  }
  
  res.json({
    canClaim: !ipRestriction && !sessionRestriction,
    ipRestriction: ipRestriction,
    sessionRestriction: sessionRestriction
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
