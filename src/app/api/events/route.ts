export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Forward the readable stream itself rather than a buffered rewrite response.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const port = process.env.ROOM_BACKEND_PORT || process.env.BACKEND_PORT || '4318';
  const upstream = new URL(`http://127.0.0.1:${port}/api/events`);
  upstream.searchParams.set('token', url.searchParams.get('token') || '');
  try {
    const response = await fetch(upstream, {
      cache: 'no-store', signal: request.signal, headers: {'Accept': 'text/event-stream', 'Accept-Encoding': 'identity'},
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-cache, no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return Response.json({error:'Koneksi streaming terputus. Aplikasi akan menyambungkan ulang.'},{status:502});
  }
}
