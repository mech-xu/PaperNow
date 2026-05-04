// Cloudflare Pages Function: SPA fallback
// Catches all non-static-asset routes and serves index.html with 200 status
// This ensures Vue Router can handle client-side routing on page refresh

export async function onRequest(context: any) {
  const url = new URL(context.request.url)
  const pathname = url.pathname

  // Skip static assets - let Cloudflare Pages serve them directly
  if (pathname.startsWith('/assets/') ||
      pathname.startsWith('/static/') ||
      pathname.match(/\.\w+$/)) {
    return context.env.ASSETS.fetch(context.request)
  }

  // Serve index.html for all SPA routes
  // The SPA will handle URL normalization client-side
  const response = await context.env.ASSETS.fetch(new Request(new URL('/', url.origin).href))

  // Inject a script to fix Cloudflare Pages trailing-slash normalization
  // Cloudflare Pages redirects /pages/search/index -> /pages/search/ (308)
  // UniApp expects /pages/search/index. This script fixes the URL before Vue Router boots.
  const html = await response.text()
  const fixScript = `<script>if(location.pathname.endsWith('/')&&location.pathname!=='/'){history.replaceState(null,'',location.pathname+'index'+location.search+location.hash)}</script>`
  const fixedHtml = html.replace('<head>', '<head>' + fixScript)

  return new Response(fixedHtml, {
    headers: response.headers,
  })
}
