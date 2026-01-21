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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

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
    if (fileCount > 0) {
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
      }
    }

    // Save lead locally
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

    // Prepare email content - simple HTML format
    const bilderHtml =
      imageUrls.length > 0
        ? `<ul>${imageUrls
            .map((u, i) => `<li><strong>Bild ${i + 1}:</strong> <a href="${u}">${u}</a></li>`)
            .join('')}</ul>`
        : fileCount > 0 && uploadError
          ? `<p><strong>${fileCount} Bild(er)</strong> wurden ausgewählt, aber das Hochladen ist fehlgeschlagen.</p>
             <p><small>Hinweis: Bitte BLOB_READ_WRITE_TOKEN in Vercel Environment Variables setzen.</small></p>`
          : '<p>Keine Bilder hochgeladen</p>'

    const emailContent = `
<h2>Neue Auto-Ankauf Anfrage</h2>

<h3>Fahrzeugdaten:</h3>
<ul>
  <li><strong>Marke:</strong> ${brand?.toUpperCase() || 'Nicht angegeben'}</li>
  <li><strong>Modell:</strong> ${model || 'Nicht angegeben'}</li>
  <li><strong>Baujahr:</strong> ${year || 'Nicht angegeben'}</li>
  <li><strong>Kilometerstand:</strong> ${mileage || 'Nicht angegeben'} km</li>
  <li><strong>Kraftstoff:</strong> ${fuel || 'Nicht angegeben'}</li>
</ul>

<h3>Kontaktdaten:</h3>
<ul>
  <li><strong>Name:</strong> ${name || 'Nicht angegeben'}</li>
  <li><strong>E-Mail:</strong> ${email || 'Nicht angegeben'}</li>
  <li><strong>Telefon:</strong> ${phone || 'Nicht angegeben'}</li>
  <li><strong>Standort:</strong> ${location || 'Nicht angegeben'}</li>
</ul>

<h3>Lead-Tracking:</h3>
<ul>
  <li><strong>Quelle (Klick):</strong> ${click_source || '-'}</li>
  <li><strong>Quelle URL:</strong> ${lead_source_url || '-'}</li>
  <li><strong>Seite:</strong> ${page_url || '-'}</li>
  <li><strong>Referrer:</strong> ${referrer || '-'}</li>
  <li><strong>Gerät:</strong> ${device_type || '-'}</li>
  <li><strong>Zeit:</strong> ${timestamp || '-'}</li>
</ul>

<h3>Nachricht:</h3>
<p>${message || 'Keine Nachricht'}</p>

<h3>Bilder:</h3>
${bilderHtml}

<hr>
<p><small>Diese Anfrage wurde über frankenautoankauf.de gesendet.</small></p>
    `.trim()


    const forwardToSheets = async () => {
      if (!SHEETS_WEBHOOK_URL) return
      try {
        const sheetsPayload = {
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

        await fetch(SHEETS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sheetsPayload),
        })
      } catch (err) {
        console.error('❌ Sheets webhook failed:', err)
      }
    }
    // Send via Web3Forms
    console.log('Sending to Web3Forms...')

    const requestBody = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: `Neue Anfrage: ${brand?.toUpperCase()} ${model} (${year})`,
      from_name: name || 'Website Besucher',
      replyto: email,
      message: emailContent,
      // Customer details as separate fields
      kunde_name: name,
      kunde_email: email,
      kunde_telefon: phone,
      kunde_standort: location,
      fahrzeug_marke: brand?.toUpperCase(),
      fahrzeug_modell: model,
      fahrzeug_baujahr: year,
      fahrzeug_km: mileage,
      fahrzeug_kraftstoff: fuel,
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
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    const result = await web3Response.json()
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
