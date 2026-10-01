# The Coach's Playbook

A flipbook of whiteboard sketches from the coaches at BFT Beauty World.

## Where everything lives

The **"BFT Playbook" Google Sheet is the single source of truth.** The website
reads everything from it every time the page loads:

| Sheet tab  | What it controls on the site |
|------------|------------------------------|
| Entries    | The boards. Only rows with Status = Live are shown. |
| Coaches    | Coach names, profiles and photos. Rows with "Show on site" = No are hidden. |
| Sessions   | Session names and their type (Cardio, Strength, Hybrid), which drives the filter buttons. |

The Coaches and Sessions tabs also feed the "Who drew it?" and "Session"
dropdowns in the Tally form automatically (Playbook → Turn on automatic Tally sync).

## What's in this folder

```
index.html     page shell + loads the live feed from the Sheet
app.js         the flipbook itself: rendering, filters, lightbox, etc.
data.js        studio details only (name, address, the 8-for-$60 offer)
images/brand/  BFT logos
```

The `images/boards`, `images/full` and `images/original` folders are no longer
used: every board photo now lives on Cloudinary. They can be deleted.

## Common jobs (all in the Sheet, no file edits)

- **Add a coach:** add a row on the Coaches tab. They appear in the Tally form
  within seconds and on the site within a couple of minutes.
- **Coach photo:** put an image link in their "Photo URL" cell, or leave it
  empty and add `images/coaches/<first name>.jpg` (or `.png`) to the repo,
  e.g. `images/coaches/saj.jpg`. With neither, their initials show.
- **Add a session:** add a row on the Sessions tab and pick its Type.
- **Change who drew a board:** edit the Coach cell on its Entries row.
- **Hide a board:** set its Status to Hidden.

## Speed

The Google feed can take a few seconds to answer. Returning visitors see their
last saved copy instantly while the fresh one loads; if there's something new,
a "tap to refresh" note appears.

## Share links

Every board has its own link: `…/index.html#<board id>`, and coach profiles
work the same way.

## Hosting

GitHub Pages: Settings → Pages → Source "Deploy from a branch", branch `main`,
folder `/ (root)`. To move to bft-bw.com later, add a `CNAME` file (e.g.
`flipbook.bft-bw.com`) and point that subdomain's DNS to `<username>.github.io`.

## Libraries

- Page flip: [StPageFlip](https://github.com/Nodlik/StPageFlip) 2.0.7, from jsDelivr
- Fonts: Oswald and Kalam from Google Fonts
