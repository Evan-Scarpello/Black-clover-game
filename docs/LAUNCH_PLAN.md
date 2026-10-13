# Launch plan: getting Grimoire Squads onto the App Store, Google Play and Amazon

> Researched on **13 October 2026**. Each fact that was checked has a source link right after it. Anything marked **(estimate)** was not verified and is a planning number or a judgement call. This plan is not legal advice. Have a games or IP lawyer review anything in Phase 1 and Phase 3 before you spend money on it.

## TL;DR

1. **The IP decides everything.** Black Clover belongs to Yūki Tabata and Shueisha. Apple and Google both reject apps that use someone else's characters without a license ([Apple 5.2.1](https://developer.apple.com/app-store/review/guidelines/#intellectual-property), [Google Play IP policy](https://support.google.com/googleplay/android-developer/answer/9888072?hl=en)). You can't ship this build to a store as it is.
2. **Two realistic paths:** **(A)** pitch a licensed version to a publisher that can get the rights, or **(B)** re-skin into an original world and keep every system. **Do B now and keep A open as upside.** The roster is data plus parametric SVG specs, so a re-skin is mostly a content job. Shueisha's own games company takes [pitches of original games](https://shueisha-games.com/en/pitch), which gives you a way in without a licence.
3. **The store plumbing is cheap and well documented.** Apple costs $99 a year ([Apple](https://developer.apple.com/programs/enroll/)). Google Play is a one-time $25 ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)) plus a 14-day, 12-tester closed test for new personal accounts ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). Amazon is free, but it now only matters for Fire OS tablets and Fire TV ([Amazon](https://developer.amazon.com/apps-and-games/blogs/2025/02/upcoming-changes-to-amazon-appstore-for-android-devices-and-coins-program)).
4. **The real engineering work is the backend.** In the store build, gems, summons, PvP and clans can't stay client-side or on the claude.ai artifact database. You need accounts, a server-side economy, receipt validation, server-checked battles and moderated chat.
5. **Gacha compliance is a design task, not a footnote.** That means odds disclosure (Apple, Google, China, Korea), age gates and parental consent (FTC v. HoYoverse, Brazil, Australia), and no "complete the set" rewards (Japan).

---

## Contents

- [Phase map](#phase-map)
- [Phase 1: The big blocker (IP)](#phase-1-the-big-blocker-ip)
- [Phase 2: Accounts and fees](#phase-2-accounts-and-fees)
- [Phase 3: Monetization and compliance](#phase-3-monetization-and-compliance)
- [Phase 4: Backend for store scale](#phase-4-backend-for-store-scale)
- [Phase 5: Build path from this repo](#phase-5-build-path-from-this-repo)
- [Phase 6: Testing, soft launch, global](#phase-6-testing-soft-launch-global)
- [Costs and timeline](#costs-and-timeline)
- [ASO and store listing basics](#aso-and-store-listing-basics)
- [Master checklist](#master-checklist)
- [Next 10 actions](#next-10-actions)

---

## Phase map

| # | Phase | Typical length **(estimate)** | Exit criteria |
|---|---|---|---|
| 0 | **Prototype** (this repo) | done | Playable web build, Capacitor shells, artifact build |
| 1 | **IP decision**: license pitch and/or re-skin | Re-skin: 4–10 weeks. License: 3–12+ months, if it happens at all | Every name, image and story beat is yours or licensed in writing |
| 2 | **Accounts and business setup** | 1–4 weeks (D-U-N-S and org verification are the slow part) | Apple org account, Play Console, Paid Apps agreement, banking and tax |
| 3 | **Monetization and compliance design** | 2–4 weeks, in parallel with Phase 4 | Odds page, age gate, parental consent, privacy policy, ToS |
| 4 | **Backend and native hardening** | 2–4 months | Accounts, server economy, PvP verification, clans with moderation, IAP |
| 5 | **Store builds** | 2–4 weeks | TestFlight and Play closed test builds, store listings, review-ready |
| 6 | **Closed test → soft launch → global** | Closed test 2–6 weeks, soft launch 6–12 weeks | Retention and monetization targets hit, crash-free sessions ≥ 99.5% |

---

## Phase 1: The big blocker (IP)

### Who owns what

- **Black Clover** is Yūki Tabata's manga, published by Shueisha. It ran in Weekly Shōnen Jump from 2015 to 2023, then in Jump GIGA. It ended with chapter 392 in the Spring 2026 Jump GIGA issue, released 1 May 2026 ([Wikipedia](https://en.wikipedia.org/wiki/Black_Clover), [Anime Corner](https://animecorner.me/black-clover-manga-officially-ends-after-over-11-years-of-serialization/)). The TV anime is by Studio Pierrot. Anime-specific assets such as character designs as animated, voices and music usually sit with a separate production committee **(estimate: the usual Japanese anime model, not checked for this title)**.
- **Timing context.** The anime's second season airs from October 2026 on TV Tokyo and streams on Crunchyroll outside Asia. Anime Corner reports a 3 October premiere ([Anime Corner](https://animecorner.me/black-clover-season-2-announces-october-3-premiere/), [Popverse](https://www.thepopverse.com/tv-anime-black-clover-season-2-october-2026)). The property is hot right now. That helps a pitch and also raises the price.

### There has already been an official mobile game, and it closed

- **Black Clover M: Rise of the Wizard King** was developed by Vic Game Studios and published by Garena and Pearl Abyss ([RPG Site](https://rpgsite.net/news/15102-black-clover-m-rise-of-the-wizard-king-launches-on-november-30-for-mobile-devices), [Pocket Gamer](https://www.pocketgamer.com/black-clover-m/announcement)). It launched in Japan on 25 May 2023 and worldwide on 30 Nov 2023 ([Super Anime Store](https://superanimestore.com/blogs/events/black-clover-m-rise-of-the-wizard-king-smartphone-game-ends-service-on-august-21)). The game **ended service in August 2025**. Purchases stopped on 20 June 2025 ([Anime Corner](https://animecorner.me/black-clover-m-rise-of-the-wizard-king-game-announces-end-of-service-will-shut-down-on-august-21/), [Droid Gamers](https://www.droidgamers.com/news/black-clover-m-eos/)).
- An earlier licensed mobile game, **Black Clover Phantom Knights** (Bandai Namco), shut down on 9 Dec 2020 ([GamerBraves](https://www.gamerbraves.com/tag/black-clover-phantom-knights/)).
- **What this means for us:**
  - The rights holder **does license mobile games**, but to established publishers with live-ops teams and marketing budgets.
  - With Black Clover M closed, the mobile slot may be open. Whether a new deal is already signed isn't public. I found no 2026 announcement **(unverified, so assume someone may already hold it)**.
  - A solo or indie developer is very unlikely to get a direct license **(estimate)**. The realistic route is to bring a polished, proven game to a publisher that already works with Shueisha, or to **Shueisha Games**, Shueisha's own games company founded in 2022 ([Automaton](https://automaton-media.com/en/news/20220331-10989/), [PocketGamer.biz](https://www.pocketgamer.biz/shueisha-laucnhes-new-games-division/)).
  - Shueisha Games now builds Jump games itself, for example *BLEACH Songs of the Soul* and *ONE PIECE VIVRE RUSH*. It also runs **joint development** deals, where Shueisha brings world, characters and story and the partner brings development and live-ops know-how. A third line, **development and investment**, funds, publishes and markets games by domestic and international creators. There is a public **[Pitch your game](https://shueisha-games.com/en/pitch)** page ([Shueisha Games company page](https://shueisha-games.com/en/company/)).
  - That pitch page is the one official door we found, but it is for **original IP only**. Submissions may not use IP, characters or materials owned or managed by third parties, Shueisha included. It asks for a proposal (content, cost breakdown, schedule, team) and a portfolio, in Japanese or English. A Windows PC build and a video are optional. Reviews take about a month, and selected games go through prototype, trial, beta and master gates ([Pitch your game](https://shueisha-games.com/en/pitch)). So it fits **Path B**: a re-skinned Grimoire Squads is exactly the kind of thing it takes. Any talk of a Jump licence would come later, if a relationship forms **(estimate)**.
  - Shueisha also runs **Game Creators CAMP**, a community for game creators with seminars and introductions to partner companies ([CAMP](https://game-creators.camp/), [Automaton](https://automaton-media.com/en/news/20220331-10989/)).

### What the stores say

| Store | Rule | What happens without a license |
|---|---|---|
| Apple | **5.2.1:** "Don't use protected third-party material such as trademarks, copyrighted works… without permission… Apps should be submitted by the person or legal entity that owns or has licensed the intellectual property" ([guidelines](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)) | Rejected at review. If it slips through, the rights holder can file through Apple's [App Store content dispute form](https://www.apple.com/legal/intellectual-property/dispute-forms/app-store/), and Apple passes the claim on to the developer. Takedown and account risk follow **(estimate)**. |
| Google Play | The IP policy covers "character artwork from cartoons or films", and the Impersonation policy covers "copying the character and title of a famous TV show" ([IP](https://support.google.com/googleplay/android-developer/answer/9888072?hl=en), [Impersonation](https://support.google.com/googleplay/android-developer/answer/9888374?hl=en)) | Rejection, removal, and strikes against the developer account **(estimate: Google's enforcement ladder)** |
| Amazon | Content policy applies; same outcome expected **(estimate)** | Same |

Using the name in metadata is also covered. Apple bans "copycat representations, names, or metadata" ([5.2.1](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)). So "Black Clover" can't go in the title, keywords or screenshots without a license.

### How anime and manga game licensing usually works **(estimate: general industry practice, not deal-specific)**

- **Who signs:** the publisher's licensing department, often with the anime production committee for anime-derived assets. Western deals may go through a regional partner.
- **Money:** a **minimum guarantee (MG)**, an advance paid up front and recouped against royalties, plus a **royalty on net revenue**. Industry write-ups put royalties at roughly 5–15% of net ([Legal Moves](https://legalmoveslawfirm.com/licensing-deal-financial-terms/), [Xsolla](https://xsolla.com/game-biz-institute/articles/stop-leaving-ip-on-the-table)). For a top Jump property, expect a much higher MG than the five-figure examples in those articles.
- **Control:** the licensor approves every character design, line of dialogue, story beat, gacha banner and marketing asset. Approval cycles add weeks to every content drop.
- **Term and territory:** fixed term (often 2–5 years), named regions and platforms, and what happens to player data and purchases at the end.
- **What they look for:** a publisher with live-ops history, a UA (user acquisition) budget, and localization and customer-support capacity.

### Path A: license (upside, slow)

1. Finish the re-skin first (Path B). A shippable original game is your strongest pitch and your fallback.
2. Build a short pitch deck with retention and monetization data from soft launch, the formation and synergy systems, and art direction.
3. Approach publishers that already hold Jump licenses. In parallel, pitch the **original-IP** version to Shueisha Games ([Pitch your game](https://shueisha-games.com/en/pitch)), which bans third-party IP in submissions. A working relationship there is the most plausible road to a Jump licence later **(estimate)**.
4. If a deal lands, swap the content layer (`src/data/*`, `src/art/specs.ts`, story panels) back to the licensed roster.

### Path B: re-skin into an original IP (recommended now)

Keep the systems. Replace everything that identifies the source.

| Keep (systems, generally not protectable **(estimate, ask counsel)**) | Replace (protectable expression and trademarks) |
|---|---|
| 5-hero squads, formations, front/back-row traits, formation-shifting ultimates | Every character name, look, signature move name ("Black Divider" and so on) |
| Faction synergies at 2/3/5, bonds | Faction and squad names (Black Bulls, Golden Dawn, Magic Knights, Wizard King…) |
| AFK chest, campaign, tower, arena, clans, dispatch, pass | Story, places (Clover Kingdom, Spade Kingdom…), devils' names |
| Gacha rules (pity, first-10 guarantee, rate-ups) | "Grimoire" as the core motif is a generic word, but avoid five-leaf clovers, anti-magic swords and the like **(estimate)** |
| Chibi SVG art pipeline | All art specs, emblems, colour pairings that echo the originals |

**Re-skin tips:**
- Do a trademark search on the new title before you commit to it: [USPTO](https://www.uspto.gov/trademarks/search) and the EUIPO database **(estimate: standard practice)**.
- Write a short "world bible": 5 factions, about 45 heroes, 1 villain organisation. Keep the role, rarity and kit of each slot so balance tests stay valid.
- Remove "Black Clover" from code identifiers that ship in the bundle, store metadata, and the README disclaimer in the store build.

---

## Phase 2: Accounts and fees

### Apple Developer Program

| Item | Fact |
|---|---|
| Fee | **US $99 per year**. Prices are shown in local currency at enrolment, and some non-profits and schools can get a waiver ([Apple](https://developer.apple.com/programs/enroll/), [membership help](https://developer.apple.com/help/account/membership/program-enrollment/)) |
| Individual vs organization | An individual account shows your personal name as the seller. An organization account shows the company name and needs a legal entity (no DBAs or trade names) ([Apple](https://developer.apple.com/programs/enroll/)) |
| D-U-N-S | Organizations need a **free** D-U-N-S number. Allow up to 2 business days after D&B issues it before Apple sees it. A binding-authority check applies ([Apple D-U-N-S help](https://developer.apple.com/help/account/membership/D-U-N-S)) |
| EU trader status | Under the Digital Services Act, apps without verified trader status were removed from the EU App Store from 17 Feb 2025 ([Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)). Trader status publishes contact details, which is one more reason to use a company and not your home address **(estimate)** |
| Paid Apps Agreement | Must be accepted, with banking and tax info, before you can create in-app purchases ([App Store Connect help](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/), [IAP overview](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/)) |
| Commission | **15%** under the App Store Small Business Program, instead of the standard 30%. You qualify if you and your associated accounts earned ≤ $1M in proceeds in the previous calendar year. **You have to enrol**: it isn't automatic. Developers on Apple's alternative EU terms who are in the programme pay 10% ([Apple SBP](https://developer.apple.com/app-store/small-business-program/)). China mainland rates dropped on 15 Mar 2026, to 25% standard and 12% for the programme ([TechNode](https://technode.com/2026/03/13/apple-cuts-app-store-commission-rates-in-mainland-china/), [PocketGamer.biz](https://www.pocketgamer.biz/apple-reduces-app-store-commission-in-mainland-china-from-30-to-25)), but we skip China anyway (see Phase 3) |
| Bundle ID | The repo uses `com.fanmade.grimoiresquads` (`capacitor.config.ts`). Pick the final reverse-domain ID under your company domain **before the first upload**. Both stores tie the listing to it for good **(estimate: standard store behaviour)** |

**Recommendation:** form an LLC or similar and enrol as an **organization**. You get a company seller name, a business address for DSA trader status, and a cleaner path to a later license deal **(estimate)**.

### Google Play

| Item | Fact |
|---|---|
| Fee | **US $25 one-time** ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)) |
| New-developer testing rule | **Personal** accounts created after 13 Nov 2023 must run a **closed test with at least 12 testers who stay opted in continuously for 14 days** before applying for production ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). Third-party guides say organization accounts are exempt and advise recruiting 15–20 testers as a buffer ([Choicely](https://www.choicely.com/blog/google-play-12-tester-rule)) **(unverified in Google's text)** |
| Target API | Since **31 Aug 2026**, new apps and updates must **target Android 16 (API 36)**. Extensions to 1 Nov 2026 are available ([Android Developers](https://developer.android.com/google/play/requirements/target-sdk)) |
| Service fee | Changing region by region, and charged whether you use Play Billing, alternative billing or a web link. The **first $1M a year is 10%**. Above that, one-off in-app purchases are 20% for new installs and 25% for existing installs, or 15%/20% in Google's Games Level Up programme. A **5% billing fee** is added when you use Play Billing in the US, UK, EEA, Australia and Japan. Subscriptions are 10%. Dates: US, UK and EEA from 30 Jun 2026. Australia from 30 Sep 2026. South Korea by 31 Dec 2026. Rest of world by 30 Sep 2027. **Japan is unclear**: the March blog post groups it with Korea (by 31 Dec), while the Help Center table appears to list it with Australia (30 Sep), so check the live page ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/16954621?hl=en), [Android Developers Blog, Mar 2026](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html)) |
| Alternative billing | Google now allows in-app alternative billing alongside Play Billing, and links out to your own web store ([Android Developers Blog](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html)) |
| Android developer verification | Developers must register apps from **30 Sep 2026** in Brazil, Indonesia, Singapore and Thailand, with the rest of the world in 2027. Play registers about 99% of Play apps automatically, so this only matters if you also hand out APKs outside Play ([Android Developers](https://developer.android.com/developer-verification)) |

### Amazon Appstore

- **The Appstore on non-Amazon Android devices was discontinued on 20 Aug 2025.** It **stays on Fire TV and Fire tablets**, and Amazon Coins ended on the same date ([Amazon developer blog](https://developer.amazon.com/apps-and-games/blogs/2025/02/upcoming-changes-to-amazon-appstore-for-android-devices-and-coins-program), [release notes](https://developer.amazon.com/docs/app-submission/release-notes.html)).
- You submit Fire tablet apps through the Amazon Developer Console ([Fire Tablet FAQ](https://developer.amazon.com/docs/fire-tablets/ft-faq.html)), and the developer account is free ([Amazon](https://developer.amazon.com/docs/app-submission/understanding-submission.html)).
- **News this week:** Amazon's new "Alexa Tablets" run Android and get apps from **Google Play**, while existing Fire tablets keep support "for now" ([The Star / dpa, 11 Oct 2026](https://www.thestar.com.my/tech/tech-news/2026/10/11/bye-bye-fire-osamazon-switches-to-android-on-new-tablets)).
- **Recommendation:** Amazon is **last priority**. Your Google Play build reaches the new Amazon tablets. Ship to the Amazon Appstore only if Fire OS tablet players show up in support. It needs Amazon's own IAP in place of Play Billing **(estimate: Amazon requires its IAP for digital goods)**.

---

## Phase 3: Monetization and compliance

### In-app purchases (Apple 3.1.1 / Google Play Billing)

- **Gems, the Grimoire Pass and any pack must use IAP.** Apple says to unlock "in-game currencies, game levels, access to premium content… you must use in-app purchase" ([3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)).
- **Purchased currency may not expire**, and you need a **restore** mechanism for restorable purchases ([3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)). Gems are consumables and need no restore. If the pass is sold as a non-consumable or subscription, it needs a Restore button.
- **US storefront:** buttons and links to external purchase are allowed in US apps ([3.1.1(a)](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)). Don't build for that at launch **(estimate: extra legal and UX cost for a small team)**.
- **The first IAP must ship with a new app version**. Later IAPs of the same type can be submitted on their own ([App Store Connect release notes, 19 Aug 2026](https://developer.apple.com/help/app-store-connect/release-notes/)).
- Map our currencies like this **(estimate)**:
  - **Gems** become consumable IAP packs.
  - **Grimoire Pass premium** becomes a consumable or non-renewing purchase tied to a season.
  - **Yul, Essence, Medals and Crests** stay earn-only and are never sold directly. That keeps the economy legible.

### Loot boxes (gacha): store rules

| Rule | Text |
|---|---|
| Apple 3.1.1 | "Apps offering 'loot boxes' or other mechanisms that provide randomized virtual items for purchase must disclose the odds of receiving each type of item to customers prior to purchase." ([guidelines](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)) |
| Google Play | Apps offering randomized virtual items from a purchase "must clearly disclose the odds of receiving those items in advance of purchase" (added 2019) ([Fenwick summary](https://fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds), [PocketGamer.biz](https://pocketgamer.biz/news/70844/google-play-developers-must-now-disclose-loot-box-odds/)) |

### Loot boxes: regional laws

| Region | Status | What we do |
|---|---|---|
| **USA (FTC)** | HoYoverse (Genshin Impact) settled for **$20M**. The proposed order bars loot box sales to **under-16s without parental consent**, requires **odds and currency exchange-rate disclosure**, and requires a **direct real-money purchase option** ([FTC press release, 17 Jan 2025](https://www.ftc.gov/news-events/news/press-releases/2025/01/genshin-impact-game-developer-will-be-banned-selling-lootboxes-teens-under-16-without-parental), [FTC business blog](https://www.ftc.gov/business-guidance/blog/2025/01/level-tips-businesses-ftcs-settlement-genshin-impact-developer-hoyoverse)) | Treat it as the bar: show odds and real-money cost per pull, require parental consent for purchases by under-16s, never misstate odds |
| **Belgium** | Since 2018 the Gaming Commission treats paid loot boxes as illegal gambling. Several big publishers removed them or didn't launch there ([MCV/Develop](https://www.mcvuk.com/business-news/belgium-isnt-enforcing-loot-box-ban-claims-research-study/), [PCGamesN](https://www.pcgamesn.com/belgium-loot-box-laws-study)) | Region flag: no paid summons in BE. Gems can't buy summons, and summon tickets are earned only. Or don't launch in BE at first |
| **Netherlands** | The Council of State overturned the EA FIFA penalty in **March 2022**, so loot boxes are not gambling under current law ([CMS](https://cms.law/en/nld/legal-updates/Dutch-court-rules-fifa-loot-boxes-not-a-game-of-chance-revokes-ea-penalty), [AKD](https://akd.eu/insights/loot-boxes-are-legal-in-the-netherlands)). The cabinet has floated a ban ([iGB](https://igamingbusiness.com/legal-compliance/weerwind-floats-possible-dutch-loot-box-ban)). A later minister said Dutch gambling law can't ban them on its own and pushed for an EU-wide ban through the Digital Fairness Act ([Gambling News](https://www.gamblingnews.com/news/dutch-minister-pushes-for-eu-wide-loot-box-ban-to-shield-consumers/)). **Current 2026 status unverified** | Never allow trading summoned heroes between players or for anything of outside value. Tradability was the regulator's original reason ([Gambling Insider](https://www.gamblinginsider.com/news/5442/valve-is-the-first-casualty-of-dutch-loot-box-crackdown)) |
| **China** | Odds must be published ([MCV](https://mcvuk.com/chinese-government-passes-new-rules-on-loot-boxes/)). Paid or IAP games on the China App Store need an **NPPA license (ISBN)**, which is "nearly impossible" for foreign devs without a local publisher ([AppInChina](https://appinchina.co/blog/update-apples-new-requirements-for-games-on-the-apple-app-store-china/)) | **Exclude the China mainland storefront** |
| **South Korea** | Since **22 Mar 2024**, every game, foreign ones included, must show loot box probabilities, with GRAC enforcing ([Game World Observer](https://gameworldobserver.com/2024/07/08/266-games-violated-loot-box-rules-south-korea)). A Sept 2025 bill proposes fines of up to 3% of sales ([Inven Global](https://www.invenglobal.com/articles/20011/korea-moves-to-fine-game-companies-up-to-krw-1-billion-for-false-probability-based-item-disclosures)) | Odds on the purchase screen itself, not only in a help page. Korean localization of odds |
| **Japan** | "Kompu gacha" (complete gacha: prizes only for collecting a full set) has been treated as illegal since 2012, under the Act against Unjustifiable Premiums and Misleading Representations ([Japanese Law Translation](https://www.japaneselawtranslation.go.jp/en/laws/view/2303/en)) ([The Next Web](https://thenextweb.com/asia/2012/05/06/japans-mobile-gaming-industry-faces-a-ban-on-lucrative-kompu-gacha-games/), [Game Developer](https://www.gamedeveloper.com/business/why-quot-kompu-gacha-quot-was-banned)) | Never gate a reward behind collecting a set of gacha-only items. Bonds and faction synergies are fine because they're gameplay bonuses, not prizes, but don't sell "collect all 5 to win X" |
| **Australia** | Since **22 Sep 2024**, games with paid chance-based items are rated **at least M**, and simulated gambling is **R18+** ([PocketGamer.biz](https://www.pocketgamer.biz/australia-sets-new-rules-for-video-games-with-gambling-like-content)) | Expect M in AU. No casino-style mini-games |
| **Brazil** | The **ECA Digital** law (Law 15.211/2025) took effect on **17 Mar 2026**. Loot boxes are prohibited in games accessible to minors. Publishers may ship a loot-box-free version for minors or restrict the feature by default ([Machado Meyer](https://www.machadomeyer.com.br/en/recent-publications/publications/digital-law/law-15-211-25-protection-for-children-and-adolescents-in-the-digital-environment), [Mattos Filho](https://www.mattosfilho.com.br/en/unico/brazils-eca-digital/), [Poder360](https://www.poder360.com.br/poder-governo/eca-digital-entra-em-vigor-nesta-3a-feira-entenda-o-que-muda/)). On Apple, declaring loot boxes in the age rating questionnaire sets the app's **Brazil rating to 18+**, and since 24 Feb 2026 Apple blocks 18+ downloads in Brazil for users not confirmed as adults ([Apple news, 24 Feb 2026](https://developer.apple.com/news/?id=f5zj08ey)) | Expect an 18+ rating and a smaller audience in BR. Region flag: paid summons off for minors, earned tickets only. Use the store age signal |
| **EU (pending)** | The Commission's **Digital Fairness Act** proposal was expected around late 2026. Options discussed include banning paid loot boxes or requiring parental consent for minors, showing real-money prices for items priced in virtual currency, and limits on currency bundles ([Freshfields](https://www.freshfields.com/en/our-thinking/blogs/technology-quotient/the-eus-proposed-digital-fairness-act-a-game-developers-guide-to-potential-imp-102ltio)). Already in force as guidance: the EU consumer authorities' (CPC Network) **key principles on in-game virtual currencies** from 21 Mar 2025. They are non-binding, but they ask for clear real-money pricing and no hidden costs, respect for withdrawal rights and protection of children, and they steer national enforcement ([Baker McKenzie](https://connectontech.bakermckenzie.com/european-consumer-protection-network-issues-new-key-principles-on-in-game-virtual-currencies-impact-for-gaming-and-gambling-entities-in-belgium-the-eu-and-beyond/)). **Whether the DFA proposal has been published is unverified** | Build the real-money display and a per-region "paid gacha off" switch now, so a ban or consent rule is a config change |
| **UK** | Industry-led principles since July 2023: no loot boxes for under-18s without parental consent, clear odds, spending controls. The government is keeping legislation under review ([GOV.UK](https://www.gov.uk/guidance/loot-boxes-in-video-games-update-on-improvements-to-industry-led-protections)) | Same as the US approach |

**Example odds text, built from the real numbers in `src/game/gacha.ts`.** Show it behind an **Odds** button on every banner, *before* the summon buttons. Mirror it on a web page linked from the store listing **(estimate: wording is ours, not a regulator template)**:

> **Summon odds (Devil Union)**. Each summon costs 300 Gems (10 summons: 2,700 Gems).
> Base rates per summon: **Mythic 1.5%** · **Legendary 8.5%** · **Epic 30%** · **Rare 60%**.
> Featured: when you get a Mythic, it is **Nacht Faust 30%** and **Liebe 30%** of the time. Half of all Mythic results go to the two of them (25% each). The other half is spread evenly over all 10 Mythics, Nacht and Liebe included (5% each). Per summon, before guarantees: Nacht 0.45%, Liebe 0.45%, each other Mythic 0.075%.
> When you get a Legendary, it is Secre Swallowtail or Jack the Ripper about 28.3% of the time each, and each of the other 13 Legendaries about 3.3%.
> Guarantees: a Legendary or better at least once every 40 summons (when the guarantee triggers, it's a Mythic 15% of the time), and a Mythic at least once every 100 summons. Your first 10-summon includes at least one Legendary or better. Your guarantee counters show on this page and carry over between banners.
> Duplicates turn into hero pages (shards). Summoned heroes can't be traded.

Show the full per-hero list, with each hero's rate, one tap below.

> ⚠️ **Fix before any paid launch: the in-game banner copy understates the featured rate.** The Devil Union tagline says "25% of Mythic pulls each", and the weekly banner says "50% of Mythic pulls". But `pickHero()` in `src/game/gacha.ts` lets featured heroes also win the non-featured half, so the true shares (with today's 10 Mythics and 15 Legendaries) are **30% each** and **55%**. Either exclude featured heroes from the fallback pool or change the copy. Generate the odds table from the same code, with a unit test, so the text and the math can't drift apart. Misstated odds are exactly what the FTC order and Korea's rules target.

The percentages above come from the code as of 13 Oct 2026 and change whenever heroes are added. Korea and China expect per-item rates, not just per-rarity rates **(estimate: check the local guidance)**.

**Concrete gacha UI requirements for the store build:**
- [ ] An **Odds** button on every banner showing per-rarity and per-hero rates. Include rate-up shares, pity rules and the first-10 guarantee.
- [ ] Pity counters visible on the banner.
- [ ] Real-money equivalent shown next to gem costs ("≈ $X"), per the FTC exchange-rate point.
- [ ] A direct real-money option, for example a "10× summon bundle" priced in local currency **(per the FTC order. Not strictly required for us, so an estimate)**.
- [ ] Region and age flags: `paidGachaAllowed` off for BE, and for minors in BR. Turn it off anywhere legal advice says to.
- [ ] Spending caps or parental consent for under-16s (US) and under-18s (UK principles).
- [ ] No trading of summoned units. No set-completion prizes.

### Age rating

- Apple's tiers are now **4+, 9+, 13+, 16+ and 18+**. Developers had to answer the new questionnaire by **31 Jan 2026** ([Apple news](https://developer.apple.com/news/?id=ks775ehf), [upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)). In **July 2026** Apple added questions about social media capabilities ([release notes](https://developer.apple.com/help/app-store-connect/release-notes/)).
- Regional overrides exist: Korea (All/12+/15+/19+), Australia (15+ became 16+), Vietnam ([release notes](https://developer.apple.com/help/app-store-connect/release-notes/)).
- The questionnaire asks about loot boxes. Answer honestly: in Brazil, a "yes" makes the rating 18+ ([Apple news, 24 Feb 2026](https://developer.apple.com/news/?id=f5zj08ey)).
- **Expected rating: 13+ on Apple, M in Australia, 18+ in Brazil (estimate, apart from the Brazil rule).** Drivers are cartoon fantasy violence, clan chat, which is unrestricted communication, and paid random items.
- Google Play ratings come from the IARC questionnaire in Play Console ([Google Play Help](https://support.google.com/googleplay/answer/6209544?hl=en)).

### Age assurance laws (US states and others)

- Apple's **Declared Age Range API** gives apps an age band. Where law requires it, you must use it ([Apple age assurance Q&A](https://developer.apple.com/support/age-assurance/), [WWDC25](https://developer.apple.com/videos/play/wwdc2025/299/)).
- From **24 Feb 2026**, Apple blocks 18+ downloads in Australia, Brazil and Singapore for users not confirmed as adults. For new Apple Accounts created in **Utah from 6 May 2026** and **Louisiana from 1 Jul 2026**, Apple shares age categories through the API, and apps must check for parental permission before "significant updates" for children ([Apple news](https://developer.apple.com/news/?id=f5zj08ey)).
- **Texas SB 2420 is enforceable for now.** A district court blocked it. The Fifth Circuit stayed that injunction on 4 Jun 2026, and the Supreme Court declined to lift the stay on 6 Jul 2026. The appeal on the merits continues ([CCIA](https://ccianet.org/news/2026/07/supreme-court-opts-not-to-intervene-and-block-a-texas-app-store-law-that-likely-violates-first-amendment/), [Pearl Cohen](https://www.pearlcohen.com/fifth-circuit-stays-injunctions-against-texas-app-store-accountability-act/)). California's law is due on 1 Jan 2027 ([stora.sh guide](https://stora.sh/blog/2026-04-08-app-store-age-verification-laws-developer-guide)) **(secondary source, check before launch)**.
- **Google Play Age Signals API** (beta) returns an age band (default 0–12, 13–15, 16–17, 18+) when a parent or adult user has agreed to share it. It went live in Brazil on 17 Mar 2026 and for Texas accounts created after 28 May 2026 ([Android Developers](https://developer.android.com/google/play/age-signals/use-age-signals-api)). Press reports say Google is rolling it out worldwide by the end of 2026, and that its terms allow the signal only for age-appropriate experiences, not for ads, profiling or analytics ([Android Authority](https://androidauthority.com/google-play-age-signals-3692480)) **(secondary, check the API terms)**.
- **Action:** read the age band at launch (Declared Age Range on iOS, Play Age Signals on Android) and feed it into the gacha and chat flags above. Keep it out of the analytics pipeline.

### Children (COPPA) and GDPR

- **COPPA:** the amended FTC rule took effect **23 Jun 2025**, with full compliance due **22 Apr 2026** ([Federal Register](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule), [FTC](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments)).
  - Don't target under-13s: no kid-directed art or marketing, and don't enrol in Apple's Kids category or Play's Designed for Families **(estimate: lowest-risk route)**.
  - Add a neutral age screen. Under-13s get no chat, no purchases and no analytics identifiers **(estimate)**.
  - The FTC's HoYoverse case included COPPA charges: the FTC said the game was marketed to children and collected their data without parental consent ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/01/genshin-impact-game-developer-will-be-banned-selling-lootboxes-teens-under-16-without-parental)).
- **GDPR / UK GDPR (estimate: general obligations, not researched per article):**
  - A lawful basis for each kind of processing.
  - Consent for non-essential analytics and ads.
  - Data export and deletion.
  - DPAs with every vendor (backend, analytics, RevenueCat).
  - EU-region hosting where possible.
  - Name a contact in the privacy policy.

### Privacy, tracking, accounts and login

| Requirement | Source | Our plan |
|---|---|---|
| **Privacy policy** link in App Store Connect **and** inside the app. It must list the data collected, its uses and third parties, plus retention and deletion | [5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage) | Host on the game website. Add a Settings → Privacy link |
| **Support URL** (required) | [App Store Connect reference](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) | Simple support page and email |
| **Privacy nutrition labels**, including SDK data | [Apple](https://developer.apple.com/app-store/app-privacy-details/) | Fill in from the final SDK list |
| **Privacy manifest / required-reason APIs** (since 1 May 2024) | [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) | Check Capacitor and plugin manifests at build time |
| **App Tracking Transparency**: only if you track across other companies' apps or sites for ads | [Apple](https://developer.apple.com/app-store/user-privacy-and-data-use/) | **No ad tracking at launch**, so no ATT prompt |
| **Google Data safety form** | [Play Console Help](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) | Mirror the Apple labels |
| **Account deletion inside the app** (5.1.1(v)). Apple's FAQ says this **includes automatically created guest accounts** | [Apple guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/) | Settings → Delete account. Deletes the server profile, saves and the clan seat. Revokes Sign in with Apple tokens |
| **Google account deletion**: in-app **and** a web link in the Data safety form | [Play Console Help](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) | Web form on the support site |
| **Login services (4.8)**: if a third-party or social login (Google, Facebook…) sets up the primary account, also offer an equivalent login that limits data to name and email, lets users hide their email, and doesn't track for ads | [4.8](https://developer.apple.com/app-store/review/guidelines/#login-services) | Guest account plus **Sign in with Apple** on iOS (meets 4.8 **(estimate)**) and Google on Android |
| **User-generated content (1.2)**: filter, report, block, published contact info | [1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content) | Clan chat needs a word filter, long-press → Report / Block, mute list, mod queue |
| **Review access (2.1)**: a demo account if login is required, and the backend must be live during review | [2.1](https://developer.apple.com/app-store/review/guidelines/#app-completeness) | Guest login works without a demo account. Keep servers up during review |

---

## Phase 4: Backend for store scale

The claude.ai artifact build uses the artifact's shared database and offline bots. That's fine for a private web demo. A store game needs these instead:

| Need | Why |
|---|---|
| **Accounts**: anonymous guest, upgradeable to Sign in with Apple or Google | Cross-device saves, account deletion, support lookups |
| **Authoritative economy** for gems, summons, pass and shop | Gems are real money. Today `summon()` rolls on the client and dailies use the device clock (`today()`), which is trivial to exploit by changing the clock |
| **Server time** for dailies, AFK chest and weekly seasons | Same reason |
| **Cloud save with conflict handling** | Two devices, one account |
| **PvP**: defense snapshots, matchmaking, server-verified results, weekly seasons | Ratings and rewards must be fair |
| **Clans**: membership, check-in, donations, research, weekly raid totals, **moderated chat** | Apple 1.2. Today the clan chat strips control and bidi characters and clamps message length (`cleanText` in `src/features/clan/logic.ts`), but it has no word filter, report, block or mod queue yet |
| **Receipt validation and refund handling** | Stop fake purchases. Claw back refunded gems |
| **Push notifications, remote config, analytics, crash reporting** | Retention and live ops |

### Options

| Option | Good at | Watch out for | Price facts |
|---|---|---|---|
| **Firebase** (Auth, Firestore, Cloud Functions, FCM, Crashlytics, Analytics, Remote Config, App Check) | Fastest start. Its data model is closest to the artifact DB the features already use. Great client SDKs | Server logic means Cloud Functions, which need the Blaze plan. Query limits for leaderboards. Vendor lock-in | Free Firestore quota: 50K reads and 20K writes a day, 1 GiB. Auth with Identity Platform has 50K free MAU. Crashlytics, Analytics, FCM and App Check are no-cost (App Check within attestation-provider quotas). **Remote Config is billed per request above 100K requests a day per project from 1 Sep 2026.** Functions are on Blaze only ([Firebase pricing](https://firebase.google.com/pricing)) |
| **Supabase** (Postgres, Auth, Edge Functions, Realtime) | SQL for leaderboards and clans, row-level security, open source, self-hostable | You write more game logic yourself. Realtime chat scale needs care | Pro plan **$25/month** (100K MAU, 8 GB disk, 250 GB egress included) ([Supabase](https://supabase.com/pricing)) |
| **Nakama** (Heroic Labs) | Built for games: accounts, storage, friends, **groups (clans), chat, seasonal leaderboards, tournaments, matchmaker**, server runtime in TS/JS, Go or Lua. Apache-2.0, so you can self-host ([GitHub README](https://github.com/heroiclabs/nakama)) | You run the servers yourself, or pay for Heroic Cloud. Smaller community | Managed Heroic Cloud is priced per CPU (no public figure on the page). Satori live ops "starts from $600/month" ([Heroic pricing](https://heroiclabs.com/pricing)) |
| **PlayFab** (Microsoft) | Economy, catalogs, leaderboards, groups, live ops, CloudScript | Steeper learning curve. The free dev tier is small | Dev mode: 1,000 lifetime players per title. Pay-as-you-go $0 base, Standard $99/month ([Microsoft](https://developer.microsoft.com/en-us/games/products/playfab/pricing/)) |
| **AWS GameLift** | Dedicated servers for **real-time** multiplayer | Overkill for async PvP. You only need it for real-time PvP later | Usage-based **(estimate: not priced here)** |

**Recommendation (estimate):**
- **Firebase for launch.** It mirrors the artifact DB model (documents, snapshots, rules), so the arena and clan modules port with the least rewriting.
- Use Cloud Functions for every economy and PvP write, and App Check against bot clients.
- **Revisit Nakama** if you add real-time guild wars or real-time PvP, or if Firestore costs climb with chat volume.

### Server-verified PvP (the engine makes this easy)

The battle engine (`src/game/battle.ts`) is deterministic. It takes a seed (`new Battle(teamA, teamB, seed)`) and makes no `Math.random`, `Date`, trig or `Math.pow`/`exp` calls, so it runs on basic arithmetic, which IEEE-754 pins down exactly across JavaScript engines. The battle screen already advances it in fixed steps (`b.step(STEP)` in an accumulator loop), and manual ultimates enter through `requestUlt(uid)`. So:

1. The **server issues** the fight: attacker snapshot id, defender snapshot id, `seed` and `engineVersion`.
2. The client plays it locally for the animation. With AUTO off, it records an **input log** of `(stepIndex, unitId)` for each `requestUlt` tap. Keep the step size fixed, never tied to frame time.
3. The client sends `{fightId, inputLog}`. A Cloud Function **re-runs the same TypeScript engine** with the stored snapshots, seed and inputs, then decides the winner, rating change and rewards. **The client's claimed result is ignored.**
4. Store `{seed, inputs, engineVersion}` as a replay for disputes and "watch replay".
5. Pin the engine per season. Old replays run on the engine version they were fought with.
6. Snapshot defenses on the server when the player sets them, so they can't be edited mid-fight.
7. Add a CI "golden replay" test: a fixed seed and input log must produce the same winner and HP totals in Node and in a real iOS WebView. Any engine change that breaks it bumps `engineVersion` **(estimate: standard practice)**.

Do the same for **Tower, Clan raid damage and campaign stars** if they grant premium rewards. Clan raid damage feeds a shared leaderboard, so verify it.

### Receipts, anti-cheat, push, analytics

- **Receipts:**
  - **RevenueCat** is free up to $2.5K monthly tracked revenue, then 1% of tracked revenue ([RevenueCat pricing](https://www.revenuecat.com/pricing/)). It handles StoreKit 2, Play Billing, restores, refunds and webhooks **(estimate: from its docs, not re-checked here)**.
  - Or go direct: Apple's AppTransaction and Transaction APIs (Apple says on-device receipt validation needs SHA-256 support) ([Apple](https://developer.apple.com/news/upcoming-requirements/)) and the Google Play Developer API **(estimate: the standard direct route)**.
  - **Grant gems only from the server** after validation.
- **Anti-cheat (estimate: standard practice):**
  - The server owns currencies, inventory and pity counters.
  - Rate-limit actions and sanity-check power (a level-5 squad can't clear floor 300).
  - Use Firebase App Check or Play Integrity / App Attest.
  - Ban tooling and a support console.
- **Push:** Capacitor push plugin with APNs and FCM. Ask permission after the first AFK claim, not on first launch. Send "Chest full", "Arena season ends in 24h" and "Clan raid reset". Note APNs certificate changes ([Apple](https://developer.apple.com/news/upcoming-requirements/)).
- **Analytics and crash reporting:**
  - Firebase Analytics and Crashlytics are no-cost ([Firebase](https://firebase.google.com/pricing)).
  - Event plan: tutorial steps, stage clears, summons (banner, count, pity), purchases (SKU, price), feature opens, session start and end, arena fights, clan joins.

---

## Phase 5: Build path from this repo

### Toolchain bumps

| Item | Requirement | Repo today |
|---|---|---|
| Xcode / iOS SDK | Since **28 Apr 2026**, uploads must be built with **Xcode 26+ and the iOS 26 SDK** ([Apple](https://developer.apple.com/news/upcoming-requirements/)). Xcode 27 builds are accepted from Sept 2026 ([release notes](https://developer.apple.com/help/app-store-connect/release-notes/)) | Need a Mac with Xcode 26 or 27 |
| iOS deployment target | Since 9 Sep 2026, apps must target iOS 13 or later ([Apple](https://developer.apple.com/news/upcoming-requirements/)) | Capacitor 8 sets iOS 15 ([Capawesome](https://capawesome.io/blog/how-to-upgrade-your-capacitor-app-to-capacitor-8)) |
| Android target | **API 36** since 31 Aug 2026 ([Android Developers](https://developer.android.com/google/play/requirements/target-sdk)) | **Capacitor 7.6.9** (package.json). `android/variables.gradle` has `targetSdkVersion = 35`, so **upgrade to Capacitor 8** (target and compile SDK 36, min SDK 24, Xcode 26+, Node 22+) ([Capacitor docs](https://capacitorjs.com/docs/updating/8-0), [Capgo](https://capgo.app/blog/upgrade-capacitor-app-to-capacitor-8/)). The iOS project's deployment target is 14.0 and rises to 15.0 |
| Android 16 large screens | Apps targeting API 36 have **portrait locks ignored on tablets and foldables (≥ 600dp)**. Apps can opt out on API 36, but **not from the 2026 release (API 37)**. **Games are excluded via `android:appCategory`** ([Android Developers Blog](https://android-developers.googleblog.com/2025/01/orientation-and-resizability-changes-in-android-16.html)) | The manifest has `android:screenOrientation="portrait"` but no `appCategory`. Add `android:appCategory="game"` on `<application>`, and still test the layout in landscape on a tablet |
| Capacitor point releases | Ionic shipped **Capacitor 8.5** to unblock builds against the newest Xcode SDKs. **Capacitor 9** is forecast for the end of November 2026 ([Ionic, 28 Aug 2026](https://ionic.io/blog/the-road-to-capacitor-9)) | Go straight to the latest 8.x (≥ 8.5). Move to 9 after it settles |
| CocoaPods → Swift Package Manager | **CocoaPods trunk goes permanently read-only on 2 Dec 2026**, so pods stop getting updates. Capacitor has supported SPM since v6 and made it the default in v8 ([Ionic](https://ionic.io/blog/the-road-to-capacitor-9), [Capacitor 8 notes](https://capacitorjs.com/docs/updating/8-0)) | `ios/App/Podfile` means this project is on **CocoaPods**. Migrate the iOS project to SPM as part of the Capacitor 8 upgrade |

### Steps

1. `npm i @capacitor/core@8 @capacitor/ios@8 @capacitor/android@8 @capacitor/cli@8`, then `npx cap sync`. Follow the [Capacitor 8 upgrade guide](https://capacitorjs.com/docs/updating/8-0). It needs Node 22+, Android Studio Otter (2025.2.1)+, AGP 8.13 and Gradle 8.14.3. The guide also says to add `density` to the Android activity's `configChanges` so the WebView doesn't reload on resize. Then migrate iOS from CocoaPods to SPM.
2. Set the app id, display name and version in `capacitor.config.ts`, the Xcode target and `android/app/build.gradle`. Use the **new original-IP name**.
3. Generate icons and splash from `resources/icon.png`.
   - The iOS App Store icon is 1024×1024 with **no transparency** ([Apple forums, quoting the HIG](https://developer.apple.com/forums/thread/711027)) **(secondary)**.
   - Consider a layered Liquid Glass icon made in [Icon Composer](https://developer.apple.com/icon-composer/).
   - Android launcher: an **adaptive icon** with separate foreground and background layers, plus a monochrome layer for themed icons ([Android Developers](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)). The Play Store listing icon is a separate 512×512 upload (see the table below).
   - `@capacitor/assets` can generate the native icon and splash sets from one source image **(estimate: check the tool's current README)**.
4. **Signing:**
   - iOS: Xcode automatic signing under the organization team.
   - Android: create an upload key and enrol in Play App Signing **(estimate: Play's default for new apps)**.
   - Back the keys up offline.
5. **Native feel, so Guideline 4.2 is a non-issue.** 4.2 asks for "features, content, and UI that elevate it beyond a repackaged website" ([4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)). A full game with offline play clears it **(estimate)**. Make sure:
   - [ ] It works offline: campaign, AFK and roster. Online modes degrade gracefully, as they already do.
   - [ ] No browser chrome, no external links in the main UI, no pinch-zoom or rubber-band scroll, safe areas respected.
   - [ ] Battles pause on app background and resume. Audio respects the silent switch.
   - [ ] Haptics, push notifications, IAP with Restore, and optionally Game Center leaderboards and achievements.
   - [ ] 60 fps on a 3–4 year-old phone. Cold start under 3 s.
6. **App Store Connect:**
   - Create the app record and fill in the age rating questionnaire.
   - Privacy labels, privacy policy URL and support URL.
   - IAP products, submitted with the version.
   - App Review phone number in international format ([release notes, 19 Aug 2026](https://developer.apple.com/help/app-store-connect/release-notes/)).
7. **TestFlight:** up to **10,000 external testers**. Builds expire after **90 days**, and the first build in a group goes to beta review ([TestFlight help](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)).
8. **Play Console:**
   - Create the app, then fill in Data safety, content rating (IARC) and target audience.
   - Upload an AAB to closed testing and keep 12+ testers opted in for 14 days.
   - Then apply for production.

### Required store assets

| Store | Asset | Spec |
|---|---|---|
| Apple | iPhone screenshots | **Required:** iPhone with Dynamic Island, medium display: **1206×2622** or 1179×2556 portrait. **Recommended:** large display **1320×2868**. Up to 10 per size, JPG or PNG, **no alpha** ([Apple screenshot specs](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)) |
| Apple | iPad screenshots | Only if iPad is supported: 13-inch **2064×2752** or 2048×2732 ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)). **Tip:** ship iPhone-only at first to skip iPad QA **(estimate)** |
| Apple | Upcoming | **iPhone Duo screenshots required from April 2027** for apps built with the iOS 27.1 SDK or later ([release notes, 5 Oct 2026](https://developer.apple.com/help/app-store-connect/release-notes/)). Sizes: outer display 1398×2034, inner display 2007×2853 portrait ([screenshot specs](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)). The inner display is much wider than a phone (about 0.7:1), so test the portrait layout there and avoid letterboxing it **(estimate)** |
| Apple | App previews (video) | Optional. See [preview specs](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/) |
| Google | Icon | 512×512 32-bit PNG, ≤ 1 MB ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)) |
| Google | Feature graphic | 1024×500 JPG or 24-bit PNG, no alpha (same source) |
| Google | Screenshots | At least 2, up to 8 per device type. 320–3840 px per side, aspect ratio no more than 2:1. 9:16 at ≥ 1080 px recommended (same source) |

Use the Playwright scripts in `scripts/` (`uishots.mjs`) to render 1206×2622 and 1320×2868 captures, with `deviceScaleFactor` set to 3 at a 402×874 or 440×956 viewport **(estimate)**. Then add caption bands in an image editor.

---

## Phase 6: Testing, soft launch, global

1. **Internal test** (1–2 weeks): you plus 5–10 friends on TestFlight and Play internal testing. Fix crashes and economy holes.
2. **Closed test** (2–6 weeks): 50–500 players from Discord and Reddit. On Google, this also meets the 12-tester, 14-day rule. Run a balance survey.
3. **Soft launch** (6–12 weeks), in 1–3 English-speaking or mid-cost markets. Common picks are the Philippines, Canada, Australia/NZ and the Nordics **(estimate)**. Australia means an M rating and loot box labelling (see above). Spend a small UA budget to get statistically useful cohorts (≥ 1,000 installs per cohort) **(estimate)**.
4. **Global launch** once targets are met. Add localization (start with ES, PT-BR, FR, DE, JA, KO **(estimate)**, minding the BR and KR rules).

### What to measure in soft launch

| Metric | Benchmark | Target for a midcore idle RPG **(estimate)** |
|---|---|---|
| **D1 retention** | Top 25% of all mobile games: ~26.5–27.7% (2024 data, published Feb 2025), just over 30% (2025 data, published Jun 2026) ([GameAnalytics 2025 via GameDev Reports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks), [2026](https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game)) | ≥ 35–40% |
| **D7 retention** | Top 25%: 7–8% (2024 data), 6–7% (2025 data). Median just under 4% (same sources) | ≥ 12–15% |
| **D30 retention** | Top 25%: ~1.6–1.8%, median ~0.7–0.8% (2025 data, all genres; same 2026 source) | ≥ 5% (idle RPGs retain better than the all-genre average **(estimate)**) |
| **Payer conversion** | No primary benchmark found for idle RPGs | Two numbers, defined up front: **cohort payer share** (installs who have paid at least once by D30) 2–5%, and **daily payer rate** (payers ÷ DAU) 0.5–1.5% **(estimate)** |
| **ARPDAU** | No primary benchmark found. RPGs are usually the top-ARPDAU genre **(estimate)** | $0.10–$0.40 in tier-1 markets **(estimate)** |
| Tutorial completion | n/a | ≥ 85% |
| Crash-free sessions | n/a | ≥ 99.5% |
| Store page → install conversion | n/a | Track per creative |
| Feature reach | n/a | % of D7 players who touched Arena, Clan, Tower, Pass |

**Decision rule (estimate):** if D1 is below 30% after two tuning iterations, fix the first-session experience before spending on UA. If D7 is below 10%, look at mid-game walls such as the campaign difficulty curve, gacha frustration and dailies that are too long.

---

## Costs and timeline

### Timeline at a glance **(estimate)**

Month 0 is the day you commit to Path B. Phases overlap, and a small funded team can compress this to roughly 5–7 months.

| Months | Lean solo path | Gate to move on |
|---|---|---|
| 0–1 | World bible, new name plus trademark and domain check, LLC, D-U-N-S, Apple and Google accounts. Capacitor 8 upgrade and SPM migration | Accounts approved. Native builds compile on Xcode 26+ and target SDK 36 |
| 1–3 | Re-skin content and art. Backend MVP: auth, cloud save, server time, server-side economy | Re-skinned build plays end to end on a phone, with no Black Clover names left |
| 3–5 | IAP with RevenueCat, server-verified arena, clan chat moderation, odds page, age and region flags, privacy policy, account deletion | Compliance checklist green |
| 5–6 | TestFlight beta, Play closed test (12+ testers for 14 days), store assets | Play production access granted. TestFlight beta review passed |
| 6–9 | Soft launch in 1–3 markets, two tuning iterations | D1 ≥ 35%, D7 ≥ 12%, crash-free ≥ 99.5% |
| 9–10 | Global launch and the first localizations | n/a |

### Costs

All money figures are **estimates** unless a source is linked.

| Item | Lean (solo, original IP) | Small funded team |
|---|---|---|
| Apple Developer Program | **$99/yr** ([Apple](https://developer.apple.com/programs/enroll/)) | $99/yr |
| Google Play | **$25 once** ([Google](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)) | $25 |
| Amazon Appstore | **$0** ([Amazon](https://developer.amazon.com/docs/app-submission/understanding-submission.html)) | $0 |
| D-U-N-S | **$0** ([Apple](https://developer.apple.com/help/account/membership/D-U-N-S)) | $0 |
| Company (LLC) setup and yearly fees | $100–$800 | $500–$2,000 |
| Legal: ToS, privacy policy, loot box review, trademark search | $0–$1,500 (templates plus a one-hour review) | $5K–$25K |
| License (Path A only) | n/a | MG of high five to seven figures plus 5–15% royalty ([Legal Moves](https://legalmoveslawfirm.com/licensing-deal-financial-terms/)) |
| Art re-skin | $0 (procedural chibi SVG specs) to $3K (icon and key art) | $15K–$60K (key art, 45 hero redesigns, store art) |
| Audio (music and SFX) | $0–$300 (licensed packs) | $3K–$15K |
| Mac for Xcode, plus test devices (iPhone, Android, Fire tablet) | $800–$2,000 | $3K–$6K |
| Backend at test scale | $0–$50/mo (Firebase free tier or Supabase Pro $25 ([Supabase](https://supabase.com/pricing))) | $50–$300/mo |
| Backend at 10K–100K DAU | $200–$2,000/mo | same |
| RevenueCat | $0 until $2.5K MTR, then 1% ([RevenueCat](https://www.revenuecat.com/pricing/)) | same |
| Analytics and crash reporting | $0 (Firebase) ([Firebase](https://firebase.google.com/pricing)) | $0–$500/mo |
| Soft-launch UA | $2K–$10K | $20K–$100K |
| Community and support tools | $0 (Discord) | $100–$500/mo |
| **Rough total to soft launch** | **≈ $3K–$15K plus your time** | **≈ $60K–$250K+** |

---

## ASO and store listing basics

| Field | Apple | Google |
|---|---|---|
| Name / title | 2–30 chars ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)) | 30 chars ([Google](https://support.google.com/googleplay/android-developer/answer/13393723?hl=en)) |
| Subtitle / short description | 30 chars | 80 chars |
| Keywords | 100 bytes, comma-separated, don't repeat words from the name ([Apple](https://developer.apple.com/app-store/product-page/)) | n/a. Use the description and title |
| Description | Required ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)) | 4,000 chars ([Google](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)) |
| Promotional text | 170 chars, editable without review ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)) | n/a |

**Tips (estimate):**
- **Category:** Games → Role Playing, with Strategy as the secondary.
- **The first 3 screenshots do most of the work.** Show the squad and formation hook, then a big ultimate moment, then summon and collection. One short benefit caption per shot.
- **Title formula:** unique name plus a genre word, for example "<Name>: Idle Squad RPG". Don't use another game's or IP's name in the keywords (5.2.1).
- **Video preview:** 15–30 s of real gameplay. Formation shift, ultimate, summon.
- **Ratings prompt:** ask after a win streak or a Mythic pull, never after a loss.
- **Live content:** use Apple In-App Events and Google Play LiveOps / Promotional content for banners and seasons, and Custom Product Pages per ad creative.
- **Localize screenshots** for your top 5 markets before global launch.
- **Store creatives must match the game**, with no fake gameplay. Both stores police misleading ads **(estimate)**.

---

## Master checklist

**IP**
- [ ] Decide Path B (re-skin) now. Optionally start a Path A pitch list, and prepare a Shueisha Games pitch of the original-IP version.
- [ ] Trademark search on the new name. Register the domain and social handles.
- [ ] Replace names, art specs, story, factions and ability names. Scrub "Black Clover" from the bundle and metadata.

**Business**
- [ ] LLC formed. D-U-N-S issued. Apple organization account. Play Console (organization). Amazon account (later).
- [ ] Paid Apps Agreement, tax and banking (Apple). Payments profile (Google). Small Business Program enrolment (Apple). 15%/first-$1M tier enrolment where needed (Google).
- [ ] EU DSA trader status.
- [ ] Final bundle ID and application ID under the company domain, set before the first upload.

**Compliance**
- [ ] Privacy policy, ToS, support page, account deletion web form.
- [ ] Age screen, Declared Age Range / Play age signals, regional gacha flags (BE, BR minors).
- [ ] Gacha odds page, pity display, real-money equivalents, parental consent for under-16 purchases.
- [ ] Clan chat filter, report, block, mute. Moderation queue.
- [ ] Apple age rating questionnaire, IARC questionnaire, privacy labels, Data safety form.

**Engineering**
- [ ] Capacitor 8.5+, Xcode 26+, target SDK 36, `android:appCategory="game"`, iOS moved from CocoaPods to SPM before 2 Dec 2026.
- [ ] Backend: auth, server economy, server time, cloud save, PvP verification, clans and raid, receipts, push, analytics and crash reporting.
- [ ] IAP products: gems packs, Grimoire Pass, starter pack. Restore purchases.
- [ ] Native polish for 4.2: offline, lifecycle, haptics, safe areas, performance.

**Launch**
- [ ] TestFlight external group. Play closed test (12+ testers, 14 days).
- [ ] Store listings and screenshots (1206×2622 and 1320×2868, plus Play sizes).
- [ ] Soft launch in 1–3 markets, KPI dashboard, two tuning iterations.
- [ ] Global launch plus localization.

---

## Next 10 actions

1. **Commit to Path B.** Write a one-page world bible: new title, 5 original factions, villains and tone. Keep the systems.
2. **Run a trademark and domain check** on 3 candidate names, and pick one.
3. **Form the company and request a D-U-N-S number**, which is free but slow ([Apple](https://developer.apple.com/help/account/membership/D-U-N-S)). Then enrol Apple as an organization and open Play Console.
4. **Upgrade to Capacitor 8.5+ and move iOS to Swift Package Manager** before CocoaPods trunk freezes on 2 Dec 2026. Set target SDK 36 and `android:appCategory="game"`, and build once on Xcode 26 or 27 to surface native issues early.
5. **Re-skin the roster data and art specs** (`src/data/heroes.ts`, `src/art/specs.ts`, story panels). Re-run `tests/balance.test.ts` to confirm the numbers didn't move.
6. **Stand up the Firebase backend:** guest auth plus Sign in with Apple and Google, a Firestore profile and save, and Cloud Functions for summon, shop and pass grants on server time.
7. **Port the Arena to server-verified fights** (seed plus input log, re-sim in a function), and port clans with chat moderation (filter, report, block).
8. **Add IAP via RevenueCat** (gems packs and pass) with server-side granting, a Restore button and refund handling. Build the gacha **Odds** page and regional and age flags.
9. **Write the privacy policy, ToS and support page**, and add in-app account deletion. Fill in the Apple age rating, privacy labels and Play Data safety form.
10. **Start the Play closed test (12+ testers for 14 days) and a TestFlight beta at the same time**, capture store screenshots, then plan a 6–12 week soft launch with the KPI targets above. Once you have soft-launch numbers, send the original-IP pitch to [Shueisha Games](https://shueisha-games.com/en/pitch) and to other publishers.
