use image::{DynamicImage, GenericImageView};

/// Cuts a spine or back panel from a full box wrap (back | spine | front).
/// Replicates the fold search algorithm from renderer/img-tools.js.
pub fn cut_spine(
    img: &DynamicImage,
    front_ratio: Option<f32>,
    spine_ratio: Option<f32>,
    part: &str,
) -> Option<DynamicImage> {
    let (w_orig, h_orig) = img.dimensions();
    let w_f = w_orig as f32;
    let h_f = h_orig as f32;

    if w_f < h_f * 1.15 {
        return None; // not a wrap
    }

    let fr = front_ratio.unwrap_or(0.71);
    let sr = spine_ratio.unwrap_or(0.074);

    let mut s0 = w_f - 2.0 * fr * h_f;
    if !(s0 > sr * h_f * 0.5 && s0 < sr * h_f * 2.0) {
        s0 = sr * h_f;
    }

    let l0 = (w_f - s0) / 2.0;
    let r0 = (w_f + s0) / 2.0;

    let k = (400.0 / h_f).min(1.0);
    let w = ((w_f * k).round() as u32).max(1);
    let h = ((h_f * k).round() as u32).max(1);

    let small = img.resize_exact(w, h, image::imageops::FilterType::Triangle).to_rgba8();
    let y0 = (h as f32 * 0.08).floor() as u32;
    let y1 = (h as f32 * 0.92).ceil() as u32;
    let y_span = (y1.saturating_sub(y0)).max(1) as f32;

    let mut edge = vec![0.0f32; w as usize];
    for x in 1..w {
        let mut e = 0.0f32;
        for y in y0..y1.min(h) {
            let p1 = small.get_pixel(x, y);
            let p0 = small.get_pixel(x - 1, y);
            let dr = (p1[0] as i32 - p0[0] as i32).abs() as f32;
            let dg = (p1[1] as i32 - p0[1] as i32).abs() as f32;
            let db = (p1[2] as i32 - p0[2] as i32).abs() as f32;
            e += dr + dg + db;
        }
        edge[x as usize] = e / y_span;
    }

    let best = |cx: f32, radius: f32| -> (i32, f32) {
        let mut bx = -1i32;
        let mut bv = 0.0f32;
        let start = 1.max((cx - radius).round() as i32);
        let end = (w as i32 - 1).min((cx + radius).round() as i32);
        for x in start..=end {
            let v = edge[x as usize];
            if v > bv {
                bv = v;
                bx = x;
            }
        }
        (bx, bv)
    };

    let avg: f32 = edge.iter().sum::<f32>() / (w as f32).max(1.0);
    let r = s0 * k * 0.3;
    let (lx, lv) = best(l0 * k, r);
    let (rx, rv) = best(r0 * k, r);

    let mut l = l0;
    let mut right = r0;
    if lx > 0 && rx > lx && lv > avg * 2.0 && rv > avg * 2.0 {
        let s1 = (rx - lx) as f32 / k;
        if s1 > s0 * 0.7 && s1 < s0 * 1.35 {
            l = lx as f32 / k;
            right = rx as f32 / k;
        }
    }

    let inset = ((right - l) * 0.03).round();

    if part == "back" {
        let bw = l.round() - inset;
        if bw < fr * h_f * 0.75 {
            return None;
        }
        let x0 = 0.0f32.max(l - (bw.min(fr * h_f * 1.08))).round();
        let cw = (l.round() - inset - x0).max(1.0);
        let x0_u = (x0 as u32).min(w_orig.saturating_sub(1));
        let cw_u = (cw as u32).min(w_orig - x0_u);
        Some(img.crop_imm(x0_u, 0, cw_u, h_orig))
    } else {
        let x0 = (l.round() + inset).max(0.0);
        let sw = (right - l - 2.0 * inset).round().max(4.0);
        let x0_u = (x0 as u32).min(w_orig.saturating_sub(1));
        let sw_u = (sw as u32).min(w_orig - x0_u);
        Some(img.crop_imm(x0_u, 0, sw_u, h_orig))
    }
}
