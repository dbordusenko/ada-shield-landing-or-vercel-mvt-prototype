import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chrome from 'chrome-aws-lambda';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

export async function POST(request: Request) {
  try {
    const { url, userId } = await request.json();
    const browser = await chrome.puppeteer.launch({
      executablePath: await chrome.executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const results = await page.evaluate(() => {
      const axe = require('axe-core');
      return axe.run(document);
    });
    await browser.close();
    await supabase.from('scans').insert([{ user_id: userId, url, results }]);
    await supabase.from('audit_logs').insert([{ user_id: userId, action: 'scan', details: `Scanned ${url}` }]);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}