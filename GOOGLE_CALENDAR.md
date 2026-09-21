# Google Calendar sync

Each coach connects their own Google account. CoachHub creates one calendar
called **CoachHub** in that account and keeps it in step with the coach's
trainings, matches and events.

- **CoachHub → Google:** titles, descriptions, locations, dates and times.
- **Google → CoachHub:** dates and times only. Move a training in Google and
  the next sync moves it in CoachHub. Renaming it in Google does nothing —
  the next push restores the CoachHub title.
- Events you create by hand inside the CoachHub calendar are left alone.
- Deleting an event in Google does **not** delete the training. The next sync
  puts it back. Delete it in CoachHub instead.

---

## What you have to set up

Everything below happens once, in your own Google account.

### 1. Google Cloud project

1. Open <https://console.cloud.google.com/> and create a project (any name).
2. **APIs & Services → Library** → search "Google Calendar API" → **Enable**.

### 2. OAuth consent screen

**APIs & Services → OAuth consent screen**

| Field | Value |
|---|---|
| User type | External |
| App name | CoachHub |
| User support email | your address |
| Developer contact | your address |
| Scopes | add `.../auth/calendar.app.created` |
| Test users | every coach who will connect, including yourself |

Leave the app in **Testing**. That allows up to 100 test users and shows a
"Google hasn't verified this app" screen you click through with
**Advanced → Go to CoachHub**. Publishing to production requires Google's
verification review, which takes a few weeks — only needed to go public.

### 3. OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**
- Authorized redirect URIs — add both:
  - `http://localhost:8000/auth/google/callback`
  - `https://<your-railway-backend>/auth/google/callback`

Copy the **Client ID** and **Client secret**.

### 4. Environment variables

Add to `backend/.env` for local work:

```bash
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
BACKEND_PUBLIC_URL=http://localhost:8000
```

And on the Railway **backend** service:

```bash
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
BACKEND_PUBLIC_URL=https://<your-railway-backend>
```

`BACKEND_PUBLIC_URL` builds the redirect URI, so it must match what you
registered in step 3 exactly — no trailing slash.

Restart the backend. Without `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` the
Settings row stays disabled and no sync code ever runs.

### 5. Connect

Settings → Integrations → **Connect**, pick your Google account, accept. You
land back in CoachHub and the first sync runs immediately.

---

## Live updates from Google

Google only delivers push notifications to a **public HTTPS** address, so
`BACKEND_PUBLIC_URL` must be the Railway URL for them to work. When it is,
CoachHub registers a watch channel on the calendar and Google pings
`POST /google/webhook` whenever something changes there.

On `http://localhost` there is no channel. Two-way still works — Google's
changes arrive whenever a sync runs (the **Sync now** button, or any write
that triggers a background sync). Settings says so in the row when push is off.

Channels expire after 30 days. There is no scheduler in this app, so the
channel is renewed opportunistically whenever a sync runs and it is within
three days of expiring. A coach who never opens the app for a month gets a
dead channel until their next sync.

---

## How it stays in step

Google event ids may be chosen by the caller as long as they are base32hex,
and a UUID's hex digits already qualify. So the Google event id for a row is
just a kind letter plus the row's UUID without dashes:

```
t2530b738f2764be7add5026a9c955d83   training session
m…                                  match
e…                                  calendar event
```

There is no mapping table, and pushing the same row twice can never create a
duplicate. Deleting a row deletes `t<uuid>` in Google; re-creating a row with
the same id revives the same event.

A sync lists the calendar once, applies Google's dates and times to CoachHub,
then pushes back everything that still differs. Bulk operations (creating a
weekly series, "this and all future", deleting a team or season, renaming a
team) schedule a full sync instead of a per-item push.

## Tokens

The refresh token is a real credential: whoever holds it can read and write
that coach's CoachHub calendar until it is revoked. It is stored encrypted in
`google_accounts`, with a Fernet key derived from `SECRET_KEY`.

**Changing `SECRET_KEY` invalidates every stored token.** Coaches then see an
error in Settings and have to press Connect again.

Disconnecting revokes the token at Google and deletes the row. The calendar
and its events stay in the coach's Google account.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Connect button disabled | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` missing; restart the backend after adding them |
| `redirect_uri_mismatch` | `BACKEND_PUBLIC_URL` does not match the URI registered in step 3 |
| "Google hasn't verified this app" | Expected while the consent screen is in Testing. Advanced → Go to CoachHub |
| `access_denied` right after choosing the account | Your Google address is not in the test users list |
| Settings shows an error after a while | Token expired or was revoked in the Google account settings. Press Connect again |
| Times land an hour out | The calendar's time zone is the browser's zone at connect time. Disconnect and reconnect from a browser in the right zone |
