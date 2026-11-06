"""
Cloudinary media storage for production uploads.

Render's filesystem is ephemeral — files saved to MEDIA_ROOT are wiped on
every redeploy. When CLOUDINARY_URL is configured (see settings.py), all
FileField/ImageField uploads (avatars, school logo, student documents) are
stored on Cloudinary instead, and ``.url`` returns the full CDN URL that both
the website and the desktop app fetch directly.

The stock storages are single-type: MediaCloudinaryStorage uploads everything
as ``image`` (PDFs would be rejected) and RawMediaCloudinaryStorage uploads
everything as ``raw``. This subclass picks the right Cloudinary resource type
per file extension. Unknown/missing extensions default to ``image`` because
Cloudinary strips the extension from image public_ids when saving, so the
stored name of a logo is e.g. ``school/logo`` and must still resolve as image.
"""
from cloudinary_storage.storage import MediaCloudinaryStorage

# Documents & archives — uploaded as raw so any file type is preserved as-is.
RAW_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv', 'rtf', 'odt', 'ods', 'odp',
    'zip', 'rar', '7z',
}

VIDEO_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm'}


class AutoMediaCloudinaryStorage(MediaCloudinaryStorage):
    """Cloudinary storage that auto-detects the resource type per file."""

    def _get_resource_type(self, name):
        ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
        if ext in RAW_EXTENSIONS:
            return 'raw'
        if ext in VIDEO_EXTENSIONS:
            return 'video'
        return 'image'