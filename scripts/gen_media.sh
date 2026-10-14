#!/bin/bash
# Generate short muted Ken Burns loop mp4s from the placeholder posters.
set -e
cd /home/z/my-project/public/assets
mkdir -p reels

make_loop () {
  src=$1; out=$2; w=$3; h=$4; frames=$5
  ffmpeg -y -loglevel error -loop 1 -i "works/$src" -frames:v "$frames" \
    -vf "scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='min(1.0+0.0011*on,1.14)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${w}x${h}:fps=24,noise=alls=7:allf=t,eq=brightness=-0.02" \
    -c:v libx264 -crf 30 -preset veryfast -pix_fmt yuv420p -movflags +faststart -an "reels/$out"
}

# 6s @ 24fps = 144 frames; landscape 640x360, vertical 360x640
# DW{n}.mp4 is the reel for WORKS[n-1] — poster and motion must match
make_loop work0.jpg DW1.mp4 640 360 144
make_loop work1.jpg DW2.mp4 640 360 144
make_loop work2.jpg DW3.mp4 640 360 144
make_loop work3.jpg DW4.mp4 640 360 144
make_loop work4.jpg DW5.mp4 640 360 144
make_loop work5.jpg DW6.mp4 360 640 144
make_loop work6.jpg DW7.mp4 640 360 144
make_loop work7.jpg DW8.mp4 640 360 144
echo "reels done"
ls -la reels
# convert wav -> mp3 for the theme
ffmpeg -y -loglevel error -i audio/theme.wav -codec:a libmp3lame -b:a 192k audio/theme.mp3
rm audio/theme.wav
echo "theme mp3 done"
