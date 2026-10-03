# Open Stream A (Tseki) results: transcribed from the organiser's matchday graphics (to verify)

**Status (2026-10-03): released; loaded by `pnpm db:seed:stream-a-results`. Round 5 Samba Boys v Passion is pending (provisional) until the organiser confirms.** This transcribes the results panels in
`docs/reference/`, so the organiser (or you) can confirm them before they go into
`scripts/seed/data/batho-pele-stream-a.ts`.

I cross-checked every round against the cumulative table printed on the next graphic.
Each set is consistent: GP, W, D, L, GF, GA and Pts all add up.

In each row the left-hand team is assumed to be the **home** side. The round 1 fixtures
graphic confirms this order for round 1.

| Rd | Date | Home | Score | Away | Source |
|---|---|---|---|---|---|
| 1 | 2026-06-07 | Tseki Junior Stars FC | 2–1 | Remember Matoota FC | results 1.jpg (+ fixture 1.jpg: Itlotliseng Sports Ground) |
| 1 | 2026-06-07 | Samba Boys FC | 0–1 | Tseki Galaxy FC | results 1.jpg. Confirmed: the teams share a home ground, and Samba Boys were the home side ✓ |
| 1 | 2026-06-07 | Lere La Tshepe FC | 0–1 | Passion FC | results 1.jpg |
| 2 | 2026-06-20 | Samba Boys FC | 0–0 | Tseki Junior Stars FC | results 2.jpg |
| 2 | 2026-06-20 | Tseki Galaxy FC | 1–1 | Lere La Tshepe FC | results 2.jpg |
| 2 | 2026-06-20 | Remember Matoota FC | 4–3 | Passion FC | results 2.jpg |
| 3 | 2026-07-04 | Lere La Tshepe FC | 0–2 | Tseki Junior Stars FC | results 3.jpg. Confirmed: Lere La Tshepe abandoned the match, 0–2 **awarded** ✓ |
| 3 | 2026-07-04 | Remember Matoota FC | 2–1 | Samba Boys FC | results 3.jpg |
| 3 | 2026-07-04 | Passion FC | 2–0 | Tseki Galaxy FC | results 3.jpg |
| 4 | 2026-07-13 | Remember Matoota FC | 4–0 | Tseki Galaxy FC | results 4.png |
| 4 | 2026-07-13 | Tseki Junior Stars FC | 4–2 | Passion FC | results 4.png |
| 4 | 2026-07-13 | Lere La Tshepe FC | 1–1 | Samba Boys FC | results 4.png |
| 5 | 2026-07-25 | Tseki Galaxy FC | 0–1 | Tseki Junior Stars FC | QDL Facebook post, 25 July |
| 5 | 2026-07-25 | Samba Boys FC | **3–0 or 0–0?** | Passion FC | FB post (Samba score rendered as an emoji) ⚠ |
| 5 | 2026-07-25 | Remember Matoota FC | 1–2 | Lere La Tshepe FC | QDL Facebook post, 25 July |
| 6 | 2026-08-08 | Remember Matoota FC | 1–1 | Tseki Junior Stars FC | results 6.png |
| 6 | 2026-08-08 | Samba Boys FC | 2–2 | Tseki Galaxy FC | results 6.png |
| 6 | 2026-08-08 | Passion FC | 2–1 | Lere La Tshepe FC | results 6.png |
| 7 | 2026-08-15 | Tseki Junior Stars FC | 2–1 | Samba Boys FC | results 7.png (seeded) |
| 7 | 2026-08-15 | Tseki Galaxy FC | 1–2 | Lere La Tshepe FC | results 7.png (seeded) |
| 7 | 2026-08-15 | Remember Matoota FC | 0–0 | Passion FC | results 7.png (seeded) |

## ⚠ Points to confirm with the organiser

1. **Round 5, Samba Boys vs Passion FC: 0–0 or 3–0?** The QDL Facebook post of 25 July ("Senior Teams/Open")
   gives the home/away order and the other two scores, which match the derived values. It
   shows "Passion FC :0", but Samba Boys' score is an emoji, and the round has been reported
   as **0–0**. The organiser's own **8 August table only works with Samba 3–0 Passion**:
   - Samba goes from W0 D2 L2, 2–4 (13 Jul) to W1 D3 L2, 7–6 (8 Aug). Round 6 was 2–2, so
     round 5 must be a Samba win by 3–0.
   - Passion goes from 8–8 to 10–12 with one more win and one more loss. Round 6 was a 2–1 win,
     so round 5 must be a 0–3 loss.

   Facebook converts a typed ":3" into its "colon-three" emoticon, which likely explains the
   emoji. A 0–0 would put Samba on 5 pts with W0 D4, contradicting the 8 Aug and 15 Aug tables.
   **Needs the organiser's confirmation.**
2. ~~Round 3~~ **Resolved:** 0–2 was awarded (`outcome_type = awarded`, with a note).
3. ~~Round 1 home/away~~ **Resolved:** the teams share a home ground; Samba Boys were the home side.
4. **The published tables' tie ordering doesn't follow GD → GF.** On 7 June, Remember Matoota
   (GD −1, GF 1) is placed below Samba Boys and Lere La Tshepe (GD −1, GF 0). On 20 June, Samba
   Boys (GF 0) is above Lere La Tshepe (GF 1), both on 1 pt and GD −1. The graphics also never
   show shared positions. The organiser may use a different tie-breaker (fewer goals conceded
   would fit both cases), or it may be ad hoc. Only the 15 Aug table is reconciled in tests, and
   it has no ties on points. Worth asking what tie-breakers they actually use.
5. ~~Branding differences~~ **Resolved:** these are QDL's **Open/Senior** teams, run by Batho
   Pele. So the "OPEN" fixture poster is correct, and "U19" is part of the parent body's name.
   The 7 June graphics being blue, and the "U13" on the 13 July logo, look like template slips.
6. The graphics show **more sponsors** than the four seeded (e.g. "Tsebella oa Sethaba Community
   Development", "Moteb Phuthe Funeral Assurance", a "7K"/"ZA" badge). Awaiting organiser
   confirmation, as agreed.

## Stream B (Phuthaditjhaba): known so far, not seeded

From the same 25 July post (round unknown):

| Date | Home | Score | Away |
|---|---|---|---|
| 2026-07-25 | Junior Stars | 2–2 | Dynamos FC |
| 2026-07-25 | Botjhabela United | 3–2 | International FC |

Needed before seeding: the full team list, official names (with or without "FC"), the
format, all results so far, and any published table to reconcile against.
