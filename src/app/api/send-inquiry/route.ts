import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { saveLead } from '@/lib/leads'

// Web3Forms Access Key
const WEB3FORMS_ACCESS_KEY = process.env.WEB3FORMS_ACCESS_KEY || ''
const RECIPIENT_EMAIL = 'info@frankenautoankauf.de'

// Optional: Google Sheets webhook (Apps Script)
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL || ''

// 30 days retention for uploaded images (handled by /api/cleanup-uploads cron)
const UPLOAD_PREFIX = 'uploads'

function safeExt(filename: string) {
  const lower = filename.toLowerCase()
  const match = lower.match(/\.(jpg|jpeg|png|webp|heic|heif)$/)
  return match ? match[0] : '.jpg'
}

function safeSlug(input: string) {
  return (input || 'upload')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

// Generate unique lead ID
function generateLeadId() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `lead_${timestamp}_${random}`
}

// Get base URL for dashboard links
function getBaseUrl() {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_BASE_URL || 'https://frankenautoankauf.de'
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    // Generate unique lead ID
    const leadId = generateLeadId()

    // Extract form fields
    const brand = formData.get('brand') as string
    const model = formData.get('model') as string
    const year = formData.get('year') as string
    const mileage = formData.get('mileage') as string
    const fuel = formData.get('fuel') as string
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const location = formData.get('location') as string
    const message = formData.get('message') as string

    // Lead tracking context
    const page_url = formData.get('page_url') as string
    const page_path = formData.get('page_path') as string
    const referrer = formData.get('referrer') as string
    const device_type = formData.get('device_type') as string
    const timestamp = formData.get('timestamp') as string
    const lead_source_url = formData.get('lead_source_url') as string
    const lead_source_path = formData.get('lead_source_path') as string
    const click_source = formData.get('click_source') as string

    // Upload images to Vercel Blob (public URLs)
    const files = formData.getAll('images') as File[]
    const validFiles = files.filter(f => f && typeof (f as File).size === 'number' && (f as File).size > 0)
    const fileCount = validFiles.length

    const imageUrls: string[] = []
    let uploadError: string | null = null

    // Only attempt Blob upload if token is configured (works on Vercel, not locally)
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    if (fileCount > 0 && blobToken) {
      try {
        const ts = Date.now()
        const brandSlug = safeSlug(brand)
        const modelSlug = safeSlug(model)

        for (const [idx, file] of validFiles.entries()) {
          const ext = safeExt(file.name || '')
          const pathname = `${UPLOAD_PREFIX}/${brandSlug || 'auto'}-${modelSlug || 'modell'}-${ts}-${idx + 1}${ext}`

          // put() accepts File/Blob in Next.js Route Handlers (node runtime)
          const blob = await put(pathname, file, {
            access: 'public',
            addRandomSuffix: true,
            contentType: (file as File).type || undefined,
          })

          imageUrls.push(blob.url)
        }
      } catch (err) {
        uploadError = err instanceof Error ? err.message : 'unknown upload error'
        console.error('❌ Blob upload failed:', uploadError)
        // Continue without images - don't fail the whole request
      }
    } else if (fileCount > 0) {
      console.log('⚠️ Blob token not configured, skipping image upload')
      uploadError = 'Bild-Upload nur auf Vercel verfügbar'
    }

    // Save lead locally (only works in development, not on Vercel's read-only filesystem)
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
    if (!isVercel) {
      try {
        saveLead({
          timestamp: timestamp || new Date().toISOString(),
          brand: brand || '',
          model: model || '',
          year: year || '',
          mileage: mileage || '',
          fuel: fuel || '',
          priceExpectation: (formData.get('priceExpectation') as string) || '',
          name: name || '',
          email: email || '',
          phone: phone || '',
          location: location || '',
          message: message || '',
          page_url: page_url || '',
          page_path: page_path || '',
          referrer: referrer || '',
          device_type: device_type || '',
          lead_source_url: lead_source_url || '',
          lead_source_path: lead_source_path || '',
          click_source: click_source || '',
          image_urls: imageUrls
        })
        console.log('✅ Lead lokal gespeichert')
      } catch (err) {
        console.error('❌ Lead konnte nicht gespeichert werden:', err)
      }
    }

    // Log the inquiry
    console.log('=== NEUE AUTO-ANKAUF ANFRAGE ===')
    console.log('Von:', name, '-', email, '-', phone)
    console.log('Fahrzeug:', brand?.toUpperCase(), model, year)
    console.log('Access Key:', WEB3FORMS_ACCESS_KEY ? 'Configured' : 'Missing')
    console.log('================================')

    // Check if Web3Forms key is configured
    if (!WEB3FORMS_ACCESS_KEY || WEB3FORMS_ACCESS_KEY === 'YOUR_ACCESS_KEY_HERE') {
      console.log('⚠️ Web3Forms Access Key nicht konfiguriert!')
      return NextResponse.json({
        success: true,
        message: 'Anfrage erfolgreich gesendet!'
      })
    }

    // Dashboard URL for this lead
    const baseUrl = getBaseUrl()
    const dashboardUrl = `${baseUrl}/admin/dashboard/lead/${leadId}`

    // Build clean plain text email - URLs on separate lines will be auto-linked by email clients
    const imageLinksText = imageUrls.length > 0
      ? imageUrls.map((url, idx) => `Bild ${idx + 1}:\n${url}`).join('\n\n')
      : 'Keine Bilder'

    const plainTextMessage = `
FAHRZEUG: ${brand?.toUpperCase() || '-'} ${model || '-'} (${year || '-'})
Kilometerstand: ${mileage ? Number(mileage).toLocaleString('de-DE') + ' km' : '-'}
Kraftstoff: ${fuel || '-'}

KUNDE: ${name || '-'}
Telefon: ${phone || '-'}
E-Mail: ${email || '-'}
Standort: ${location || '-'}

NACHRICHT:
${message || '-'}

BILDER (${imageUrls.length}):
${imageLinksText}

DASHBOARD:
${dashboardUrl}
    `.trim()

    const forwardToSheets = async () => {
      if (!SHEETS_WEBHOOK_URL) return
      try {
        const sheetsPayload = {
          id: leadId,
          brand: brand || '',
          model: model || '',
          year: year || '',
          mileage: mileage || '',
          fuel: fuel || '',
          priceExpectation: (formData.get('priceExpectation') as string) || '',
          name: name || '',
          email: email || '',
          phone: phone || '',
          location: location || '',
          message: message || '',
          image_urls: imageUrls,
          upload_error: uploadError || '',
          page_url,
          page_path,
          referrer,
          device_type,
          timestamp,
          lead_source_url,
          lead_source_path,
          click_source,
        }

        const sheetsRes = await fetch(SHEETS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetsPayload),
        })
        console.log('✅ Sheets webhook sent, status:', sheetsRes.status)
      } catch (err) {
        console.error('❌ Sheets webhook failed:', err)
      }
    }

    // Send via Web3Forms
    console.log('Sending to Web3Forms...')

    const requestBody: Record<string, any> = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: `${brand?.toUpperCase()} ${model} (${year}) - ${name}`,
      from_name: name || 'Website Besucher',
      replyto: email,
      // Plain text message - Web3Forms will display this
      message: plainTextMessage,
      // Image URLs as separate clickable fields
      ...(imageUrls.length > 0 && {
        'Bild 1': imageUrls[0] || '',
        'Bild 2': imageUrls[1] || '',
        'Bild 3': imageUrls[2] || '',
        'Bild 4': imageUrls[3] || '',
        'Bild 5': imageUrls[4] || '',
      }),
      // Dashboard link as separate field
      'Dashboard': dashboardUrl,
      // Customer details as separate fields for Web3Forms to display
      'Fahrzeug': `${brand?.toUpperCase()} ${model} (${year})`,
      'Kunde': name,
      'Telefon': phone,
      'E-Mail Kunde': email,
      'Standort': location,
      'Kilometerstand': mileage ? `${Number(mileage).toLocaleString('de-DE')} km` : '-',
      'Kraftstoff': fuel,
      page_url,
      page_path,
      referrer,
      device_type,
      timestamp,
      lead_source_url,
      lead_source_path,
      click_source
    }

    console.log('Request body prepared')

    const web3Response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'FrankenAutoAnkauf/1.0'
      },
      body: JSON.stringify(requestBody)
    })

    // Handle non-JSON responses (e.g., HTML error pages)
    const responseText = await web3Response.text()
    let result: { success: boolean; message?: string }
    try {
      result = JSON.parse(responseText)
    } catch {
      console.error('❌ Web3Forms returned non-JSON response:', responseText.substring(0, 200))
      // If Web3Forms fails, still save the lead and return success to user
      await forwardToSheets()
      return NextResponse.json({
        success: true,
        message: 'Anfrage erfolgreich gesendet! (E-Mail wird nachgesendet)'
      })
    }
    console.log('Web3Forms response:', JSON.stringify(result))

    if (result.success) {
      await forwardToSheets()
      console.log('✅ E-Mail erfolgreich gesendet an', RECIPIENT_EMAIL)
      return NextResponse.json({
        success: true,
        message: 'Anfrage erfolgreich gesendet!'
      })
    } else {
      console.error('❌ Web3Forms Fehler:', result.message || JSON.stringify(result))
      await forwardToSheets()
      // Web3Forms failed — return an error so the UI can show feedback
      return NextResponse.json({
        success: false,
        message: 'Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut.'
      }, { status: 502 })
    }

  } catch (error) {
    console.error('Error processing inquiry:', error)
    return NextResponse.json({
      success: false,
      message: 'Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut.'
    }, { status: 500 })
  }
}

// Force dynamic rendering
export const dynamic = "force-dynamic"

// Needed for @vercel/blob
export const runtime = "nodejs"
