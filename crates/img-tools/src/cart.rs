use image::{DynamicImage, GenericImageView, Rgba, RgbaImage};

fn inside_rounded_rect(
    px: f32,
    py: f32,
    rx: f32,
    ry: f32,
    rw: f32,
    rh: f32,
    radius: f32,
) -> bool {
    if px < rx || px > rx + rw || py < ry || py > ry + rh {
        return false;
    }
    let r = radius.min(rw / 2.0).min(rh / 2.0);
    let in_left_corner = px < rx + r;
    let in_right_corner = px > rx + rw - r;
    let in_top_corner = py < ry + r;
    let in_bottom_corner = py > ry + rh - r;

    if in_left_corner && in_top_corner {
        let dx = px - (rx + r);
        let dy = py - (ry + r);
        return dx * dx + dy * dy <= r * r;
    }
    if in_right_corner && in_top_corner {
        let dx = px - (rx + rw - r);
        let dy = py - (ry + r);
        return dx * dx + dy * dy <= r * r;
    }
    if in_left_corner && in_bottom_corner {
        let dx = px - (rx + r);
        let dy = py - (ry + rh - r);
        return dx * dx + dy * dy <= r * r;
    }
    if in_right_corner && in_bottom_corner {
        let dx = px - (rx + rw - r);
        let dy = py - (ry + rh - r);
        return dx * dx + dy * dy <= r * r;
    }
    true
}

/// Makes a Switch or 3DS cartridge card from the cover image.
pub fn make_cart(front: &DynamicImage, sys: &str) -> DynamicImage {
    let ds = sys == "n3ds";
    let h: u32 = 1000;
    let w: u32 = if ds {
        (h as f32 * 35.0 / 33.0).round() as u32
    } else {
        (h as f32 * 21.0 / 31.0).round() as u32
    };

    let mut out = RgbaImage::new(w, h);
    let shell_radius = w as f32 * (if ds { 0.045 } else { 0.07 });

    // 1. Draw shell gradient
    for y in 0..h {
        let t = y as f32 / h as f32;
        let (r0, g0, b0, r1, g1, b1) = if ds {
            (0xd9, 0xda, 0xdf, 0xa9, 0xab, 0xb2)
        } else {
            (0x3a, 0x3b, 0x42, 0x1d, 0x1e, 0x22)
        };
        let cr = (r0 as f32 + (r1 - r0) as f32 * t).round() as u8;
        let cg = (g0 as f32 + (g1 - g0) as f32 * t).round() as u8;
        let cb = (b0 as f32 + (b1 - b0) as f32 * t).round() as u8;

        for x in 0..w {
            if inside_rounded_rect(x as f32, y as f32, 0.0, 0.0, w as f32, h as f32, shell_radius) {
                out.put_pixel(x, y, Rgba([cr, cg, cb, 255]));
            }
        }
    }

    // 2. Shell grip grooves / ridges
    if ds {
        for i in 0..5 {
            let gx0 = (w as f32 * 0.2).round() as u32;
            let gw = (w as f32 * 0.6).round() as u32;
            let gy0 = (h as f32 * (0.05 + i as f32 * 0.025)).round() as u32;
            let gh = (h as f32 * 0.008).round() as u32;
            for gy in gy0..(gy0 + gh).min(h) {
                for gx in gx0..(gx0 + gw).min(w) {
                    let p = out.get_pixel_mut(gx, gy);
                    p[0] = (p[0] as f32 * 0.9) as u8;
                    p[1] = (p[1] as f32 * 0.9) as u8;
                    p[2] = (p[2] as f32 * 0.9) as u8;
                }
            }
        }
    } else {
        for i in 0..3 {
            let gx0 = (w as f32 * 0.25).round() as u32;
            let gw = (w as f32 * 0.5).round() as u32;
            let gy0 = (h as f32 * (0.84 + i as f32 * 0.035)).round() as u32;
            let gh = (h as f32 * 0.012).round() as u32;
            for gy in gy0..(gy0 + gh).min(h) {
                for gx in gx0..(gx0 + gw).min(w) {
                    let p = out.get_pixel_mut(gx, gy);
                    p[0] = (p[0] as f32 * 0.93 + 255.0 * 0.07) as u8;
                    p[1] = (p[1] as f32 * 0.93 + 255.0 * 0.07) as u8;
                    p[2] = (p[2] as f32 * 0.93 + 255.0 * 0.07) as u8;
                }
            }
        }
    }

    // 3. Label area
    let lx = w as f32 * (if ds { 0.08 } else { 0.085 });
    let ly = h as f32 * (if ds { 0.2 } else { 0.05 });
    let lw = w as f32 - 2.0 * lx;
    let lh = h as f32 * (if ds { 0.72 } else { 0.74 });
    let lr = w as f32 * 0.025;

    let (fw, fh) = front.dimensions();
    let s = (lw / fw as f32).max(lh / fh as f32);
    let dw = (fw as f32 * s).round() as u32;
    let dh = (fh as f32 * s).round() as u32;

    let skip = if (dh as f32) > lh {
        ((dh as f32 - lh).min(dh as f32 * (if ds { 0.1 } else { 0.085 }))).round() as i32
    } else {
        ((dh as f32 - lh) * -0.5).round() as i32
    };

    let resized_front = front.resize_exact(dw, dh, image::imageops::FilterType::Lanczos3).to_rgba8();

    let dest_x = (lx + (lw - dw as f32) / 2.0).round() as i32;
    let dest_y = (ly as i32) - skip;

    for y in 0..h {
        for x in 0..w {
            let px = x as f32;
            let py = y as f32;
            if inside_rounded_rect(px, py, lx, ly, lw, lh, lr) {
                let src_x = (x as i32) - dest_x;
                let src_y = (y as i32) - dest_y;
                if src_x >= 0 && src_x < dw as i32 && src_y >= 0 && src_y < dh as i32 {
                    let mut p = *resized_front.get_pixel(src_x as u32, src_y as u32);
                    // Add soft sheen
                    let t_diag = ((px - lx) + (py - ly)) / (lw + lh);
                    let sheen = if t_diag < 0.45 {
                        (0.16 * (1.0 - t_diag / 0.45)).clamp(0.0, 1.0)
                    } else {
                        0.0
                    };
                    if sheen > 0.0 {
                        p[0] = (p[0] as f32 * (1.0 - sheen) + 255.0 * sheen) as u8;
                        p[1] = (p[1] as f32 * (1.0 - sheen) + 255.0 * sheen) as u8;
                        p[2] = (p[2] as f32 * (1.0 - sheen) + 255.0 * sheen) as u8;
                    }
                    out.put_pixel(x, y, p);
                }
            }
        }
    }

    DynamicImage::ImageRgba8(out)
}
