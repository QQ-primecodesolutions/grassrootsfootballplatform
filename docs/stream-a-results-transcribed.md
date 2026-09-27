# Stream A results: transcribed from the organiser's matchday graphics (to verify)

**Status: unverified. NOT used by the seed.** This transcribes the results panels in
`docs/reference/`, so the organiser (or you) can confirm them before they go into
`scripts/seed/data/batho-pele-stream-a.ts`.

I cross-checked every round against the cumulative table printed on the next graphic.
Each set is consistent: GP, W, D, L, GF, GA and Pts all add up.

In each row the left-hand team is assumed to be the **home** side. The round 1 fixtures
graphic confirms this order for round 1.

| Rd | Date | Home | Score | Away | Source |
|---|---|---|---|---|---|
| 1 | 2026-06-07 | Tseki Junior Stars FC | 2–1 | Remember Matoota FC | results 1.jpg (+ fixture 1.jpg: Itlotliseng Sports Ground) |
| 1 | 2026-06-07 | Samba Boys FC | 0–1 | Tseki Galaxy FC | results 1.jpg (fixture 1.jpg lists Tseki Galaxy as home ⚠) |
| 1 | 2026-06-07 | Lere La Tshepe FC | 0–1 | Passion FC | results 1.jpg |
| 2 | 2026-06-20 | Samba Boys FC | 0–0 | Tseki Junior Stars FC | results 2.jpg |
| 2 | 2026-06-20 | Tseki Galaxy FC | 1–1 | Lere La Tshepe FC | results 2.jpg |
| 2 | 2026-06-20 | Remember Matoota FC | 4–3 | Passion FC | results 2.jpg |
| 3 | 2026-07-04 | Lere La Tshepe FC | 0–2 | Tseki Junior Stars FC | results 3.jpg: "Lere La Tshepe FC abandoned the match" ⚠ |
| 3 | 2026-07-04 | Remember Matoota FC | 2–1 | Samba Boys FC | results 3.jpg |
| 3 | 2026-07-04 | Passion FC | 2–0 | Tseki Galaxy FC | results 3.jpg |
| 4 | 2026-07-13 | Remember Matoota FC | 4–0 | Tseki Galaxy FC | results 4.png |
| 4 | 2026-07-13 | Tseki Junior Stars FC | 4–2 | Passion FC | results 4.png |
| 4 | 2026-07-13 | Lere La Tshepe FC | 1–1 | Samba Boys FC | results 4.png |
| 5 | ? | Tseki Junior Stars FC | 1–0 | Tseki Galaxy FC | **derived**, no graphic ⚠ |
| 5 | ? | Samba Boys FC | 3–0 | Passion FC | **derived**, no graphic ⚠ |
| 5 | ? | Lere La Tshepe FC | 2–1 | Remember Matoota FC | **derived**, no graphic ⚠ |
| 6 | 2026-08-08 | Remember Matoota FC | 1–1 | Tseki Junior Stars FC | results 6.png |
| 6 | 2026-08-08 | Samba Boys FC | 2–2 | Tseki Galaxy FC | results 6.png |
| 6 | 2026-08-08 | Passion FC | 2–1 | Lere La Tshepe FC | results 6.png |
| 7 | 2026-08-15 | Tseki Junior Stars FC | 2–1 | Samba Boys FC | results 7.png (seeded) |
| 7 | 2026-08-15 | Tseki Galaxy FC | 1–2 | Lere La Tshepe FC | results 7.png (seeded) |
| 7 | 2026-08-15 | Remember Matoota FC | 0–0 | Passion FC | results 7.png (seeded) |

## ⚠ Points to confirm with the organiser

1. **Round 5 has no graphic.** Its scores are *derived*: the only results that turn the
   13 July table into the 8 August table, given the round 6 results. The pairings are also
   the only ones left to complete the first round-robin, so the pairing and score of each
   match are certain. **The home/away order and the date are not.** Please get the real
   round 5 post before this goes into the seed.
2. **Round 3, Lere La Tshepe vs Tseki Junior Stars** is marked "abandoned the match" but
   counted as 0–2. I'd model it as `status = completed`, `outcome_type = awarded`, 0–2, with a
   note. Confirm that the 0–2 was awarded rather than the score when play stopped.
3. **Round 1 home/away for Samba Boys vs Tseki Galaxy** differs between the fixtures graphic
   (Galaxy home) and the results graphic (Samba first).
4. **The published tables' tie ordering doesn't follow GD → GF.** On 7 June, Remember Matoota
   (GD −1, GF 1) is placed below Samba Boys and Lere La Tshepe (GD −1, GF 0). On 20 June, Samba
   Boys (GF 0) is above Lere La Tshepe (GF 1), both on 1 pt and GD −1. The graphics also never
   show shared positions. The organiser may use a different tie-breaker (fewer goals conceded
   would fit both cases), or it may be ad hoc. Only the 15 Aug table is reconciled in tests, and
   it has no ties on points. Worth asking what tie-breakers they actually use.
5. **Branding differences.** The 7 June graphics are **blue**, and the fixture poster says
   "QWAQWA DEVELOPMENT LEAGUE **OPEN**", yet they show these same six teams. The 13 July
   competition logo reads "U13". Probably template slips. Worth confirming that all rounds
   belong to U19 Stream A.
6. The graphics show **more sponsors** than the four seeded (e.g. "Tsebella oa Sethaba Community
   Development", "Moteb Phuthe Funeral Assurance", a "7K"/"ZA" badge). Awaiting organiser
   confirmation, as agreed.
