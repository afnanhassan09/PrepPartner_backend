const axios = require("axios");
require("dotenv").config();

const token = process.env.TOKEN;

/**
 * Create an instant Zoom meeting and return the participant join URL.
 * @param {string} topic - The topic of the meeting.
 * @param {number} duration - Duration of the meeting in minutes.
 * @returns {Promise<string>} - The join URL for participants.
 */
async function createInstantMeeting(topic, duration) {
  try {
    const response = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic,
        type: 1, // Instant meeting
        duration,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true, // Allow participants to join immediately
          waiting_room: false, // No waiting room for instant meetings
          mute_upon_entry: true,
          watermark: false,
          use_pmi: false,
          approval_type: 0,
          audio: "both",
          auto_recording: "none",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.join_url;
  } catch (error) {
    console.error(
      "Error creating instant meeting:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Failed to create instant meeting");
  }
}

module.exports = { createInstantMeeting };
