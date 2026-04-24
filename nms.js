const NodeMediaServer = require('node-media-server');
const logger = require('./src/utils/logger');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: './media',
  },
  trans: {
    ffmpeg: process.platform === 'win32' ? './ffmpeg/bin/ffmpeg.exe' : '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      }
    ]
  }
};

const nms = new NodeMediaServer(config);

nms.on('preConnect', (id, args) => {
  logger.info(`[NodeEvent on preConnect] id=${id} args=${JSON.stringify(args)}`);
});

nms.on('postConnect', (id, args) => {
  logger.info(`[NodeEvent on postConnect] id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  logger.info(`[NodeEvent on doneConnect] id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, StreamPath, args) => {
  logger.info(`[NodeEvent on prePublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('postPublish', (id, StreamPath, args) => {
  logger.info(`[NodeEvent on postPublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  logger.info(`[NodeEvent on donePublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

module.exports = nms;
