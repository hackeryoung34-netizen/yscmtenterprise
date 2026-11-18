update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
  'video/mp4','video/webm','video/quicktime',
  'audio/mpeg','audio/mp4','audio/m4a','audio/x-m4a','audio/aac','audio/ogg','audio/webm','audio/wav','audio/x-wav'
]
where id = 'yscmt-chat-media';
