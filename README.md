# Gym TV

Your workout plan on the gym TV, controlled from your iPhone and Apple Watch.

- **TV screen** (`tv.html`): current exercise, set, reps, weight, rest countdown with beeps, what's next.
- **Phone remote** (`remote.html`): start a workout, Set done, pause or extend rest, skip, log the weight you used, and edit the plan.
- **Apple Watch**: Shortcuts that tap Set done, Skip, +30s and Pause from your wrist.
- **Fire Stick app** (`gym.apk`): opens the TV screen full screen, keeps the screen awake and starts when the stick powers on. Works on old Fire OS 5 sticks too.

Everything talks to one small free database (Supabase). GitHub builds the Fire Stick app and hosts the pages for free.

Setup takes about 20 minutes, once.

---

## 1. Create the database (Supabase)

1. Go to [supabase.com](https://supabase.com), sign up and click **New project**. Pick the London region. Any password.
2. When it's ready, open **SQL Editor**, click **New query**, paste in everything from `supabase/schema.sql`, and click **Run**. You should see "Success".
3. Click **Connect** (top of the dashboard) or go to **Project Settings > Data API** and copy the **Project URL**. It looks like `https://abcdefgh.supabase.co`.
4. Go to **Project Settings > API Keys** and copy the **Publishable key** (starts `sb_publishable_`). If you only see legacy keys, the **anon** key works too.

## 2. Fill in the config

Open `web/config.js` and fill in the three values:

```js
window.GYM_CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co',
  supabaseKey: 'sb_publishable_xxxxxxxx',
  room: 'marsh-gym-7k2q'   // make one up, 6+ characters
};
```

The room code is what links your TV, phone and watch. Keep it a bit random, since anyone with it could advance your workout.

## 3. Put it on GitHub

1. On [github.com](https://github.com) create a **new public repository**, for example `gym-tv`. (Free GitHub Pages needs a public repo.)
2. Upload the whole folder. Easiest is GitHub Desktop, or drag the files onto the repo page. **Make sure the hidden `.github` folder goes up too.** On a Mac, press Cmd+Shift+. in Finder to show hidden folders before dragging.
3. In the repo go to **Settings > Pages** and set **Source** to **GitHub Actions**.
4. Go to the **Actions** tab, open **Build and publish**, and click **Run workflow** (it also runs on every change you push).
5. After about 3 minutes it goes green. The run summary shows your app download address.

Your addresses will be (with your own GitHub username and repo name):

- Phone remote: `https://YOUR-USERNAME.github.io/gym-tv/remote.html`
- TV screen: `https://YOUR-USERNAME.github.io/gym-tv/tv.html`
- Fire Stick app: `https://YOUR-USERNAME.github.io/gym-tv/gym.apk`

## 4. Phone

Open the remote address in Safari, tap **Share > Add to Home Screen**. It then opens like an app.

## 5. Fire Stick

1. Open **Downloader**, type the `gym.apk` address and press Go.
2. Choose **Install**, then **Open**. Delete the file when Downloader offers.
3. The app is called **Gym TV** in Your Apps. Hold the menu button on it to move it to the front row.

It keeps the screen on, retries if Wi-Fi isn't ready yet, and opens itself when the stick starts up (most Fire Sticks allow this; if yours doesn't, just open it from the home screen). Press the centre button on the Fire remote to reload the page.

If you'd rather not sideload, Silk works too: open the `tv.html` address and turn off the screensaver in **Settings > Display & Sounds > Screensaver**.

## 6. Apple Watch

Make one shortcut per button. On your iPhone open **Shortcuts**, tap **+**, then:

1. Add the action **Get Contents of URL**.
2. URL: `https://abcdefgh.supabase.co/rest/v1/rpc/gym_action` (your Project URL plus `/rest/v1/rpc/gym_action`).
3. Tap the arrow to show more options:
   - **Method**: POST
   - **Headers**: add `apikey` with your publishable key as the value
   - **Request Body**: JSON. Add two Text fields: `p_room` = your room code, and `p_action` = `done`
4. Name it **Set done**. In the shortcut's settings (the **i** button) turn on **Show on Apple Watch**.
5. Long-press the shortcut, **Duplicate**, and change `p_action` and the name for the others:

| Shortcut name | p_action |
|---|---|
| Set done | `done` (while resting, this skips the rest) |
| Skip exercise | `next` |
| Add 30 seconds | `add30` |
| Pause rest | `toggle_pause` (tap again to resume) |
| Previous set | `prev` |

On the watch, open the Shortcuts app, or add the **Shortcuts** complication to your workout watch face for one tap. "Hey Siri, set done" works too.

---

## Changing things later

- **Your plan**: edit it on the phone (Plan tab). No code needed.
- **The pages**: change files in `web/` on GitHub. The site rebuilds itself; the TV picks it up within about 10 minutes, or press the centre button to reload.
- **The Fire Stick app** only needs reinstalling if something in `android/` changes. Install the new `gym.apk` over the old one the same way.

## How it works

- `supabase/schema.sql`: one table and two functions. `gym_get` reads the current state, `gym_action` changes it (start, done, next, prev, toggle_pause, add30, weight, end, save_plan). All the workout logic lives here, so the TV, phone and watch always agree.
- `web/`: plain HTML and JavaScript, no build step. The TV page is written for old browsers and polls once a second.
- `android/`: a tiny app that shows the TV page full screen. Built by `.github/workflows/build.yml`, which also publishes the site.

## Notes

- The Fire Stick app trusts the security certificate for your own two addresses (GitHub Pages and Supabase) even if the old Fire OS doesn't recognise the issuer. That stops a blank screen on old sticks. It doesn't apply to any other site.
- The signing key in `android/gymtv.keystore` is only there so updates install over the top. It's fine for a personal app.
- Free Supabase projects pause after a week of no use. Using the app counts, so a daily gym habit keeps it awake. If it ever pauses, click **Restore** in the Supabase dashboard.
