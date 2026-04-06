<?php

/**
 * Generate Radio Browser default logo as JPG using GD
 * Run once: php generate-logo.php
 * Creates: rb-default-logo.jpg (240x240)
 */

$size = 240;
$img = imagecreatetruecolor($size, $size);

// Colors
$bg = imagecolorallocate($img, 26, 26, 26);       // #1a1a1a
$accent = imagecolorallocate($img, 197, 90, 17);   // #c55a11
$accentDim = imagecolorallocate($img, 197, 90, 17);

imagefill($img, 0, 0, $bg);

// Anti-alias
imageantialias($img, true);

// Radio body (rounded rect approximation)
imagesetthickness($img, 4);
imagerectangle($img, 50, 95, 190, 195, $accent);

// Speaker circle (outer)
imageellipse($img, 155, 150, 56, 56, $accent);
// Speaker circle (inner filled)
imagefilledellipse($img, 155, 150, 24, 24, $accent);

// Tuner line
imagesetthickness($img, 3);
imageline($img, 72, 120, 118, 120, $accent);
imagefilledellipse($img, 98, 120, 10, 10, $accent);

// Tuner lines (display)
imagesetthickness($img, 2);
imageline($img, 72, 138, 118, 138, $accent);
imageline($img, 72, 150, 105, 150, $accent);

// Antenna
imagesetthickness($img, 4);
imageline($img, 80, 95, 60, 50, $accent);
imagefilledellipse($img, 60, 48, 8, 8, $accent);

// Signal wave arcs (simple lines to approximate)
imagesetthickness($img, 2);
imagearc($img, 48, 30, 30, 30, 120, 240, $accent);
imagearc($img, 43, 30, 50, 50, 120, 240, $accent);

// Save as JPG
$outputDir = __DIR__ . '/assets';
if (!is_dir($outputDir)) mkdir($outputDir, 0755, true);

$path = $outputDir . '/rb-default-logo.jpg';
imagejpeg($img, $path, 95);
imagedestroy($img);

// Also create smaller versions for thumbnails
foreach ([240 => 'rb-default-logo.jpg', 120 => 'rb-default-logo-thumb.jpg', 60 => 'rb-default-logo-thumb-sm.jpg'] as $s => $fname) {
  $thumb = imagecreatetruecolor($s, $s);
  $src = imagecreatefromjpeg($path);
  imagecopyresampled($thumb, $src, 0, 0, 0, 0, $s, $s, 240, 240);
  imagejpeg($thumb, $outputDir . '/' . $fname, 95);
  imagedestroy($thumb);
  imagedestroy($src);
}

echo "Generated: rb-default-logo.jpg, rb-default-logo-thumb.jpg, rb-default-logo-thumb-sm.jpg\n";
