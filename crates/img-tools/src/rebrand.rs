use ab_glyph::{Font, FontRef, Glyph, PxScale, ScaleFont};
use image::{DynamicImage, GenericImageView, Rgba};

const FONT_DATA: &[u8] = include_bytes!("../assets/DejaVuSans-Bold.ttf");

fn band_height_for_plat(plat: &str) -> f32 {
    match plat {
        "ps5" => 0.105,
        "xsx" => 0.12, // matches consolebox-test.js / BAND_H
        "ps4" => 0.095,
        "xone" => 0.1,
        "sw" => 0.1,
        _ => 0.1,
    }
}

struct BandEnd {
    y: u32,
    #[allow(dead_code)]
    sure: bool,
}

fn band_end(img: &DynamicImage, w: u32, h: u32, plat: &str, part: &str) -> Option<BandEnd> {
    let is_spine = part == "spine";
    let scan_h = ((h as f32 * (if is_spine { 0.34 } else { 0.2 })).round() as u32).min(h);
    let step = (w / 300).max(1);

    let y0 = ((h as f32 * (if is_spine { 0.01 } else { 0.02 })).round() as u32).max(2).min(h - 1);

    let rgba = img.to_rgba8();
    let mut ref_r = 0f32;
    let mut ref_g = 0f32;
    let mut ref_b = 0f32;
    let mut n = 0f32;

    for x in (0..w).step_by(step as usize) {
        let p = rgba.get_pixel(x, y0);
        ref_r += p[0] as f32;
        ref_g += p[1] as f32;
        ref_b += p[2] as f32;
        n += 1.0;
    }
    if n > 0.0 {
        ref_r /= n;
        ref_g /= n;
        ref_b /= n;
    }

    let same = |y: u32| -> f32 {
        let mut k = 0;
        let mut m = 0;
        for x in (0..w).step_by(step as usize) {
            let p = rgba.get_pixel(x, y);
            let diff = (p[0] as f32 - ref_r).abs()
                + (p[1] as f32 - ref_g).abs()
                + (p[2] as f32 - ref_b).abs();
            if diff < 70.0 {
                k += 1;
            }
            m += 1;
        }
        if m > 0 { k as f32 / m as f32 } else { 0.0 }
    };

    if same(y0) < 0.85 {
        return if !part.is_empty() {
            None
        } else {
            Some(BandEnd {
                y: (h as f32 * band_height_for_plat(plat)).round() as u32,
                sure: false,
            })
        };
    }

    let lo = ((h as f32 * (if is_spine { 0.03 } else { 0.05 })).round() as u32).min(scan_h);
    let hi = ((h as f32 * (if is_spine { 0.32 } else { 0.17 })).round() as u32).min(scan_h);

    if is_spine {
        let need = (h as f32 * 0.06).round() as usize;
        let mut v = vec![0.0f32; scan_h as usize];
        for y in 0..scan_h {
            v[y as usize] = same(y);
        }

        for y in lo..hi {
            let mut k = 0;
            while (y + k) < scan_h && v[(y + k) as usize] < 0.45 && (k as usize) < need {
                k += 1;
            }
            if k as usize >= need {
                return Some(BandEnd {
                    y: lo.max(y.saturating_sub(1)),
                    sure: true,
                });
            }
        }

        let mut best: Option<(u32, u32)> = None;
        let check_lo = (h as f32 * 0.1).round() as u32;
        let mut y = check_lo;
        while y < hi {
            if v[y as usize] >= 0.99 {
                let mut k = 0;
                while (y + k) < hi && v[(y + k) as usize] >= 0.99 {
                    k += 1;
                }
                if k >= (h as f32 * 0.015).round() as u32 {
                    if let Some((_, best_k)) = best {
                        if k > best_k {
                            best = Some((y, k));
                        }
                    } else {
                        best = Some((y, k));
                    }
                }
                y += k;
            } else {
                y += 1;
            }
        }

        if let Some((best_y, best_k)) = best {
            let delta = ((best_k as f32 * 0.4).min(h as f32 * 0.012)).round() as u32;
            return Some(BandEnd {
                y: hi.min(best_y + delta),
                sure: true,
            });
        }
        return None;
    }

    let mut run = 0;
    for y in lo..hi {
        if same(y) < 0.45 {
            run += 1;
            if run >= 3 {
                return Some(BandEnd {
                    y: y.saturating_sub(2),
                    sure: true,
                });
            }
        } else {
            run = 0;
        }
    }

    if !part.is_empty() {
        None
    } else {
        Some(BandEnd {
            y: (h as f32 * band_height_for_plat(plat)).round() as u32,
            sure: false,
        })
    }
}

pub fn rebrand(img: &DynamicImage, plat: &str, part: &str) -> Option<DynamicImage> {
    let (w, h) = img.dimensions();
    if w < 16 || h < 64 {
        return None;
    }

    let mut out = img.to_rgba8();
    let end = match band_end(img, w, h, plat, part) {
        Some(e) => e,
        None => return Some(DynamicImage::ImageRgba8(out)), // kept as is
    };

    let bh = if part == "spine" {
        ((h as f32 * 0.03).round() as u32).max(end.y)
    } else {
        let min_h = (h as f32 * 0.06).round() as u32;
        let max_h = (h as f32 * 0.17).round() as u32;
        min_h.max(max_h.min(end.y))
    };

    // Draw horizontal gradient #171a21 -> #1b2838
    for y in 0..bh.min(h) {
        for x in 0..w {
            let t = x as f32 / w.max(1) as f32;
            let r = (0x17 as f32 + (0x1b - 0x17) as f32 * t).round() as u8;
            let g = (0x1a as f32 + (0x28 - 0x1a) as f32 * t).round() as u8;
            let b = (0x21 as f32 + (0x38 - 0x21) as f32 * t).round() as u8;
            out.put_pixel(x, y, Rgba([r, g, b, 255]));
        }
    }

    // Light blue stripe #66c0f4 at the bottom of the band
    let stripe_h = 2u32.max((bh as f32 * 0.05).round() as u32);
    let stripe_y0 = bh.saturating_sub(stripe_h);
    for y in stripe_y0..bh.min(h) {
        for x in 0..w {
            out.put_pixel(x, y, Rgba([0x66, 0xc0, 0xf4, 255]));
        }
    }

    // Render "STEAM" text
    if let Ok(font) = FontRef::try_from_slice(FONT_DATA) {
        let is_vertical = (w as f32) < (bh as f32 * 2.2);
        if is_vertical {
            // Spine: word runs down vertically
            let font_size = ((w as f32 * 0.5).min(bh as f32 * 0.2)).round().max(8.0);
            render_text_vertical(&mut out, &font, "STEAM", w, bh, font_size);
        } else {
            // Front/back: horizontal text
            let font_size = (bh as f32 * 0.46).round().max(8.0);
            render_text_horizontal(&mut out, &font, "STEAM", w, bh, font_size);
        }
    }

    Some(DynamicImage::ImageRgba8(out))
}

fn render_text_horizontal(
    img: &mut image::RgbaImage,
    font: &FontRef,
    text: &str,
    w: u32,
    bh: u32,
    size: f32,
) {
    let scale = PxScale::from(size);
    let scaled_font = font.as_scaled(scale);

    let start_x = (bh as f32 * 0.42).round();
    let center_y = (bh as f32 / 2.0).round();

    let mut cursor_x = start_x;
    for ch in text.chars() {
        let glyph_id = font.glyph_id(ch);
        let advance = scaled_font.h_advance(glyph_id);
        let glyph: Glyph = glyph_id.with_scale_and_position(scale, ab_glyph::point(cursor_x, center_y - size * 0.35));

        if let Some(outlined) = font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            outlined.draw(|gx, gy, c| {
                let px = (bounds.min.x as i32 + gx as i32) as u32;
                let py = (bounds.min.y as i32 + gy as i32) as u32;
                if px < w && py < bh {
                    blend_pixel(img, px, py, [0xe5, 0xee, 0xf5], c);
                }
            });
        }
        cursor_x += advance + size * 0.12;
    }
}

fn render_text_vertical(
    img: &mut image::RgbaImage,
    font: &FontRef,
    text: &str,
    w: u32,
    bh: u32,
    size: f32,
) {
    let scale = PxScale::from(size);
    let scaled_font = font.as_scaled(scale);

    // Measure total length
    let mut total_len = 0f32;
    for ch in text.chars() {
        let glyph_id = font.glyph_id(ch);
        total_len += scaled_font.h_advance(glyph_id) + size * 0.12;
    }

    let top_y = ((bh as f32 * 0.84 - total_len) / 2.0).max(0.0) + (bh as f32 * 0.08);
    let center_x = (w as f32 / 2.0).round();

    let mut cursor_y = top_y;
    for ch in text.chars() {
        let glyph_id = font.glyph_id(ch);
        let advance = scaled_font.h_advance(glyph_id);

        // Draw rotated 90 degrees clockwise: (x, y) rotated -> (center_x - y_offset, cursor_y + x_offset)
        let glyph: Glyph = glyph_id.with_scale_and_position(scale, ab_glyph::point(0.0, 0.0));
        if let Some(outlined) = font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            outlined.draw(|gx, gy, c| {
                let local_x = bounds.min.x + gx as f32;
                let local_y = bounds.min.y + gy as f32;
                // 90 deg rotation: x' = -y, y' = x
                let px = (center_x - (local_y + size * 0.35)) as u32;
                let py = (cursor_y + local_x) as u32;
                if px < w && py < bh {
                    blend_pixel(img, px, py, [0xe5, 0xee, 0xf5], c);
                }
            });
        }
        cursor_y += advance + size * 0.12;
    }
}

fn blend_pixel(img: &mut image::RgbaImage, x: u32, y: u32, rgb: [u8; 3], alpha: f32) {
    let bg = img.get_pixel(x, y);
    let a = alpha.clamp(0.0, 1.0);
    let inv_a = 1.0 - a;
    let r = (rgb[0] as f32 * a + bg[0] as f32 * inv_a).round() as u8;
    let g = (rgb[1] as f32 * a + bg[1] as f32 * inv_a).round() as u8;
    let b = (rgb[2] as f32 * a + bg[2] as f32 * inv_a).round() as u8;
    img.put_pixel(x, y, Rgba([r, g, b, 255]));
}
