# The Coach's Playbook

A flipbook of whiteboard sketches from the coaches at BFT Beauty World.

## What's in here

```
index.html           the flipbook (page, styles, behaviour)
data.js              coaches and boards: the only file you edit day to day
images/boards/       cleaned boards, page size (900 x 1200)
images/full/         cleaned boards, zoom size (1500 x 2000)
images/original/     the untouched photos, for the "Original photo" button
images/coaches/      coach photos (square, e.g. 400 x 400)
images/brand/        BFT logos (cyan and white SVG)
```

## Rename a coach or add their bio

Open `data.js` and edit the entry under `coaches`. Keep the `id` the same, or update
every board that points to it.

For a photo, add a square image to `images/coaches/` and set
`photo: "images/coaches/their-name.jpg"`. Leave it `""` to show initials.

## Change who drew a board

In `data.js`, find the board under `boards` and change `coach: "coach-a"` to the right id.

## Add a new board

1. Put the cleaned image in `images/boards/`, `images/full/` and `images/original/`
   with the same file name.
2. Copy an existing board entry in `data.js` and change the fields.
   `category` must be `Cardio`, `Strength`, `HIIT` or `Hybrid`.

## Share links

Every board has its own link: `…/index.html#summit-3-of-6` (the board's `id`).
Coach profiles work the same way: `…/index.html#coach-a`.

## Put it on GitHub Pages

1. Create a new public repository and upload everything in this folder.
2. Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The site appears at `https://<your-username>.github.io/<repo-name>/` in a minute or two.

Moving to bft-bw.com later: add a `CNAME` file containing e.g. `flipbook.bft-bw.com`,
and point that subdomain's DNS (CNAME record) to `<your-username>.github.io`.

## Libraries

- Page flip: [StPageFlip](https://github.com/Nodlik/StPageFlip) 2.0.7, loaded from jsDelivr
- Fonts: Oswald and Kalam from Google Fonts
