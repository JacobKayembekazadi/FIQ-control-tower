# Public Assets

This folder contains static assets for the FIQ Control Tower application.

## Structure

- **`/images/`** - Image assets (PNG, JPG, SVG, etc.)
- **`/videos/`** - Video assets (MP4, WebM, etc.)

## Usage

Files in this directory are served statically by Vite. You can reference them in your React components using:

### Images
```tsx
// For images in /public/images/
<img src="/images/your-image.png" alt="Description" />

// Or using import for better optimization
import logoImage from '/images/logo.png';
<img src={logoImage} alt="Logo" />
```

### Videos
```tsx
// For videos in /public/videos/
<video src="/videos/your-video.mp4" controls />
```

## File Organization Tips

- Use descriptive filenames
- Optimize images for web (compress, appropriate formats)
- Consider using WebP for images and WebM for videos for better performance
- Keep file sizes reasonable for faster loading

## Supported Formats

### Images
- PNG, JPG/JPEG, GIF, SVG, WebP, AVIF

### Videos  
- MP4, WebM, OGV

## Notes

- Files are served from the root path (e.g., `/images/logo.png`)
- This folder is publicly accessible
- Don't store sensitive files here