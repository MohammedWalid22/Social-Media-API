const EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  
  // Messages
  SEND_MESSAGE: 'send_message',
  RECEIVE_MESSAGE: 'receive_message',
  TYPING: 'typing',
  STOP_TYPING: 'stop_typing',
  
  // Notifications
  NEW_NOTIFICATION: 'new_notification',
  
  // Stories
  VIEW_STORY: 'view_story',
  
  // Audio
  START_RECORDING: 'start_recording',
  AUDIO_CHUNK: 'audio_chunk',
  STOP_RECORDING: 'stop_recording',
};

module.exports = EVENTS;