# Demo Videos Directory

Place your demo videos at the root `/public/demovids/` level:

- `/public/demovids/demo1.mp4` - Camera 1
- `/public/demovids/demo2.mp4` - Camera 2
- `/public/demovids/demo3.mp4` - Camera 3
- `/public/demovids/demo4.mp4` - Camera 4

These will be displayed in a **3x3 grid** (9 camera slots, only 4 have videos).

## Format
- Recommended: MP4 (H.264)
- Videos **auto-play** immediately when grid opens
- Loop automatically
- Muted in grid view
- Click any camera to fullscreen with controls

## Grid Layout
```
┌────────┬────────┬────────┐
│ Cam 1  │ Cam 2  │ Cam 3  │
├────────┼────────┼────────┤
│ Cam 4  │ Cam 5  │ Cam 6  │
│(video) │(empty) │(empty) │
├────────┼────────┼────────┤
│ Cam 7  │ Cam 8  │ Cam 9  │
│(empty) │(empty) │(empty) │
└────────┴────────┴────────┘
```

Empty slots show "No feed" placeholder.
