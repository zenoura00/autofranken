"use client"

export type LeadSource = {
  source_url: string
  source_path: string
  click_source: string
  ts: number
}

const KEY = "faa_lead_source"

export function setLeadSource(click_source: string) {
  if (typeof window === "undefined") return
  const data: LeadSource = {
    source_url: window.location.href,
    source_path: window.location.pathname,
    click_source,
    ts: Date.now(),
  }
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

export function getLeadSource(): LeadSource | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LeadSource
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

export function clearLeadSource() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

type GtagFn = (command: "event", eventName: string, params?: Record<string, unknown>) => void

export function gtagEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag
  if (typeof gtag === "function") {
    gtag("event", eventName, {
      ...params,
      page_path: window.location.pathname,
    })
  }
}
