const axios = require('axios');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'RuralMate <noreply@algearithm.xyz>';
const RESEND_URL = 'https://api.resend.com/emails';

// ============================================
// CORE SEND FUNCTION
// ============================================
async function sendEmail({ to, subject, html, text }) {
  try {
    if (!RESEND_API_KEY) {
      console.log('⚠️ RESEND_API_KEY not set — skipping email');
      return { success: false, reason: 'No API key' };
    }

    if (!to || !subject) {
      console.log('⚠️ Email missing to or subject — skipping');
      return { success: false, reason: 'Missing fields' };
    }

    console.log(`📧 Sending email to ${to}: ${subject}`);

    const response = await axios.post(
      RESEND_URL,
      {
        from: EMAIL_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || `<p>${text || ''}</p>`,
        text: text || ''
      },
      {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('✅ Email sent successfully:', response.data.id);
    return { success: true, id: response.data.id };

  } catch (error) {
    const errMsg = error.response?.data?.message || error.message;
    console.log('❌ Email send failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

// Welcome email on registration
async function sendWelcomeEmail(user) {
  const roleLabels = {
    farmer: 'Farmer 🧑‍🌾',
    villager: 'Resident 👨‍👩‍👧',
    gramsevak: 'Field Officer 👨‍⚕️',
    doctor: 'Doctor 🩺'
  };

  const langMessages = {
    en: {
      title: 'Welcome to RuralMate!',
      body: `Dear ${user.name}, your account has been created successfully.`
    },
    te: {
      title: 'RuralMate కి స్వాగతం!',
      body: `ప్రియమైన ${user.name}, మీ ఖాతా విజయవంతంగా సృష్టించబడింది.`
    },
    hi: {
      title: 'RuralMate में स्वागत है!',
      body: `प्रिय ${user.name}, आपका खाता सफलतापूर्वक बनाया गया है।`
    }
  };

  const lang = langMessages[user.language] || langMessages.en;

  return sendEmail({
    to: user.email || null,
    subject: `Welcome to RuralMate — ${user.name}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: #2e7d32; padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: #c8e6c9; margin: 8px 0 0; }
    .body { padding: 24px; }
    .role-badge { background: #e8f5e9; border-radius: 20px; padding: 8px 16px; display: inline-block; color: #2e7d32; font-weight: bold; margin: 12px 0; }
    .info-row { background: #f9f9f9; border-radius: 8px; padding: 12px; margin: 8px 0; display: flex; justify-content: space-between; }
    .info-label { color: #666; font-size: 13px; }
    .info-value { color: #333; font-weight: bold; font-size: 13px; }
    .footer { background: #f5f5f5; padding: 16px; text-align: center; color: #888; font-size: 12px; }
    .btn { background: #2e7d32; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; margin-top: 16px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌾 RuralMate</h1>
      <p>Your Village Companion</p>
    </div>
    <div class="body">
      <h2>${lang.title}</h2>
      <p>${lang.body}</p>
      <div class="role-badge">${roleLabels[user.role] || user.role}</div>
      <div class="info-row">
        <span class="info-label">📱 Phone</span>
        <span class="info-value">${user.phone}</span>
      </div>
      <div class="info-row">
        <span class="info-label">📍 Village</span>
        <span class="info-value">${user.village}</span>
      </div>
      <div class="info-row">
        <span class="info-label">🌍 Language</span>
        <span class="info-value">${user.language?.toUpperCase()}</span>
      </div>
      <p style="color:#666; font-size:13px; margin-top:16px;">
        Keep your PIN safe. Do not share it with anyone.
      </p>
    </div>
    <div class="footer">
      <p>RuralMate — Serving Rural India 🇮🇳</p>
      <p>algearithm.xyz</p>
    </div>
  </div>
</body>
</html>
    `
  });
}

// Appointment booked — notify patient
async function sendAppointmentBookedEmail(patient, doctor, appointment) {
  if (!patient?.email) return { success: false, reason: 'No patient email' };

  return sendEmail({
    to: patient.email,
    subject: `📅 Appointment Requested — Dr. ${doctor.name}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: #1565c0; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .body { padding: 24px; }
    .info-row { background: #f9f9f9; border-radius: 8px; padding: 12px; margin: 8px 0; display: flex; justify-content: space-between; }
    .info-label { color: #666; font-size: 13px; }
    .info-value { color: #333; font-weight: bold; font-size: 13px; }
    .status-badge { background: #fff8e1; border-radius: 20px; padding: 8px 16px; color: #f57f17; font-weight: bold; display: inline-block; margin: 12px 0; }
    .footer { background: #f5f5f5; padding: 16px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Appointment Requested</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${patient.name}</strong>,</p>
      <p>Your appointment request has been sent to <strong>Dr. ${doctor.name}</strong>.</p>
      <div class="status-badge">⏳ Waiting for doctor confirmation</div>
      <div class="info-row">
        <span class="info-label">🩺 Doctor</span>
        <span class="info-value">Dr. ${doctor.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">🏥 Specialization</span>
        <span class="info-value">${doctor.specialization || 'General Physician'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">🤒 Symptoms</span>
        <span class="info-value">${appointment.symptoms?.join(', ') || 'Not specified'}</span>
      </div>
      ${appointment.scheduledDate ? `
      <div class="info-row">
        <span class="info-label">📅 Requested Date</span>
        <span class="info-value">${appointment.scheduledDate} ${appointment.scheduledTime || ''}</span>
      </div>` : ''}
      <p style="color:#666; font-size:13px; margin-top:16px;">
        You will be notified once the doctor confirms your appointment.
        A video call link will be ready when confirmed.
      </p>
    </div>
    <div class="footer">
      <p>RuralMate — Your Village Health Companion 🌾</p>
    </div>
  </div>
</body>
</html>
    `
  });
}

// Appointment confirmed — notify patient with meeting link
async function sendAppointmentConfirmedEmail(patient, doctor, appointment) {
  if (!patient?.email) return { success: false, reason: 'No patient email' };

  return sendEmail({
    to: patient.email,
    subject: `✅ Appointment Confirmed — Dr. ${doctor.name}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: #2e7d32; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .body { padding: 24px; }
    .info-row { background: #f9f9f9; border-radius: 8px; padding: 12px; margin: 8px 0; display: flex; justify-content: space-between; }
    .info-label { color: #666; font-size: 13px; }
    .info-value { color: #333; font-weight: bold; font-size: 13px; }
    .meet-btn { background: #2e7d32; color: white; padding: 14px 24px; border-radius: 8px; text-decoration: none; display: block; text-align: center; margin: 16px 0; font-weight: bold; font-size: 16px; }
    .footer { background: #f5f5f5; padding: 16px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Appointment Confirmed!</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${patient.name}</strong>,</p>
      <p>Your appointment with <strong>Dr. ${doctor.name}</strong> has been confirmed!</p>
      <div class="info-row">
        <span class="info-label">🩺 Doctor</span>
        <span class="info-value">Dr. ${doctor.name}</span>
      </div>
      <div class="info-row">
        <span class="info-label">🏥 Hospital</span>
        <span class="info-value">${doctor.hospitalName || 'N/A'}</span>
      </div>
      ${appointment.scheduledDate ? `
      <div class="info-row">
        <span class="info-label">📅 Date & Time</span>
        <span class="info-value">${appointment.scheduledDate} at ${appointment.scheduledTime || 'TBD'}</span>
      </div>` : ''}
      ${appointment.meetLink ? `
      <a href="${appointment.meetLink}" class="meet-btn">
        🎥 Join Video Call
      </a>
      <p style="color:#666; font-size:12px; text-align:center;">
        Click the button above at your appointment time to join the video call
      </p>` : ''}
    </div>
    <div class="footer">
      <p>RuralMate — Your Village Health Companion 🌾</p>
    </div>
  </div>
</body>
</html>
    `
  });
}

// Prescription ready — notify patient
async function sendPrescriptionEmail(patient, doctor, prescription) {
  if (!patient?.email) return { success: false, reason: 'No patient email' };

  const medicinesList = prescription.medicines?.map(m =>
    `<div class="info-row">
      <span class="info-label">💊 ${m.name}</span>
      <span class="info-value">${m.dosage} — ${m.frequency} for ${m.duration}</span>
    </div>`
  ).join('') || '';

  return sendEmail({
    to: patient.email,
    subject: `💊 Prescription Ready — Dr. ${doctor.name}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: #6a1b9a; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .body { padding: 24px; }
    .info-row { background: #f9f9f9; border-radius: 8px; padding: 12px; margin: 8px 0; display: flex; justify-content: space-between; }
    .info-label { color: #666; font-size: 13px; }
    .info-value { color: #333; font-weight: bold; font-size: 13px; }
    .diagnosis-box { background: #fce4ec; border-radius: 10px; padding: 14px; margin: 12px 0; }
    .diagnosis-label { color: #c62828; font-weight: bold; font-size: 13px; margin-bottom: 6px; }
    .medicines-box { background: #f3e5f5; border-radius: 10px; padding: 14px; margin: 12px 0; }
    .medicines-label { color: #6a1b9a; font-weight: bold; font-size: 13px; margin-bottom: 8px; }
    .advice-box { background: #e8f5e9; border-radius: 10px; padding: 14px; margin: 12px 0; }
    .footer { background: #f5f5f5; padding: 16px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💊 Prescription Ready</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${patient.name}</strong>,</p>
      <p>Dr. <strong>${doctor.name}</strong> has sent you a prescription.</p>
      <div class="info-row">
        <span class="info-label">🩺 Doctor</span>
        <span class="info-value">Dr. ${doctor.name} (${doctor.specialization || 'General Physician'})</span>
      </div>
      <div class="diagnosis-box">
        <div class="diagnosis-label">🏥 Diagnosis</div>
        <div>${prescription.diagnosis}</div>
      </div>
      <div class="medicines-box">
        <div class="medicines-label">💊 Medicines</div>
        ${medicinesList}
      </div>
      ${prescription.advice ? `
      <div class="advice-box">
        <div style="font-weight:bold; color:#2e7d32; margin-bottom:6px;">💬 Doctor's Advice</div>
        <div>${prescription.advice}</div>
      </div>` : ''}
      ${prescription.followUpDate ? `
      <div class="info-row">
        <span class="info-label">🔄 Follow-up</span>
        <span class="info-value">${prescription.followUpDate}</span>
      </div>` : ''}
      <p style="color:#c62828; font-size:12px; margin-top:16px;">
        ⚠️ Take medicines as prescribed. Do not stop without consulting the doctor.
      </p>
    </div>
    <div class="footer">
      <p>RuralMate — Your Village Health Companion 🌾</p>
    </div>
  </div>
</body>
</html>
    `
  });
}

// Epidemic alert email to field officer
async function sendEpidemicAlertEmail(fieldOfficer, village, symptoms) {
  if (!fieldOfficer?.email) return { success: false, reason: 'No email' };

  return sendEmail({
    to: fieldOfficer.email,
    subject: `🚨 Epidemic Alert — ${village}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; }
    .header { background: #c62828; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .body { padding: 24px; }
    .alert-box { background: #ffebee; border-radius: 10px; padding: 16px; border-left: 4px solid #c62828; margin: 12px 0; }
    .footer { background: #f5f5f5; padding: 16px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 Epidemic Alert!</h1>
    </div>
    <div class="body">
      <p>Dear <strong>${fieldOfficer.name}</strong>,</p>
      <div class="alert-box">
        <p><strong>Village:</strong> ${village}</p>
        <p><strong>Alert:</strong> 5+ cases of the following symptoms reported in the last 3 days:</p>
        <p><strong>${symptoms.join(', ')}</strong></p>
      </div>
      <p>Please take immediate action:</p>
      <ul>
        <li>Visit affected households</li>
        <li>Report to PHC immediately</li>
        <li>Call health helpline: 104</li>
        <li>Contact ambulance if needed: 108</li>
      </ul>
    </div>
    <div class="footer">
      <p>RuralMate — Your Village Health Companion 🌾</p>
    </div>
  </div>
</body>
</html>
    `
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendAppointmentBookedEmail,
  sendAppointmentConfirmedEmail,
  sendPrescriptionEmail,
  sendEpidemicAlertEmail
};
