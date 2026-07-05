const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ============================================
// CORE SEND FUNCTION
// ============================================
async function sendPushNotification({ token, title, body, data = {} }) {
  try {
    if (!token || !token.startsWith('ExponentPushToken[')) {
      console.log('⚠️ Invalid or missing push token — skipping push');
      return { success: false, reason: 'Invalid token' };
    }

    console.log(`📲 Sending push: "${title}" to ${token.slice(0, 30)}...`);

    const response = await axios.post(
      EXPO_PUSH_URL,
      {
        to: token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: 'default'
      },
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const result = response.data?.data;

    if (result?.status === 'ok') {
      console.log('✅ Push notification sent successfully');
      return { success: true };
    } else {
      console.log('⚠️ Push notification issue:', result);
      return { success: false, result };
    }

  } catch (error) {
    console.log('❌ Push notification failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Send to multiple tokens at once
async function sendPushToMany(tokens, { title, body, data = {} }) {
  const validTokens = tokens.filter(t =>
    t && typeof t === 'string' && t.startsWith('ExponentPushToken[')
  );

  if (validTokens.length === 0) {
    console.log('⚠️ No valid push tokens found');
    return { success: false, reason: 'No valid tokens' };
  }

  console.log(`📲 Sending push to ${validTokens.length} devices: "${title}"`);

  try {
    // Expo supports batch sending — max 100 at a time
    const chunks = [];
    for (let i = 0; i < validTokens.length; i += 100) {
      chunks.push(validTokens.slice(i, i + 100));
    }

    const results = await Promise.all(
      chunks.map(chunk =>
        axios.post(
          EXPO_PUSH_URL,
          chunk.map(token => ({
            to: token,
            title,
            body,
            data,
            sound: 'default',
            priority: 'high',
            channelId: 'default'
          })),
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        )
      )
    );

    console.log(`✅ Push batch sent to ${validTokens.length} devices`);
    return { success: true, count: validTokens.length };

  } catch (error) {
    console.log('❌ Batch push failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// NOTIFICATION TEMPLATES
// ============================================

// Appointment requested — notify doctor
async function notifyDoctorNewAppointment(doctorToken, patientName, symptoms) {
  return sendPushNotification({
    token: doctorToken,
    title: '📅 New Appointment Request',
    body: `${patientName} has requested an appointment. Symptoms: ${symptoms?.slice(0, 2).join(', ')}`,
    data: { type: 'new_appointment', screen: 'Appointments' }
  });
}

// Appointment confirmed — notify patient
async function notifyPatientAppointmentConfirmed(patientToken, doctorName, scheduledDate) {
  return sendPushNotification({
    token: patientToken,
    title: '✅ Appointment Confirmed!',
    body: `Dr. ${doctorName} confirmed your appointment${scheduledDate ? ` for ${scheduledDate}` : ''}. Video call link is ready!`,
    data: { type: 'appointment_confirmed', screen: 'Doctor' }
  });
}

// Appointment cancelled — notify patient
async function notifyPatientAppointmentCancelled(patientToken, doctorName) {
  return sendPushNotification({
    token: patientToken,
    title: '❌ Appointment Cancelled',
    body: `Your appointment with Dr. ${doctorName} has been cancelled.`,
    data: { type: 'appointment_cancelled', screen: 'Doctor' }
  });
}

// Prescription ready — notify patient
async function notifyPatientPrescriptionReady(patientToken, doctorName, diagnosis) {
  return sendPushNotification({
    token: patientToken,
    title: '💊 Prescription Ready!',
    body: `Dr. ${doctorName} sent your prescription. Diagnosis: ${diagnosis}`,
    data: { type: 'prescription_ready', screen: 'Doctor' }
  });
}

// New community post — notify village users
async function notifyVillageNewPost(villageTokens, posterName, category) {
  const categoryEmojis = {
    crop: '🌾',
    health: '🏥',
    scheme: '📋',
    general: '💬'
  };
  const emoji = categoryEmojis[category] || '💬';

  return sendPushToMany(villageTokens, {
    title: `${emoji} New ${category} post in your village`,
    body: `${posterName} posted an update. Tap to see.`,
    data: { type: 'community_post', screen: 'Community' }
  });
}

// Epidemic alert — notify field officers
async function notifyEpidemicAlert(fieldOfficerTokens, village, symptoms) {
  return sendPushToMany(fieldOfficerTokens, {
    title: '🚨 Epidemic Alert!',
    body: `Multiple cases of ${symptoms.slice(0, 2).join(', ')} reported in ${village}. Immediate action needed!`,
    data: { type: 'epidemic_alert', screen: 'Epidemic' }
  });
}

// New chat message — notify recipient
async function notifyNewChatMessage(recipientToken, senderName, message) {
  return sendPushNotification({
    token: recipientToken,
    title: `💬 Message from ${senderName}`,
    body: message?.length > 60 ? message.slice(0, 60) + '...' : message,
    data: { type: 'chat_message', screen: 'Chat' }
  });
}

module.exports = {
  sendPushNotification,
  sendPushToMany,
  notifyDoctorNewAppointment,
  notifyPatientAppointmentConfirmed,
  notifyPatientAppointmentCancelled,
  notifyPatientPrescriptionReady,
  notifyVillageNewPost,
  notifyEpidemicAlert,
  notifyNewChatMessage
};
