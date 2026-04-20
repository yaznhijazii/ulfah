# 💬 Ulfah Relationship Chatbot — Product Specification

> A proactive, emotionally intelligent chatbot embedded inside the Ulfah couples platform, acting as a personal relationship companion for each user and couple.

---

## 1. Overview

The **Ulfah Chatbot** is not a generic AI assistant — it is a *relationship-aware companion* that knows the couple's history, habits, and patterns inside the platform. It speaks warmly, feels personal, and nudges couples toward connection before distance grows.

**Core Identity:**
- Name: **Lufi** — the friendly, expressive companion of Ulfah
- Tone: Warm, gentle, encouraging — never robotic or clinical
- Language support: Arabic + English (bilingual)
- Persona: A curious, caring friend who always notices when you've gone quiet

### 🎭 Lufi Avatar States
Lufi has two visual expressions that switch based on context:

| State | Asset | When Used |
|---|---|---|
| **Default** — arms crossed, confident smile | `lufi-default.png` | Greetings, advice, message writing, normal replies |
| **Thinking** — hand on chin, question mark bubble | `lufi-thinking.png` | Processing user input, loading response, asking clarifying questions |

> Both assets are provided as transparent PNGs and should be displayed at the bottom-left or center of the chat screen as a floating character, not a small icon.

---

## 2. Core Roles & Features

### 2.1 🧠 Relationship Advice & Support
The chatbot provides thoughtful, context-aware relationship guidance.

**Capabilities:**
- Answer questions like *"How do I tell my partner I need more quality time?"*
- Offer communication tips tailored to the couple's history inside Ulfah
- Suggest healthy relationship habits based on research-backed frameworks (e.g., Gottman Method, love languages)
- Respond to emotional venting with empathy before offering advice

**Example prompts it handles:**
- "We keep arguing about the same thing, what should I do?"
- "I feel like we're drifting apart"
- "How can I show my partner I appreciate them more?"

---

### 2.2 ⚔️ Conflict Resolution Guide
Guides couples through disagreements with structured, calm support.

**Capabilities:**
- Walk the user through a *"Cool Down → Express → Understand → Resolve"* flow
- Offer neutral perspective without taking sides
- Suggest the right moment to have difficult conversations
- Provide conflict scripts: *"Try saying it this way…"*

**Example flow:**
```
User: "We had a big fight and I don't know what to say"
Bot:  "I'm sorry to hear that 💙 Let's work through it together.
       First — are you both calm enough to talk right now, or do you
       need a little space first?"
```

---

### 2.3 💌 Love Message Writer
Helps users write heartfelt, personalized messages for their partner.

**Capabilities:**
- Generate romantic messages for any occasion (good morning, apology, anniversary, random love note)
- Personalize based on the partner's name and context the user shares
- Offer multiple tone options: poetic / playful / deep / simple
- Support Arabic and English messages
- One-tap copy to send directly in the platform's messaging feature

**Example:**
```
User: "Write me a good morning message for my wife, she loves coffee and sunsets"
Bot:  [Generates 3 variations] ☀️ Poetic / 😄 Playful / 💕 Simple
```

---

### 2.4 🔔 Proactive Nudge System *(Signature Feature)*
Lufi monitors couple activity inside the platform and proactively speaks up the moment the user opens the app — no waiting for the user to ask first.

**🚨 App-Open Proactive Check (Most Important)**
Every time the user opens Ulfah, Lufi silently checks activity metrics. If any trigger is met, Lufi greets the user with a contextual nudge *before* showing the normal home screen or as a chat pre-load:

```
[User opens app]
→ Lufi checks: last_message_at, last_memory_at, last_game_at
→ If trigger met → Lufi avatar appears with message
→ lufi-thinking.png shown briefly → switches to lufi-default.png with message
```

**Trigger Conditions & Responses:**

| Trigger | Lufi's Message |
|---|---|
| No message sent in **1+ week** | *"مرحبا! 👋 مضى أسبوع ولم تكتب لـ[اسم الشريك] — تبي أساعدك تكتب له/لها شي؟"* |
| No message sent in **3–6 days** | *"Hey! It's been [X] days since you last messaged [partner name] 💬 Want me to help you send something?"* |
| No shared memory added in 2+ weeks | *"It's been a while since you added a memory together 📸 Had any good moments recently?"* |
| Relationship rule not checked in 30 days | *"You set a relationship goal last month — how's it going? 🌱"* |
| Partner's birthday in 3 days | *"[Partner name]'s birthday is in 3 days 🎂 Want help planning something special or writing a message?"* |
| No game played together in 1+ week | *"You two haven't played a game together in a while 🎮 Want a suggestion?"* |
| Opened app after 3+ day absence | *"Welcome back! 💙 Just so you know, it's been [X] days since you last messaged [partner name]."* |

**Nudge Principles:**
- Lufi speaks up **the moment the app opens** if a trigger is met — not just via push notification
- Never guilt-trip — always encouraging and gentle
- Max 1 nudge per day to avoid fatigue
- User can snooze nudges ("Remind me later") or dismiss ("I'll do it myself")
- Nudges feel personal, not automated — always use partner's real name

---

## 3. Conversation Design

### 3.1 Personality Traits
- **Warm** — uses soft, caring language
- **Non-judgmental** — never criticizes either partner
- **Concise** — short messages, no walls of text
- **Emoji-balanced** — uses emojis naturally, not excessively
- **Bilingual** — responds in the language the user writes in (AR/EN)

### 3.2 Conversation Opening States

| Context | Opening Message |
|---|---|
| First time ever | *"Ahlan! 👋 I'm here to help you and [partner name] stay close and connected. What can I help you with today?"* |
| Returning after 3+ days | *"Welcome back 💙 It's been a few days — is everything okay? Anything on your mind?"* |
| Normal return | *"Hey! 😊 How are things with you and [partner name]? What's on your mind?"* |
| After a nudge was sent | *"Glad you're here! Want to pick up where we left off, or is there something new?"* |

### 3.3 Suggested Quick-Start Questions
Displayed as tappable cards when the user first opens the chat (or after a greeting). These replace typing friction and immediately show Lufi's value:

| Label | Language | What it triggers |
|---|---|---|
| 🔍 **حلل شخصيتي** | Arabic | Lufi asks a few fun questions and gives the user a personality snapshot based on their behavior in the app |
| 💡 **نصيحة اليوم** | Arabic | Lufi gives a fresh, personalized relationship tip for the day based on the couple's recent activity |
| 💌 **اكتب رسالة لشريكي** | Arabic / EN | Opens the love message writer flow |
| 🎮 **اقترح نشاط لنا** | Arabic / EN | Lufi suggests a game, challenge, or activity from the platform suited to the couple |

> Display these as horizontal scrollable pill chips or 2×2 grid cards below Lufi's greeting message. Chips disappear once the user taps one or starts typing.

---

## 4. Technical Architecture

### 4.1 AI Stack
- **LLM:** Claude (via Anthropic API) — `claude-sonnet-4-20250514`
- **System Prompt:** Relationship-context-aware, injected with couple data per session
- **Memory:** Couple profile injected per request (no persistent LLM memory needed)

### 4.2 System Prompt Structure
```
You are Lufi, the relationship companion inside the Ulfah couples app.
You are warm, empathetic, bilingual (Arabic/English), and non-judgmental.
You help couples stay connected, work through conflicts, and express love.

Current user: {user_name}
Partner name: {partner_name}
Relationship duration: {duration}
Last message sent: {days_since_last_message} days ago
Last memory added: {days_since_last_memory} days ago
Current platform context: {current_section} (e.g., Messages / Games / Memories)

Respond in the same language the user writes in.
Keep responses warm, concise, and actionable.
Never take sides. Never shame the user. Always encourage connection.
```

### 4.3 Proactive Nudge Engine
```
Cron Job / Event Listener → Check couple activity metrics
→ Evaluate trigger conditions (table in section 2.4)
→ If trigger met AND last nudge > 24h ago
→ Push notification + pre-open chatbot with contextual message
→ Log nudge event to avoid repeats
```

### 4.4 Data Inputs from Ulfah Platform
The chatbot reads (read-only) the following signals:
- `last_message_at` — timestamp of last message
- `last_memory_at` — timestamp of last memory added
- `last_game_at` — timestamp of last game played
- `relationship_rules[]` — list of couple's relationship rules
- `partner_birthday` — date
- `app_last_opened_at` — for "welcome back" context

---

## 5. UX & UI Guidelines

### 5.1 Chat Interface
- Floating chat button on all main screens (bottom right) — uses `lufi-default.png` as the button icon
- Full-screen chat view on open
- **Lufi avatar** displayed at bottom-left of chat as a standing character (not a small circle icon):
  - Shows `lufi-thinking.png` while response is generating
  - Switches to `lufi-default.png` once message is delivered
- Bot messages: left-aligned, soft bubble, brand color
- User messages: right-aligned, white/light bubble
- Typing indicator shown via Lufi's thinking avatar (no separate dots needed)
- Quick-start question cards shown on fresh chat open

### 5.2 Nudge Notification
- Push notification with warm preview text
- On tap: opens app → auto-opens chatbot with contextual message pre-loaded
- In-app banner (non-intrusive) if app is already open

### 5.3 Accessibility
- Min font size 16px
- High contrast mode support
- RTL layout support for Arabic

---

## 6. Privacy & Ethics

| Principle | Implementation |
|---|---|
| No data sharing | Couple data is only used within the session prompt, never stored by LLM |
| Transparency | User can see what data the bot uses ("I noticed you haven't messaged in 5 days") |
| Opt-out | Users can disable proactive nudges anytime in settings |
| No surveillance framing | Nudges are framed as caring reminders, never monitoring |
| Safe messaging | If user expresses distress or mentions abuse, bot redirects to professional support resources |

---

## 7. Roadmap Phases

### Phase 1 — MVP
- [ ] Core chat UI integrated in Ulfah with Lufi avatar (default + thinking states)
- [ ] Relationship advice & conflict resolution flows
- [ ] Love message generator (3 tone options)
- [ ] 4 quick-start question cards (حلل شخصيتي / نصيحة اليوم / message / activity)
- [ ] App-open proactive nudge: "You haven't messaged in X days"

### Phase 2 — Personalization
- [ ] Partner name & context injected into all messages
- [ ] Bilingual AR/EN switching
- [ ] Quick reply chips
- [ ] Birthday reminder nudges

### Phase 3 — Deep Integration
- [ ] Full proactive nudge engine (all triggers in section 2.4)
- [ ] Platform context awareness (knows which section user is in)
- [ ] Relationship rule check-ins
- [ ] Analytics: nudge open rate, message conversion rate

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| Chatbot DAU / MAU ratio | > 30% |
| Message sent after nudge | > 40% conversion |
| User satisfaction (thumbs up/down) | > 80% positive |
| Avg session length | 3–5 exchanges |
| Nudge opt-out rate | < 15% |

---

*Last updated: April 2026 | Product: Ulfah Couples Platform*
