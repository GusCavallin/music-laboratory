# Changelog

Notable changes to Music Laboratory. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are
`MAJOR.MINOR.PATCH`: a patch fixes something, a minor adds or improves something.

## Unreleased

### Added

- Music Hub: a **Track** column on the iTunes tab (`5/13`, or `2-5/12` for a multi-disc album), and sorting by Album now keeps each album together in disc and
  track order, so missing tracks show as gaps. Click **Refresh data** once after updating.
- Music Hub: the Raw Feel sliders are stacked in five pairs of scales that move together (Awe, Calm, Light and dark, Edge, Depth), each with a
  **link toggle** that makes the two sliders follow each other (a mirror image for the opposite pair, joyful and sadness). Off at first.
- Music Hub: **Save as playlist** writes the songs in the current list (any filter, in the order shown) as a `[Gen] <name>.m3u8` file in the
  `playlists` folder, ready to import into iTunes. Restart the helper after updating.
- `docs/architecture.svg`: a diagram of how the parts fit together, from the iTunes library file through the index tools and Music Hub to the running iTunes.

## 0.1.0 - 2026-10-30

The first numbered release: the public tools plus the changes below.

### Added

- Music Hub: hover a song's name to see the playlists it is in (hand-made and generated ones, not smart ones). Click **Refresh data** once
  after updating, so the page learns which playlists are smart.
- Music Hub: an **About** box with the version, what Music Hub is, the license, and links to the source and the support page.
- The helper prints the version when it starts ("Music Hub 0.1.0 running at ...").
- A `VERSION` file at the repo root (the one place the number is written) and this changelog.
- Music Hub: the mouse Back and Forward buttons (and Alt+Left / Alt+Right) undo and redo the filter views, like the "← back" chip.
- A funding link: the Sponsor button on the repository points to the Ko-fi page.
