import { NextResponse } from 'next/server';

// Runs at the edge on every request — replaces the placeholder script
// with real env vars before the HTML reaches the browser.
// Keys are NEVER embedded in your source code or git history.

export const config = { matcher: '/' };

export default function middleware(request) {
  const url  = process.env.SUPABASE_URL  || '';
  const anon = process.env.SUPABASE_ANON || '';

  const response = NextResponse.next();

  // We use a TransformStream to find-and-replace the placeholder in the HTML body
  const { readable, writable } = new TransformStream({
    transform(chunk, controller) {
      let text = new TextDecoder().decode(chunk);
      text = text.replace(
        `window.__env = { SUPABASE_URL: '', SUPABASE_ANON: '' };`,
        `window.__env = { SUPABASE_URL: '${url}', SUPABASE_ANON: '${anon}' };`
      );
      controller.enqueue(new TextEncoder().encode(text));
    }
  });

  return new NextResponse(readable, response);
}
