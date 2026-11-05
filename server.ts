import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import firebaseConfig from './firebase-applet-config.json';
import express from "express";
import path from "path";
import 'dotenv/config';
import { safeRemoteFetch, validatePublicUrl } from './src/lib/safeRemote';
import { extractJobDataFromUrl, extractJobDataFromText } from "./src/lib/serverJobExtractor";

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const rateWindows = new Map<string, { count: number; until: number }>();
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    const key = req.ip || 'unknown'; const now = Date.now();
    let rate = rateWindows.get(key);
    if (!rate || rate.until < now) { rate = { count: 0, until: now + 60000 }; rateWindows.set(key, rate); }
    if (rateWindows.size > 2000) { for (const [id, entry] of rateWindows) if (entry.until < now) rateWindows.delete(id); if (rateWindows.size > 2000) rateWindows.delete(rateWindows.keys().next().value!); }
    if (++rate.count > 60) { res.setHeader('Retry-After', '60'); return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' }); }
    next();
  });
  const verifyAccount = async (req: express.Request) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) return false;
    try {
      const url = process.env.VITE_SUPABASE_URL;
      const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (url && key) {
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await client.auth.getUser(token);
        return !error && Boolean(data.user?.email_confirmed_at);
      }
      const admin = getApps().find(app => app.name === 'organizer-verifier') || initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId }, 'organizer-verifier');
      const identity = await getAuth(admin).verifyIdToken(token);
      return identity.firebase.sign_in_provider !== 'anonymous';
    } catch { return false; }
  };
  // API routes FIRST
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", product: "huntrr.organizer", integrations: { gemini: Boolean(process.env.GEMINI_API_KEY) } });
  });

  app.delete('/api/account', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key || !secret) return res.status(503).json({ error: 'Account deletion is not configured.' });
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    const password = req.body?.password;
    if (!token || typeof password !== 'string' || !password || password.length > 1024) {
      return res.status(401).json({ error: 'Sign in again and confirm your current password.' });
    }
    const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
    try {
      const client = createClient(url, key, authOptions);
      const { data } = await client.auth.getUser(token);
      const user = data.user;
      if (!user?.email || !user.email_confirmed_at) return res.status(401).json({ error: 'Sign in again.' });
      const verified = await client.auth.signInWithPassword({ email: user.email, password });
      if (verified.error || verified.data.user?.id !== user.id) {
        return res.status(401).json({ error: 'The current password could not be verified.' });
      }
      const admin = createClient(url, secret, authOptions);
      const bucket = admin.storage.from('planner-files');
      // Remove private objects before Auth deletes the owner and cascades database records.
      for (;;) {
        const files = await bucket.list(user.id, { limit: 100 });
        if (files.error) throw files.error;
        if (!files.data.length) break;
        const removed = await bucket.remove(files.data.map(file => user.id + '/' + file.name));
        if (removed.error || !removed.data?.length) throw new Error('Attachment cleanup failed.');
      }
      const deleted = await admin.auth.admin.deleteUser(user.id);
      if (deleted.error) throw deleted.error;
      return res.status(204).end();
    } catch {
      return res.status(502).json({ error: 'Deletion could not be completed. Retry to finish removing the account.' });
    }
  });

  // Extract job details from Indeed, LinkedIn, or career listing links
  app.post("/api/extract-job-url", async (req, res) => {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== "string" || !url.trim()) {
        return res.status(400).json({ 
          success: false, 
          error: "A valid job URL or partial link is required." 
        });
      }

      await validatePublicUrl(url.startsWith("http") ? url : `https://${url}`);
      const extracted = await extractJobDataFromUrl(url, await verifyAccount(req));
      return res.json(extracted);
    } catch (err: any) {
      console.error("[/api/extract-job-url] Server Error:", err?.stack || err);
      return res.json({
        success: false,
        warning: "This website blocked automatic importing. You can still add the application manually.",
        originalUrl: req.body?.url || "",
        link: req.body?.url || "",
      });
    }
  });

  // Extract structured job fields from pasted job description text using Gemini AI
  app.post("/api/extract-job-text", async (req, res) => {
    try {
      const { text, originalUrl } = req.body || {};
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({
          success: false,
          error: "Please provide job description text to analyze."
        });
      }

      if (!process.env.GEMINI_API_KEY) return res.status(503).json({ success: false, error: 'AI import is not configured. Enter the job details manually, or configure GEMINI_API_KEY on the server.' });
      if (!process.env.GEMINI_MODEL) return res.status(503).json({ success: false, error: 'Configure GEMINI_MODEL on the server to enable AI import.' });
      if (!await verifyAccount(req)) return res.status(401).json({ success: false, error: 'Sign in with Google to use AI import. Manual job entry is available in the local workspace.' });
      const extracted = await extractJobDataFromText(text, originalUrl);
      return res.json(extracted);
    } catch (err: any) {
      console.error("[/api/extract-job-text] Server Error:", err?.stack || err);
      return res.json({
        success: false,
        warning: "We couldn't automatically read all listing details, but you can still enter the details and save it manually.",
      });
    }
  });

  app.post("/api/pinterest/process", async (req, res) => {
    try {
      const { url, title } = req.body || {};
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      let boardTitle = title || "Pinterest Board";
      let pins: Array<{ id: string; title: string; description: string; imageUrl: string; linkUrl: string }> = [];

      let targetUrl = url.trim();
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = "https://" + targetUrl;
      }

      const pinterestHost = new URL(targetUrl).hostname;
      if (!/(^|\.)pinterest\.com$/.test(pinterestHost)) return res.status(400).json({ error: 'Enter a public pinterest.com board URL.' });
      try {
        let rssUrl = targetUrl;
        if (!rssUrl.endsWith(".rss")) {
          rssUrl = rssUrl.replace(/\/$/, "") + ".rss";
        }

        const response = await safeRemoteFetch(rssUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        if (response.ok) {
          const xmlText = await response.text();
          const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
          let match;
          let count = 0;

          const channelTitleMatch = xmlText.match(/<title>([^<]+)<\/title>/i);
          if (channelTitleMatch && channelTitleMatch[1]) {
            const cleanTitle = channelTitleMatch[1].replace(/Pinterest/gi, "").trim();
            if (cleanTitle) boardTitle = cleanTitle;
          }

          while ((match = itemRegex.exec(xmlText)) !== null && count < 30) {
            const itemContent = match[1];
            const pinTitle = (itemContent.match(/<title>([^<]+)<\/title>/i)?.[1] || "Pinterest Pin").replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
            const pinLink = itemContent.match(/<link>([^<]+)<\/link>/i)?.[1] || targetUrl;
            const pinDesc = (itemContent.match(/<description>([^<]+)<\/description>/i)?.[1] || "").replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');

            let imgUrl = itemContent.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1];
            if (!imgUrl) {
              imgUrl = pinDesc.match(/src=["']([^"']+)["']/i)?.[1];
            }

            if (imgUrl) {
              const cleanDesc = pinDesc.replace(/<[^>]+>/g, "").trim();
              pins.push({
                id: `pin-${Date.now()}-${count}`,
                title: pinTitle,
                description: cleanDesc,
                imageUrl: imgUrl,
                linkUrl: pinLink
              });
              count++;
            }
          }
        }
      } catch (e) {
        console.warn("Pinterest RSS fetch failed:", e);
      }

      if (pins.length === 0) {
        try {
          const pathParts = new URL(targetUrl).pathname.split("/").filter(Boolean);
          if (pathParts.length >= 1 && !title) {
            const boardSlug = pathParts[pathParts.length - 1];
            boardTitle = boardSlug
              .split("-")
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
          }
        } catch (_) {}

        return res.status(422).json({ success: false, error: 'No public pins could be read from this Pinterest board. Pinterest may require sign-in or block feed access. Add a board and upload reference images manually.' });
      }

      return res.json({
        success: true,
        title: boardTitle,
        url: targetUrl,
        pins
      });
    } catch (err: any) {
      console.error("Error processing Pinterest board:", err);
      return res.status(500).json({ error: err?.message || "Failed to process Pinterest board" });
    }
  });

  // Google Drive Backup via secure backend endpoint
  app.post("/api/drive/backup", async (req, res) => {
    try {
      const { section, filename, mimeType, base64Data, accessToken } = req.body || {};
      if (!accessToken) {
        return res.status(200).json({ success: false, driveFileId: null, warning: "No Google token provided" });
      }

      const mainFolderName = "Huntrr Planner Photo Backup";
      const sectionFolderName = section ? (section.charAt(0).toUpperCase() + section.slice(1)) : "Other";

      // Helper to find or create folder in Google Drive
      const getOrCreateFolder = async (folderName: string, parentId?: string) => {
        let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
        if (parentId) q += ` and '${parentId}' in parents`;
        else q += ` and 'root' in parents`;

        const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const checkData = await checkRes.json();
        if (checkData.files && checkData.files.length > 0) {
          return checkData.files[0].id;
        }

        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : [],
          }),
        });
        const createData = await createRes.json();
        return createData.id;
      };

      const rootFolderId = await getOrCreateFolder(mainFolderName);
      const subFolderId = await getOrCreateFolder(sectionFolderName, rootFolderId);

      // Upload file
      const cleanFileName = filename || `photo_${Date.now()}.jpg`;
      const type = mimeType || 'image/jpeg';
      const buffer = Buffer.from(base64Data, 'base64');

      const boundary = '-------314159265358979323846';
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const metadata = {
        name: cleanFileName,
        parents: [subFolderId]
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + type + '\r\n\r\n';

      const part1 = Buffer.from(multipartRequestBody, 'utf-8');
      const part2 = buffer;
      const part3 = Buffer.from(close_delim, 'utf-8');

      const fullBody = Buffer.concat([part1, part2, part3]);

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: fullBody,
      });

      const uploadData = await uploadRes.json();
      if (uploadData.id) {
        return res.json({ success: true, driveFileId: uploadData.id });
      }
      return res.json({ success: false, driveFileId: null, warning: uploadData.error?.message || "Drive upload failed" });
    } catch (err: any) {
      console.warn("Drive backup backend warning:", err?.message || err);
      return res.json({ success: false, driveFileId: null, warning: err?.message || "Drive backup exception" });
    }
  });

  // Google Drive Restore Endpoint
  app.post("/api/drive/restore", async (req, res) => {
    try {
      const { driveFileId, accessToken } = req.body || {};
      if (!driveFileId || !accessToken) {
        return res.status(400).json({ error: "Missing driveFileId or accessToken" });
      }

      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!fileRes.ok) {
        return res.status(404).json({ error: "Drive file not found or inaccessible" });
      }

      const mimeType = fileRes.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await fileRes.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString("base64");

      return res.json({ success: true, base64Data, mimeType });
    } catch (err: any) {
      console.error("Error restoring from Drive:", err);
      return res.status(500).json({ error: err?.message || "Failed to restore from Drive" });
    }
  });

  // Google Sheets proxy fetch endpoint
  app.post("/api/sheets/fetch", async (req, res) => {
    try {
      const { spreadsheetId, accessToken } = req.body || {};
      if (!spreadsheetId || !accessToken) {
        return res.status(400).json({ error: "Missing spreadsheetId or accessToken" });
      }

      // Fetch metadata to discover sheets
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!metaRes.ok) {
        const errorData = await metaRes.json().catch(() => ({}));
        return res.status(metaRes.status).json({
          error: errorData.error?.message || `Google Sheets API returned status ${metaRes.status}`
        });
      }

      const meta = await metaRes.json();
      const sheetsList: { properties: { title: string } }[] = meta.sheets || [];

      const sheetsData: Record<string, any[][]> = {};

      for (const s of sheetsList) {
        const title = s.properties.title;
        const valRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(title)}?valueRenderOption=UNFORMATTED_VALUE`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (valRes.ok) {
          const valData = await valRes.json();
          sheetsData[title] = valData.values || [];
        }
      }

      return res.json({ success: true, sheets: sheetsData, sheetTitles: Object.keys(sheetsData) });
    } catch (err: any) {
      console.error("Error fetching Google Sheets:", err);
      return res.status(500).json({ error: err?.message || "Failed to fetch spreadsheet data" });
    }
  });

  app.get('/api/makerworld-preview', async (req, res) => {
    try {
      const url = new URL(String(req.query.url || ''));
      if (url.protocol !== 'https:' || !/(^|\.)makerworld\.com$/.test(url.hostname)) return res.status(400).json({ error: 'Enter an HTTPS MakerWorld model URL.' });
      const response = await safeRemoteFetch(url.href);
      if (!response.ok) return res.status(502).json({ error: 'MakerWorld blocked the preview. You can still enter the model manually.' });
      const html = await response.text();
      const meta = (name: string) => html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1] || '';
      return res.json({ title: meta('og:title'), imageUrl: meta('og:image'), description: meta('og:description') });
    } catch { return res.status(400).json({ error: 'The model preview could not be loaded. Enter its details manually.' }); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'This upload is too large (maximum 10 MB).' : 'The request could not be read. Check the submitted fields.' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'public');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
