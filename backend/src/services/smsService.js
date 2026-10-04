/**
 * SeatLock Live SMS Gateway Dispatcher
 * Integrates with Fast2SMS (India) and Twilio (Global)
 */

export const sendRealSms = async ({ phone, message }) => {
  // Strip country prefix if passed, keeping clean 10-digit number
  let cleanPhone = (phone || '').toString().trim().replace(/\D/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.slice(2);
  }

  // 1. FAST2SMS Integration (Optimized for Indian mobile numbers like Airtel, Jio, Vi)
  const fast2smsKey = process.env.FAST2SMS_API_KEY;
  if (fast2smsKey) {
    try {
      console.log(`[SMS-SERVICE] 📡 Dispatching real telecom SMS to +91 ${cleanPhone} via Fast2SMS Gateway...`);
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: fast2smsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: message,
          language: 'english',
          flash: 0,
          numbers: cleanPhone,
        }),
      });

      const result = await response.json();
      console.log(`[SMS-SERVICE] Fast2SMS Gateway Response:`, result);
      return { success: result.return === true, provider: 'Fast2SMS', result };
    } catch (err) {
      console.error(`[SMS-SERVICE] ❌ Fast2SMS Gateway Error:`, err.message);
      return { success: false, provider: 'Fast2SMS', error: err.message };
    }
  }

  // 2. TWILIO Integration (Alternative international gateway)
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioAuthToken && twilioPhoneNumber) {
    try {
      console.log(`[SMS-SERVICE] 📡 Dispatching real SMS to +91${cleanPhone} via Twilio...`);
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');
      const params = new URLSearchParams({
        To: `+91${cleanPhone}`,
        From: twilioPhoneNumber,
        Body: message,
      });

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const result = await response.json();
      console.log(`[SMS-SERVICE] Twilio Gateway Response:`, result.sid || result);
      return { success: !result.error_code, provider: 'Twilio', result };
    } catch (err) {
      console.error(`[SMS-SERVICE] ❌ Twilio Gateway Error:`, err.message);
      return { success: false, provider: 'Twilio', error: err.message };
    }
  }

  // 3. Fallback when API keys are not yet configured in .env
  console.log(`\n======================================================`);
  console.log(`⚠️ [LIVE SMS NOTICE] REAL TELECOM SMS CARRIER NOT CONFIGURED`);
  console.log(`📲 Target Recipient: +91 ${cleanPhone}`);
  console.log(`💬 Message: "${message}"`);
  console.log(`💡 To deliver actual SMS to ${cleanPhone}'s handset via Jio/Airtel/Vi:`);
  console.log(`   Add FAST2SMS_API_KEY=your_key in backend/.env (free at fast2sms.com)`);
  console.log(`   OR add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN & TWILIO_PHONE_NUMBER in backend/.env`);
  console.log(`======================================================\n`);

  return {
    success: false,
    provider: 'None',
    notice: 'SMS gateway API key not configured in .env',
  };
};
