# Fieldnotes — Editorial Blog & News Template

A refined, responsive editorial publication starter built with plain HTML, CSS and vanilla JavaScript.

## Features
- Editorial homepage and featured story layout
- Article cards with category, excerpt, date and reading-time metadata
- Category filtering, live search and load-more interaction
- Search overlay with keyboard Escape support
- Newsletter signup demo interaction
- Responsive desktop, tablet and mobile layouts

## Run locally
Open `index.html` in a modern browser or serve the folder with a static web server. No build step or package installation is required.

## Customize
- Replace Fieldnotes branding, featured story and article data.
- Edit the `articles` array in `app.js` to add or update stories.
- Replace sample photo URLs with owned or licensed images.
- Update publication date, editor details, newsletter provider and contact email.
- Adjust fonts, colors and spacing in `styles.css`.

## Production requirements
This is a static editorial UI starter, not a publishing CMS. Before launch, connect:
- A content management system or secure editorial API
- Article detail routes and SEO metadata per article
- Server-side newsletter subscription handling and consent records
- Image optimization, sitemap, RSS feed and analytics
- Editorial roles, drafts, scheduling and content moderation

The article cards currently link to the newsletter section as demo destinations. Newsletter signup displays a local confirmation only and does not transmit email addresses.

## Files
- `index.html` — publication page structure
- `styles.css` — editorial design and responsive layouts
- `app.js` — sample stories, filtering, search and newsletter demo

© YSCMT Enterprise template starter. Replace sample content and branding before production use.