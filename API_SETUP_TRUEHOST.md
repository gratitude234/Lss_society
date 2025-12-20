# JABULSS Past Questions: Vercel site + Truehost API (PHP + MySQL)

You chose:
- **Website**: hosted on Vercel (jabulss.com)
- **Upload & Database API**: hosted on Truehost as a folder under your domain:
  `https://jabumarket.com.ng/lss_api`

## Part 1 — Truehost (API)

### 1) Use your existing folder
You already have multiple projects on this hosting, so we are deploying this API into your existing folder:

`public_html/lss_api/*`

### 2) Upload the API files
Upload everything inside:
`lss_api/`
into:
`public_html/lss_api/`

### 3) Create MySQL user + password (if you haven't)
cPanel → **MySQL Databases**
- Database: `hrfjgoot_Jabulss` (you already have it)
- Create a DB user + password
- Add user to database → **All Privileges**

### 4) Configure the API
Edit on server:
`public_html/lss_api/_config.php`

Set:
- `DB_USER`
- `DB_PASS`
- `SETUP_KEY` (make a long random string)

### 5) Create tables + admin account (one-time)
Open in browser:
`https://jabumarket.com.ng/lss_api/setup/create_admin.php?key=YOUR_SETUP_KEY`

Create your admin email + password.

✅ After it says success, **delete the folder**:
`public_html/lss_api/setup/`

## Part 2 — Vercel (Website)

### 1) Update the site code
This ZIP already contains the updated JS:
- `pastquestions/pastquestions.js` loads from the API.
- `pastquestions/admin.js` logs in + uploads to the API.

Deploy this site to Vercel as usual.

### 2) Test
- Public list:
  `https://jabulss.com/pastquestions/pastquestions.html`

- Admin:
  `https://jabulss.com/pastquestions/admin.html`

Login, then upload a PDF → it should appear on the public page instantly.

## Notes
- Existing files already in your repo (e.g. `pastquestions/all/...`) can still be used.  
  You can import them into the database by:
  1) Clicking **Load Live** (to pull existing list if already imported),
  2) Or selecting a JSON export and clicking **Publish draft → Database**.

