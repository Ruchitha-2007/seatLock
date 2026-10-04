import nodemailer from 'nodemailer';

let transporter = null;

// Initialize mail transporter: uses custom SMTP if configured, else auto-creates an Ethereal SMTP transporter
const getTransporter = async () => {
  if (transporter) return transporter;

  // 1. Check for custom SMTP (e.g., Gmail, SendGrid, Mailtrap, AWS SES)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(`[EMAIL-SERVICE] 📧 Initialized Custom SMTP via ${process.env.SMTP_HOST}`);
    return transporter;
  }

  // 2. Check for Gmail Direct Service
  const gmailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
  const gmailPass = (process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

  if (gmailUser && gmailPass) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
    console.log(`[EMAIL-SERVICE] 📧 Initialized Live Gmail SMTP for ${gmailUser}`);
    return transporter;
  }

  // 3. Fallback: Ethereal test account (creates instant web preview URL for sent emails)
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[EMAIL-SERVICE] 📧 Initialized Ethereal SMTP (${testAccount.user})`);
    return transporter;
  } catch (err) {
    console.error('[EMAIL-SERVICE] Failed to create Ethereal account:', err.message);
    return null;
  }
};

/**
 * Send Cinema Reservation Confirmation Email
 */
export const sendBookingConfirmationEmail = async ({
  to,
  customerName,
  bookingReference,
  movieTitle,
  theaterName,
  screenName,
  showTime,
  seats,
  totalAmount,
}) => {
  if (!to) {
    console.warn('[EMAIL-SERVICE] No recipient email specified.');
    return { success: false, error: 'Recipient email missing' };
  }

  try {
    const mailer = await getTransporter();
    if (!mailer) {
      console.warn('[EMAIL-SERVICE] Email transporter not available.');
      return { success: false, error: 'Email transporter not available' };
    }

    const senderEmail = process.env.SMTP_FROM || (process.env.EMAIL_USER ? `"SeatLock Cinema" <${process.env.EMAIL_USER}>` : null) || process.env.GMAIL_USER || '"SeatLock Cinema" <reservations@seatlock.com>';
    const seatListStr = seats.map((s) => `Row ${s.label || s}`).join(', ');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d0d12; color: #ffffff; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #161622; border-radius: 16px; border: 1px solid #2d2d3f; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 30px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0 0; color: #e0e7ff; font-size: 14px; }
    .content { padding: 24px; }
    .pnr-box { background: #1f1f2e; border: 1px dashed #7c3aed; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .pnr-label { font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; }
    .pnr-code { font-family: monospace; font-size: 28px; font-weight: bold; color: #fbbf24; margin: 4px 0; }
    .ticket-details { background: #12121a; border-radius: 12px; padding: 18px; margin-bottom: 24px; border: 1px solid #242436; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1f1f2e; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #9ca3af; }
    .detail-value { color: #ffffff; font-weight: 600; text-align: right; }
    .policy-box { background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 24px; }
    .policy-title { color: #f59e0b; font-weight: bold; font-size: 14px; margin-bottom: 4px; }
    .policy-text { color: #fef08a; font-size: 13px; line-height: 1.5; margin: 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #242436; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎟️ SeatLock Cinema Reservation</h1>
      <p>Your seats are locked and confirmed, ${customerName}!</p>
    </div>
    
    <div class="content">
      <div class="pnr-box">
        <div class="pnr-label">Booking Reference / PNR</div>
        <div class="pnr-code">${bookingReference}</div>
        <div style="font-size: 12px; color: #9ca3af;">Show this code at the theater box office</div>
      </div>

      <div class="policy-box">
        <div class="policy-title">⚠️ Mandatory Counter Payment Rule</div>
        <p class="policy-text">
          Please arrive and pay <strong>₹${parseFloat(totalAmount).toFixed(2)}</strong> at the cinema box office <strong>at least 15 minutes before showtime</strong>. Unclaimed reservations may be automatically released 15 minutes prior to the show.
        </p>
      </div>

      <div class="ticket-details">
        <div class="detail-row">
          <span class="detail-label">Movie</span>
          <span class="detail-value" style="color: #c4b5fd;">${movieTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Theater & Screen</span>
          <span class="detail-value">${theaterName} (${screenName})</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Showtime</span>
          <span class="detail-value">📅 ${showTime}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Reserved Seats (${seats.length})</span>
          <span class="detail-value" style="color: #fbbf24;">${seatListStr}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Payable at Counter</span>
          <span class="detail-value" style="font-size: 16px; color: #4ade80;">₹${parseFloat(totalAmount).toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">SeatLock Cinema Systems • Zero Double-Booking Guarantee</p>
      <p style="margin: 0;">Need help? Present your PNR at the theater customer care desk.</p>
    </div>
  </div>
</body>
</html>
    `;

    const info = await mailer.sendMail({
      from: senderEmail,
      to,
      subject: `🎟️ SeatLock Confirmation: "${movieTitle}" (PNR: ${bookingReference})`,
      text: `SeatLock Reservation Confirmed!\nPNR: ${bookingReference}\nMovie: ${movieTitle}\nTheater: ${theaterName} (${screenName})\nShowtime: ${showTime}\nSeats: ${seatListStr}\nAmount Due at Box Office: ₹${parseFloat(totalAmount).toFixed(2)}\n\nPayment Rule: Please arrive and pay at the cinema box office at least 15 minutes before showtime.`,
      html: htmlContent,
    });

    console.log(`\n================= [EMAIL SENT] =================`);
    console.log(`📧 RECIPIENT: ${to}`);
    console.log(`🎟️ PNR: ${bookingReference}`);
    console.log(`🎬 MOVIE: ${movieTitle}`);
    console.log(`📬 MESSAGE ID: ${info.messageId}`);
    
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`🔗 VIEW PREVIEW EMAIL IN BROWSER: ${previewUrl}`);
    }
    console.log(`================================================\n`);

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || null,
      recipient: to,
    };
  } catch (error) {
    console.error('[EMAIL-SERVICE] ❌ Error sending booking email:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send Cinema Reservation Cancellation Email
 */
export const sendBookingCancellationEmail = async ({
  to,
  customerName,
  bookingReference,
  movieTitle,
  theaterName,
  screenName,
  showTime,
  seats,
  totalAmount,
}) => {
  if (!to) {
    console.warn('[EMAIL-SERVICE] No recipient email specified for cancellation.');
    return { success: false, error: 'Recipient email missing' };
  }

  try {
    const mailer = await getTransporter();
    if (!mailer) {
      console.warn('[EMAIL-SERVICE] Email transporter not available.');
      return { success: false, error: 'Email transporter not available' };
    }

    const senderEmail = process.env.SMTP_FROM || (process.env.EMAIL_USER ? `"SeatLock Cinema" <${process.env.EMAIL_USER}>` : null) || process.env.GMAIL_USER || '"SeatLock Cinema" <reservations@seatlock.com>';
    const seatListStr = Array.isArray(seats) 
      ? seats.map((s) => (typeof s === 'object' ? `Row ${s.label || s}` : `Row ${s}`)).join(', ')
      : 'Selected Seats';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0d0d12; color: #ffffff; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #161622; border-radius: 16px; border: 1px solid #2d2d3f; overflow: hidden; }
    .header { background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 30px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; color: #ffffff; letter-spacing: -0.5px; }
    .header p { margin: 8px 0 0 0; color: #fee2e2; font-size: 14px; }
    .content { padding: 24px; }
    .pnr-box { background: #1f1f2e; border: 1px dashed #ef4444; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .pnr-label { font-size: 12px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; }
    .pnr-code { font-family: monospace; font-size: 26px; font-weight: bold; color: #fca5a5; margin: 4px 0; text-decoration: line-through; }
    .status-badge { display: inline-block; background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
    .ticket-details { background: #12121a; border-radius: 12px; padding: 18px; margin-bottom: 24px; border: 1px solid #242436; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1f1f2e; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #9ca3af; }
    .detail-value { color: #ffffff; font-weight: 600; text-align: right; }
    .notice-box { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 14px; margin-bottom: 24px; }
    .notice-title { color: #f87171; font-weight: bold; font-size: 14px; margin-bottom: 4px; }
    .notice-text { color: #fecaca; font-size: 13px; line-height: 1.5; margin: 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #242436; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Reservation Cancelled</h1>
      <p>Your booking has been cancelled, ${customerName}.</p>
    </div>
    
    <div class="content">
      <div class="pnr-box">
        <div class="pnr-label">Booking Reference / PNR</div>
        <div class="pnr-code">${bookingReference}</div>
        <div style="margin-top: 6px;"><span class="status-badge">CANCELLED</span></div>
      </div>

      <div class="notice-box">
        <div class="notice-title">Seats Released Back to Inventory</div>
        <p class="notice-text">
          Your reserved seats have been successfully released back to the available seating map. Since you chose the <strong>Pay-at-Theater</strong> option, no payment was deducted.
        </p>
      </div>

      <div class="ticket-details">
        <div class="detail-row">
          <span class="detail-label">Movie</span>
          <span class="detail-value">${movieTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Theater & Screen</span>
          <span class="detail-value">${theaterName} (${screenName})</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Showtime</span>
          <span class="detail-value">📅 ${showTime}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Cancelled Seats</span>
          <span class="detail-value" style="color: #f87171;">${seatListStr}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Original Due Amount</span>
          <span class="detail-value" style="color: #9ca3af;">₹${parseFloat(totalAmount || 0).toFixed(2)} (Voided)</span>
        </div>
      </div>

      <p style="text-align: center; font-size: 13px; color: #9ca3af; margin: 0;">
        You can explore other upcoming shows and book anytime on SeatLock!
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;">SeatLock Cinema Systems • Instant Seat Reservation</p>
      <p style="margin: 0;">Questions? Reply to this email or visit our help desk.</p>
    </div>
  </div>
</body>
</html>
    `;

    const info = await mailer.sendMail({
      from: senderEmail,
      to,
      subject: `❌ SeatLock Reservation Cancelled: "${movieTitle}" (PNR: ${bookingReference})`,
      text: `SeatLock Reservation Cancelled\n\nPNR: ${bookingReference}\nStatus: CANCELLED\nMovie: ${movieTitle}\nTheater: ${theaterName} (${screenName})\nShowtime: ${showTime}\nSeats Released: ${seatListStr}\n\nYour seat reservation has been released back to available seats. Since you selected Pay-at-Theater, no amount was charged.`,
      html: htmlContent,
    });

    console.log(`\n================= [CANCELLATION EMAIL SENT] =================`);
    console.log(`📧 RECIPIENT: ${to}`);
    console.log(`🎟️ PNR: ${bookingReference}`);
    console.log(`🎬 MOVIE: ${movieTitle}`);
    console.log(`📬 MESSAGE ID: ${info.messageId}`);
    console.log(`=============================================================\n`);

    return {
      success: true,
      messageId: info.messageId,
      recipient: to,
    };
  } catch (error) {
    console.error('[EMAIL-SERVICE] ❌ Error sending cancellation email:', error.message);
    return { success: false, error: error.message };
  }
};

