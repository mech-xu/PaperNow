// PaperNow Supabase Edge Function
// Handles post-commit hooks, document ingestion, etc.

Deno.serve(async (_req: Request) => {
  const data = {
    message: 'PaperNow Edge Function',
    timestamp: new Date().toISOString(),
  }

  return Response.json(data)
})
