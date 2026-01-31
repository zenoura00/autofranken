# AutoFranken Project TODOs

## Completed
- [x] Clone repository from GitHub
- [x] Install dependencies
- [x] Start development server
- [x] Fix lint script to specify src directory
- [x] Fix email format - changed from HTML to plain text for better compatibility
- [x] Fix image links mixing issue - each link now on separate line

## Project Overview
- Next.js App Router project for FrankenAutoAnkauf (car buying/selling service)
- Uses shadcn/ui components with Tailwind CSS
- Features: inquiry forms, SEO pages for cities/cases, admin dashboard
- Environment variables needed: WEB3FORMS_ACCESS_KEY, BLOB_READ_WRITE_TOKEN (optional)

## Recent Changes (v4)
- Email format changed from HTML to plain text
- Image URLs now displayed as separate numbered lines (Bild 1, Bild 2, etc.)
- Added individual image fields (bild_1 through bild_5) to Web3Forms payload
- Dashboard link added to email for quick access
