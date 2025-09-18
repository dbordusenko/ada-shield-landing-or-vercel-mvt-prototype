import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import axe from 'axe-core'; // For WCAG scans (client-side or puppeteer for full)

export async function POST(request: Request) {
  const { url, userId } = await request.json();
  // Run scan (simplified; use puppeteer for real browser scan)
  const results = await axe.run(url); // Mock or integrate real scan
  await sql`INSERT INTO scans (user_id, url, results) VALUES (${userId}, ${url}, ${JSON.stringify(results)});`;
  return NextResponse.json({ results });
}
