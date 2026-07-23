# ISPS Checklist Reviewer — Substantive SSP Review

A single-file web app that reads a vessel's **Ship Security Plan (SSP, PDF)** — and the **SSA** when it is a separate document — maps the plan's structure, reviews every ISPS Code requirement in the **MSC-CKS-00009 Rev 3 checklist** substantively, and returns:

1. the **completed checklist (.docx)** — Yes / No / N/A ticked, with the specific SSP/SSA chapter/section/page in the *SSP Doc Reference* column and a documented basis appended to every "No" (as the checklist footnote requires), and
2. a **Gaps & Observations summary (.docx)** — overall impression, each "No" with its basis, N/A items with reasons, and recommendations for the auditor.

Everything runs **in the browser**. The plan is parsed locally; when a Claude API key is provided, the review itself is performed by the Anthropic API (the plan text is sent only to `api.anthropic.com`). Supabase is optional and only used to archive the outputs.

---

## Files

| File | What it is |
|---|---|
| `index.html` | The entire app. Deploy this. |
| `MSC-CKS-00009_Rev_3_Editable_2.docx` | The blank editable checklist (uploaded through the page at run time). |
| `README.md` | This file. |

At run time the page needs:
1. the vessel's **SSP** as a text-based PDF (required),
2. the **blank editable checklist** `.docx` (required),
3. the **SSA** as a separate PDF (optional — only when it is not an appendix of the SSP).

---

## How the review works

### 1. Structure mapping
The PDF is extracted page by page and headings are detected (SECTION / CHAPTER / PART / APPENDIX / ANNEX, plus numbered headings like `2.10 Records`). Table-of-contents duplicates are superseded by the body headings, so every entry carries the real page number. The resulting document map is shown in the results panel and given to the model as an outline.

### 2. Substantive item-by-item review (AI mode)
With an **Anthropic API key** entered in the *Analysis engine* panel, the app sends the full plan text (with page markers) as cached context and reviews the checklist in batches of 50 items (~7 API calls total). For each item the model must:

- locate and read the plan provision(s) that respond to the ISPS requirement — matching words alone are not accepted; measures must be **real, ship-specific and workable** (e.g. security level 2 access-control measures must be concrete measures for *this* ship, not boilerplate restating the Code);
- answer **Yes** only when the intent of the provision is genuinely implemented;
- answer **No** when the requirement is omitted, contradicted, or covered only by boilerplate — always with a **rationale**, which is written into the reference cell (`… — NO: <basis>`) so the documented basis required by the checklist footnote travels with the form;
- answer **N/A** only when the requirement genuinely does not apply to the vessel/operations, with a brief reason;
- cite the **chapter/section + page** it relied on (e.g. `SSP §4.4 Access Watch & Pass System, p.41`), or `Not found in SSP`.

The default model is **Claude Opus 4.8** (most thorough); **Claude Sonnet 5** is available as a faster option. Requests use adaptive thinking, structured JSON output, streaming, and 1-hour prompt caching of the plan text so subsequent batches are cheap. The key can optionally be remembered in `localStorage` on the device.

### 3. Keyword fallback (no API key)
Without a key the app falls back to the original keyword cross-reference table (enriched with detected page numbers). This locates the *likely* section for each requirement but does **not** judge substance — the result panel and summary are labelled accordingly and the auditor must verify manually.

### 4. SEC notation — explicit confirmation
The "Additional Requirements for **SEC** Notation" section also requires the **Company Security Plan (CSP)**, so the app **forces an explicit Yes/No answer** before a review can run:

- **No** — every item in that section is set to N/A and its *SSP Doc Reference* cell is written as **"NA"**.
- **Yes** — those items are assessed against the provided documents; if the CSP itself is not among them, the model says so in the rationale (e.g. the record-retention item: SSP retains records 2 years where ABS Guide 4/6.2(e) requires 5 → "No" with basis).

### 5. Outputs
- `"<Vessel>_ISPS_Checklist_Completed.docx"` — the same MSC-CKS-00009 form, filled in place (checkbox and text form fields keep their names, so the output stays editable).
- `"<Vessel>_ISPS_Review_Summary.docx"` — the gaps & observations summary (also shown on screen, together with the "No" findings, the N/A list and the document map).

---

## Deploy on GitHub Pages (free)

1. Create a repository and upload `index.html` to the root.
2. **Settings → Pages** → *Deploy from a branch* → `main` / root → Save.
3. The app is live at `https://<user>.github.io/<repo>/` about a minute later.

To run locally, serve the folder (e.g. `python -m http.server 8741`) and open `http://localhost:8741` — opening the file directly with `file://` also works for the UI, but a local server is more reliable.

---

## Optional: Supabase archive

Same as before: create a public bucket `isps-files`, set `SUPABASE_URL` / `SUPABASE_ANON_KEY` at the top of the script, and (optionally) create the `isps_audits` table:

```sql
create table if not exists isps_audits (
  id            bigint generated always as identity primary key,
  created_at    timestamptz default now(),
  vessel_name   text,
  class_id      text,
  sec_notation  boolean,
  yes_count     int,
  no_count      int,
  na_count      int,
  ssp_path         text,
  checklist_path   text,
  checklist_url    text
);
alter table isps_audits enable row level security;
create policy "anon insert" on isps_audits for insert to anon with check (true);
create policy "anon upload" on storage.objects for insert to anon with check (bucket_id = 'isps-files');
```

Each run then archives the SSP, the completed checklist **and the summary** to `isps-files/<vessel>/…` and logs a row.

> The anon key is public by design; for production put the app behind Supabase Auth.

---

## Notes / limits

- PDF text extraction needs a **text-based** SSP (not a scanned image). Scanned plans need OCR first — the app detects this and refuses with a clear message.
- The checklist template must be the MSC-CKS-00009 editable form (its form fields carry the `txt####` / `chk####` names the app targets).
- AI review cost: ~7 calls per run with the full plan as context; prompt caching keeps repeat batches at ~10 % of the input price. A typical 80-page SSP reviews for a few dollars on Opus 4.8.
- The AI's answers are a **draft for the auditor**: every "No" must still be closed out with the company's documented evidence per the checklist footnote, and the auditor signs the form.
- No server is required. Works without the optional Supabase backup; the first load needs the CDN libraries (pdf.js, JSZip, supabase-js, Google Fonts).
