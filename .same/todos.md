# AutoFranken Project Todos

## Completed
- [x] Cloned repository from GitHub
- [x] Installed dependencies
- [x] Started development server
- [x] Created initial version
- [x] Added Google Sheets tracking for events:
  - [x] WhatsApp button clicks (whatsapp_click)
  - [x] Phone call button clicks (phone_click)
  - [x] Form submissions (form_submit)
- [x] Created /api/track-event API endpoint
- [x] Updated leadTracking.ts with tracking functions
- [x] Updated page.tsx with click handlers
- [x] Updated SEOPageTemplate.tsx with click handlers
- [x] Updated GOOGLE_SHEETS_SETUP.md documentation

## Current Status
Tracking system implemented and ready for use.

## Environment Variables Needed
- [ ] `WEB3FORMS_ACCESS_KEY` - Required for form submissions
- [ ] `BLOB_READ_WRITE_TOKEN` - Optional for image uploads
- [ ] `SHEETS_WEBHOOK_URL` - Required for Google Sheets tracking

## How It Works
1. User clicks WhatsApp/Phone button → trackWhatsAppClick() or trackPhoneClick() is called
2. Function sends data to /api/track-event
3. API endpoint forwards data to Google Sheets via SHEETS_WEBHOOK_URL
4. Data includes: event_type, timestamp, page_url, device_type, referrer, etc.
