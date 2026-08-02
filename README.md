# ISPS Checklist Reviewer — Standalone SSP Review

A single-file web app that reads a vessel's **Ship Security Plan (SSP, PDF)** — and the **SSA** when it is a separate document — maps the plan's structure, cross-references every ISPS Code requirement in the **MSC-CKS-00009 Rev 3 checklist** against the plan's own text, and returns:

1. the **completed checklist (.docx)** — Yes / No / N/A ticked, with the located SSP/SSA section and page in the *SSP Doc Reference* column and a documented basis for every "No", and
2. a **Gaps & Observations summary (.docx)** — the flagged gaps, N/A items with reasons, and the review tallies.

**Fully standalone:** everything runs inside the browser. No account, no API key, no billing, no server — the plan never leaves the device. The only network use is the first-load CDN libraries (pdf.js, JSZip, fonts); after that it works offline.

---

## Files

| File | What it is |
|---|---|
| `index.html` | The entire app, **with the blank MSC-CKS-00009 Rev 3 checklist embedded inside it**. Deploy this single file. |
| `README.md` | This file. |

At run time the user uploads:
1. the vessel's **SSP** as a text-based PDF (required) — uploading **only** the SSP means the SSA is included inside it;
2. the **SSA** as a separate PDF (optional) — uploading it means the SSP does **not** include the SSA;
3. the **Flag State Special Instructions (FSSI)** as a PDF (optional) — each detected FSSI topic is cross-checked against the SSP (indicative) and untraceable topics are listed as open items;
4. the **CSP / other requirement documents** as a PDF (optional) — with SEC notation = Yes, the SEC-section items are referenced from this document with exact section and page.

The *SSP Doc Reference* cell on the form shows **only the matched procedure reference and its page, on two lines** (e.g. `SSP §4.4 Access Watch & Pass System` / `p.41`, with a short `verify` flag on partially-addressed items); items that cannot be located show `Not Evident` / `required: §…`. Full rationales and secondary locations live in the summary report and the on-screen findings.

Section 1 (SSA & On-Scene Survey) references are taken **only from the SSA** — the separate document when uploaded, otherwise the SSA part detected inside the SSP. Section 2 (SSP) references are taken **only from the SSP**. The **Vessel Name and Class ID header fields are left empty** for the auditor to fill in.

---

## How the review works

### 1. Structure mapping
The PDF is extracted page by page and headings are detected (SECTION / CHAPTER / PART / APPENDIX / ANNEX, plus numbered headings like `2.10 Records`). Table-of-contents duplicates are superseded by body headings, so every entry carries the real page number. The document map is shown in the results panel.

### 2. Meaning-oriented, chapter-exact cross-reference
For every checklist item the engine builds a set of required **concepts** — the question's distinctive terms expanded through a maritime-security synonym dictionary (CCTV ↔ surveillance ↔ camera ↔ patrol, DoS ↔ Declaration of Security, gangway ↔ accommodation ladder ↔ brow, x-ray ↔ screening, stores ↔ provisions, …) with light stemming — then:

1. locates the **exact chapter** whose page range covers the most required concepts and judges the item *inside* that chapter;
2. checks **security-level context**: an item about level 1/2/3 measures is only a full Yes when the cited chapter actually refers to that level (otherwise "Partially addressed — level-N context not confirmed");
3. checks **co-occurrence**: concepts must appear together as a provision (within a few lines), not scattered across the plan — otherwise "terms dispersed — verify";
4. rejects **isolated traces**: a single stray word among many required concepts is treated as Not Evident, not a match.

The review follows the ISPS desktop-review workflow (desktop assessment prior to the initial audit) and records each item using the workflow vocabulary:

- **Yes** — evidence located with good coverage; the real location is cited (nearest detected heading plus page, e.g. `SSP §4.4 Access Watch & Pass System, p.41`).
- **Partially Addressed** — located but weak coverage; ticked Yes on the form with a "Partially addressed — reviewer to verify" comment.
- **Not Evident** — no provision located; ticked No* on the form with the basis *"…amendment or supporting evidence required (expected at §…)"* — these are the open items requiring company response.
- **No** — the plan conflicts with the requirement (e.g. the 5-year records item under SEC) — a deficiency/nonconformity with its basis recorded.
- **N/A** — fixed applicability rules (ro-ro/vehicle items, electronic-SSP items, SEC section when not requested) with a reason.

The app also performs the workflow's steps 1–3 automatically and reports them in a **Review basis & document control** block: PDF-format confirmation, revision status / revision history / controlled-copy markings / electronic-protection detection, review-language detection (English preferred), an FSSI "reviewer to confirm" note, and the CSO/SSO training-evidence reminder per A/13.1. Optional **review details** (reviewer, date, report/WO number, flag, company) flow into the summary, which ends with a **suggested review outcome** (acceptable / acceptable subject to amendment / not acceptable — reviewer to confirm) and the step-10 completion reminders (SSPRL / SSPARL Full Term letters, import into the work order, stamping per ABS instructions).

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
- The checklist form embedded in the app is MSC-CKS-00009 Rev 3 (editable form fields are preserved in the output). To swap in a new revision, re-embed its base64 in `CHECKLIST_B64` inside `index.html`.
- The engine approximates meaning (synonyms, chapter scoping, level context, co-occurrence) but it is still not a human reviewer: "Partially addressed" and "Not Evident" flags are the "go check this" list, not final findings, and a full Yes still deserves a read of the cited chapter.
