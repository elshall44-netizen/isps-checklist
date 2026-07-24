# ISPS Checklist Reviewer — Standalone SSP Review

A single-file web app that reads a vessel's **Ship Security Plan (SSP, PDF)** — and the **SSA** when it is a separate document — maps the plan's structure, cross-references every ISPS Code requirement in the **MSC-CKS-00009 Rev 3 checklist** against the plan's own text, and returns:

1. the **completed checklist (.docx)** — Yes / No / N/A ticked, with the located SSP/SSA section and page in the *SSP Doc Reference* column and a documented basis for every "No", and
2. a **Gaps & Observations summary (.docx)** — the flagged gaps, N/A items with reasons, and the review tallies.

**Fully standalone:** everything runs inside the browser. No account, no API key, no billing, no server — the plan never leaves the device. The only network use is the first-load CDN libraries (pdf.js, JSZip, fonts); after that it works offline.

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
The PDF is extracted page by page and headings are detected (SECTION / CHAPTER / PART / APPENDIX / ANNEX, plus numbered headings like `2.10 Records`). Table-of-contents duplicates are superseded by body headings, so every entry carries the real page number. The document map is shown in the results panel.

### 2. Evidence-based cross-reference
For every checklist item the engine extracts the question's distinctive terms and searches the actual plan text for them:

- **Found with good coverage** → **Yes**, with the real location where the evidence sits — nearest detected heading plus page, e.g. `SSP §4.4 Access Watch & Pass System, p.41`.
- **Found only partially** → **Yes** with the location suffixed **"— verify"**, telling the auditor to confirm that section really implements the requirement.
- **Not found at all** → **No**, with the basis written into the reference cell: *"no provision matching this requirement was found in the document text — verify manually (expected at §…)"*. Gaps surface as findings instead of being silently ticked Yes.
- Fixed applicability rules handle known cases (ro-ro/vehicle items, electronic-SSP items, the 5-year records item, etc.) as **N/A** or **No** with a reason.
- SSA / on-scene-survey items are searched in the separate SSA document when one is uploaded.

**Honest limitation:** a text search can confirm *where* a topic is treated and expose topics that are *absent*, but it cannot judge whether the written measures are substantively adequate and ship-specific. Every output is labelled accordingly — the checklist is a documented draft; the auditor confirms substance against the plan and signs.

### 3. SEC notation — explicit confirmation
The "Additional Requirements for **SEC** Notation" section also requires the **Company Security Plan (CSP)**, so the app **forces an explicit Yes/No answer** before a review can run:

- **No** — every item in that section is set to N/A and its *SSP Doc Reference* cell is written as **"NA"**.
- **Yes** — those items are cross-referenced too; the CSP-specific ones are flagged for the company to supply the CSP.

### 4. Outputs
- `"<Vessel>_ISPS_Checklist_Completed.docx"` — the same MSC-CKS-00009 form, filled in place (all form fields keep their names, so the output stays editable).
- `"<Vessel>_ISPS_Review_Summary.docx"` — gaps & observations (also shown on screen with the "No" findings, N/A list and document map).

Per the checklist footnote, every "No" must be closed out with the company's documented evidence, attached with the auditor's acceptance.

---

## Deploy on GitHub Pages (free)

1. Upload `index.html` to a repository.
2. **Settings → Pages** → *Deploy from a branch* → `main` / root → Save (or keep the included `.github/workflows/pages.yml`, which deploys automatically on every push).
3. Live at `https://<user>.github.io/<repo>/` about a minute later.

To run locally, serve the folder (e.g. `python -m http.server 8741`) and open `http://localhost:8741`.

---

## Optional: Supabase archive

Create a public bucket `isps-files`, set `SUPABASE_URL` / `SUPABASE_ANON_KEY` at the top of the script, and (optionally) create the `isps_audits` table:

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

Each run then archives the SSP, the completed checklist and the summary to `isps-files/<vessel>/…` and logs a row.

---

## Notes / limits

- PDF text extraction needs a **text-based** SSP (not a scanned image). Scanned plans need OCR first — the app detects this and refuses with a clear message.
- The checklist template must be the MSC-CKS-00009 editable form (its form fields carry the `txt####` / `chk####` names the app targets).
- The engine matches text, not meaning: expect some flagged items on plans that use unusual wording — those flags are the "go check this" list, not final findings.
